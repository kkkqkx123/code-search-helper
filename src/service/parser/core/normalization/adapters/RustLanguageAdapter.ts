import { BaseLanguageAdapter, AdapterOptions } from './base/BaseLanguageAdapter';
import { StandardizedQueryResult, SymbolInfo, SymbolTable } from '../types';
import { NodeIdGenerator } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
import { MetadataBuilder } from '../utils/MetadataBuilder';
import {
  CallRelationshipExtractor,
  DataFlowRelationshipExtractor,
  InheritanceRelationshipExtractor,
  ConcurrencyRelationshipExtractor,
  LifecycleRelationshipExtractor,
  SemanticRelationshipExtractor,
  ControlFlowRelationshipExtractor,
  AnnotationRelationshipExtractor,
  CreationRelationshipExtractor,
  DependencyRelationshipExtractor,
  ReferenceRelationshipExtractor,
  RustHelperMethods,
  RUST_NODE_TYPE_MAPPING,
  RUST_QUERY_TYPE_MAPPING,
  RUST_SUPPORTED_QUERY_TYPES,
  RUST_NAME_CAPTURES,
  RUST_BLOCK_NODE_TYPES,
  RUST_MODIFIERS,
  RUST_COMPLEXITY_KEYWORDS
} from './rust-utils';

/**
 * Rust语言适配器
 * 处理Rust特定的查询结果标准化
 */
export class RustLanguageAdapter extends BaseLanguageAdapter {
  // In-memory symbol table for the current file
  private symbolTable: SymbolTable | null = null;

  // 关系提取器实例
  private callExtractor: CallRelationshipExtractor;
  private dataFlowExtractor: DataFlowRelationshipExtractor;
  private inheritanceExtractor: InheritanceRelationshipExtractor;
  private concurrencyExtractor: ConcurrencyRelationshipExtractor;
  private lifecycleExtractor: LifecycleRelationshipExtractor;
  private semanticExtractor: SemanticRelationshipExtractor;
  private controlFlowExtractor: ControlFlowRelationshipExtractor;
  private annotationExtractor: AnnotationRelationshipExtractor;
  private creationExtractor: CreationRelationshipExtractor;
  private dependencyExtractor: DependencyRelationshipExtractor;
  private referenceExtractor: ReferenceRelationshipExtractor;

  constructor(options: AdapterOptions = {}) {
    super(options);

    // 初始化关系提取器
    this.callExtractor = new CallRelationshipExtractor();
    this.dataFlowExtractor = new DataFlowRelationshipExtractor();
    this.inheritanceExtractor = new InheritanceRelationshipExtractor();
    this.concurrencyExtractor = new ConcurrencyRelationshipExtractor();
    this.lifecycleExtractor = new LifecycleRelationshipExtractor();
    this.semanticExtractor = new SemanticRelationshipExtractor();
    this.controlFlowExtractor = new ControlFlowRelationshipExtractor();
    this.annotationExtractor = new AnnotationRelationshipExtractor();
    this.creationExtractor = new CreationRelationshipExtractor();
    this.dependencyExtractor = new DependencyRelationshipExtractor();
    this.referenceExtractor = new ReferenceRelationshipExtractor();
  }

  getSupportedQueryTypes(): string[] {
    return RUST_SUPPORTED_QUERY_TYPES;
  }

  mapNodeType(nodeType: string): string {
    return RUST_NODE_TYPE_MAPPING[nodeType] || nodeType;
  }

  extractName(result: any): string {
    try {
      // 尝试从不同的捕获中提取名称
      for (const captureName of RUST_NAME_CAPTURES) {
        const capture = result.captures?.find((c: any) => c.name === captureName);
        if (capture?.node) {
          // 使用RustHelperMethods提取名称
          const name = RustHelperMethods.extractNameFromNode(capture.node);
          if (name) {
            return name;
          }

          // 如果特定字段没有找到，使用节点文本
          if (capture.node.text) {
            return capture.node.text;
          }
        }
      }

      // 如果没有找到名称捕获，尝试从主节点提取
      if (result.captures?.[0]?.node) {
        const mainNode = result.captures[0].node;

        // 使用RustHelperMethods提取名称
        const name = RustHelperMethods.extractNameFromNode(mainNode);
        if (name) {
          return name;
        }

        // 如果以上都失败，返回节点文本
        if (mainNode.text) {
          return mainNode.text;
        }
      }

      return 'unnamed';
    } catch (error) {
      this.logger.warn('Error in extractName:', error);
      return 'unnamed';
    }
  }

  extractLanguageSpecificMetadata(result: any): Record<string, any> {
    const extra: Record<string, any> = {};
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return extra;
    }

    // 使用RustHelperMethods提取各种信息
    const genericParameters = RustHelperMethods.extractGenericParameters(mainNode);
    if (genericParameters.length > 0) {
      extra.hasGenerics = true;
      extra.genericParameters = genericParameters;
    }

    const traitBounds = RustHelperMethods.extractTraitBounds(mainNode);
    if (traitBounds.length > 0) {
      extra.hasTraitBounds = true;
      extra.traitBounds = traitBounds;
    }

    const lifetimes = RustHelperMethods.extractLifetimes(mainNode);
    if (lifetimes.length > 0) {
      extra.hasLifetimes = true;
      extra.lifetimes = lifetimes;
    }

    // 提取参数信息（对于函数）
    if (mainNode.childForFieldName) {
      const parameters = mainNode.childForFieldName('parameters');
      if (parameters && typeof parameters === 'object' && parameters.childCount !== undefined) {
        extra.parameterCount = parameters.childCount;
      }
    }

    // 提取返回类型
    const returnType = RustHelperMethods.extractReturnType(mainNode);
    if (returnType) {
      extra.returnType = returnType;
    }

    // 提取可见性
    const visibility = RustHelperMethods.extractVisibility(mainNode);
    if (visibility) {
      extra.visibility = visibility;
    }

    // 检查是否是异步函数
    if (RustHelperMethods.isAsyncNode(mainNode)) {
      extra.isAsync = true;
    }

    // 检查是否是不安全代码
    if (RustHelperMethods.isUnsafeNode(mainNode)) {
      extra.isUnsafe = true;
    }

    return extra;
  }

  mapQueryTypeToStandardType(queryType: string): StandardizedQueryResult['type'] {
    return RUST_QUERY_TYPE_MAPPING[queryType] as StandardizedQueryResult['type'] || 'expression';
  }

  calculateComplexity(result: any): number {
    try {
      let complexity = this.calculateBaseComplexity(result);

      const mainNode = result.captures?.[0]?.node;
      if (!mainNode) {
        return complexity;
      }

      // 基于节点类型增加复杂度
      const nodeType = mainNode.type || '';
      if (nodeType.includes('struct') || nodeType.includes('enum') || nodeType.includes('trait')) complexity += 1;
      if (nodeType.includes('function') || nodeType.includes('method')) complexity += 1;
      if (nodeType.includes('impl')) complexity += 1;
      if (nodeType.includes('macro')) complexity += 2; // 宏通常更复杂
      if (nodeType.includes('match')) complexity += 1; // match表达式可能很复杂

      // 使用RUST_COMPLEXITY_KEYWORDS计算复杂度
      const text = mainNode.text || '';
      for (const keyword of RUST_COMPLEXITY_KEYWORDS) {
        if (new RegExp(keyword.pattern).test(text)) {
          complexity += keyword.weight;
        }
      }

      return complexity;
    } catch (error) {
      this.logger.warn('Error in calculateComplexity:', error);
      return 1; // 返回基础复杂度
    }
  }

  extractDependencies(result: any): string[] {
    try {
      const dependencies: string[] = [];
      const mainNode = result.captures?.[0]?.node;

      if (!mainNode) {
        return dependencies;
      }

      // 使用RustHelperMethods查找各种依赖
      RustHelperMethods.findTypeReferences(mainNode, dependencies);
      RustHelperMethods.findFunctionCalls(mainNode, dependencies);
      RustHelperMethods.findPathReferences(mainNode, dependencies);
      RustHelperMethods.findGenericDependencies(mainNode, dependencies);
      RustHelperMethods.findDataFlowDependencies(mainNode, dependencies);
      RustHelperMethods.findConcurrencyDependencies(mainNode, dependencies);
      RustHelperMethods.findLifetimeDependencies(mainNode, dependencies);

      return [...new Set(dependencies)]; // 去重
    } catch (error) {
      this.logger.warn('Error in extractDependencies:', error);
      return [];
    }
  }

  extractModifiers(result: any): string[] {
    try {
      const modifiers: string[] = [];
      const mainNode = result.captures?.[0]?.node;

      if (!mainNode) {
        return modifiers;
      }

      // 使用RUST_MODIFIERS检查修饰符
      const text = mainNode.text || '';

      for (const modifier of RUST_MODIFIERS) {
        if (text.includes(modifier)) {
          modifiers.push(modifier);
        }
      }

      // 检查是否是trait实现
      if (text.includes('impl')) {
        if (text.includes('for')) {
          modifiers.push('trait-impl');
        } else {
          modifiers.push('inherent-impl');
        }
      }

      return modifiers;
    } catch (error) {
      this.logger.warn('Error in extractModifiers:', error);
      return [];
    }
  }

  // 重写isBlockNode方法以支持Rust特定的块节点类型
  protected isBlockNode(node: any): boolean {
    return RUST_BLOCK_NODE_TYPES.includes(node.type) || super.isBlockNode(node);
  }

  // 重写normalize方法以集成nodeId生成和符号信息
  async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
    const results: StandardizedQueryResult[] = [];
    const processingStartTime = Date.now();

    // Initialize symbol table for the current processing context
    const filePath = 'current_file.rs';
    this.symbolTable = {
      filePath,
      globalScope: { symbols: new Map() },
      imports: new Map()
    };

    for (const result of queryResults) {
      try {
        const standardType = this.mapQueryTypeToStandardType(queryType);
        const name = this.extractName(result);
        const content = this.extractContent(result);
        const complexity = this.calculateComplexity(result);
        const dependencies = this.extractDependencies(result);
        const modifiers = this.extractModifiers(result);
        const extra = this.extractLanguageSpecificMetadata(result);

        // 获取AST节点以生成确定性ID
        const astNode = result.captures?.[0]?.node;
        const nodeId = NodeIdGenerator.safeForAstNode(astNode, standardType, name);

        // 使用 MetadataBuilder 创建增强的元数据
        const builder = this.createMetadataBuilder(result, language)
          .setProcessingStartTime(processingStartTime)
          .addDependencies(dependencies)
          .addModifiers(modifiers)
          .addCustomFields(extra);

        // 如果是关系类型，添加关系元数据
        if (this.isRelationshipType(standardType)) {
          const relationshipMetadata = this.extractRelationshipMetadata(result, standardType, astNode);
          if (relationshipMetadata) {
            builder.addCustomFields(relationshipMetadata);
          }
        }

        let symbolInfo: SymbolInfo | null = null;

        // Only create symbol info for entity types, not relationships
        if (['function', 'class', 'method', 'variable', 'import', 'type'].includes(standardType)) {
          symbolInfo = this.createSymbolInfo(astNode, name, standardType, filePath);
          if (this.symbolTable && symbolInfo) {
            this.symbolTable.globalScope.symbols.set(name, symbolInfo);
          }
        }

        results.push({
          nodeId,
          type: standardType,
          name,
          startLine: result.startLine || 1,
          endLine: result.endLine || 1,
          content,
          metadata: builder.build(),
          symbolInfo: symbolInfo || undefined
        });
      } catch (error: unknown) {
        this.logger?.error(`Error normalizing Rust result: ${error}`);
        // 使用 MetadataBuilder 创建错误元数据
        const errorForMetadata = error instanceof Error ? error : new Error(String(error));
        const errorBuilder = MetadataBuilder.fromComplete(this.createMetadata(result, language))
          .setError(errorForMetadata, { phase: 'normalization', queryType, filePath });
        results.push({
          nodeId: `error_${Date.now()}`,
          type: 'expression',
          name: 'error',
          startLine: 0,
          endLine: 0,
          content: '',
          metadata: errorBuilder.build()
        });
      }
    }

    return results;
  }

  private isRelationshipType(type: StandardizedQueryResult['type']): boolean {
    return ['call', 'data-flow', 'inheritance', 'concurrency', 'lifecycle', 'semantic'].includes(type);
  }

  private extractRelationshipMetadata(result: any, standardType: string, astNode: Parser.SyntaxNode | undefined): any {
    if (!astNode) return null;

    switch (standardType) {
      case 'call':
        return this.extractCallMetadata(result, astNode);
      case 'data-flow':
        return this.extractDataFlowMetadata(result, astNode);
      case 'inheritance':
        return this.extractInheritanceMetadata(result, astNode);
      case 'concurrency':
        return this.extractConcurrencyMetadata(result, astNode);
      case 'lifecycle':
        return this.extractLifecycleMetadata(result, astNode);
      case 'semantic':
        return this.extractSemanticMetadata(result, astNode);
      case 'annotation':
        return this.annotationExtractor.extractAnnotationMetadata(result, astNode, this.symbolTable);
      case 'creation':
        return this.creationExtractor.extractCreationMetadata(result, astNode, this.symbolTable);
      case 'dependency':
        return this.dependencyExtractor.extractDependencyMetadata(result, astNode, this.symbolTable);
      case 'reference':
        return this.referenceExtractor.extractReferenceMetadata(result, astNode, this.symbolTable);
      default:
        return null;
    }
  }

  private createSymbolInfo(node: Parser.SyntaxNode | undefined, name: string, standardType: string, filePath: string): SymbolInfo | null {
    if (!name || !node) return null;

    const symbolType = this.mapToSymbolType(standardType);

    const symbolInfo: SymbolInfo = {
      name,
      type: symbolType,
      filePath,
      location: {
        startLine: node.startPosition.row + 1,
        startColumn: node.startPosition.column,
        endLine: node.endPosition.row + 1,
        endColumn: node.endPosition.column,
      },
      scope: this.determineScope(node)
    };

    // Add parameters for functions
    if (symbolType === 'function' || symbolType === 'method') {
      symbolInfo.parameters = this.extractParameters(node);
    }

    // Add source path for imports
    if (symbolType === 'import') {
      symbolInfo.sourcePath = this.extractImportPath(node);
    }

    return symbolInfo;
  }

  private mapToSymbolType(standardType: string): SymbolInfo['type'] {
    const mapping: Record<string, SymbolInfo['type']> = {
      'function': 'function',
      'method': 'method',
      'class': 'class',
      'interface': 'interface',
      'variable': 'variable',
      'import': 'import'
    };
    return mapping[standardType] || 'variable';
  }

  private determineScope(node: Parser.SyntaxNode): SymbolInfo['scope'] {
    // Simplified scope determination. A real implementation would traverse up the AST.
    let current = node.parent;
    while (current) {
      if (current.type === 'function_item' || current.type === 'function_signature_item') {
        return 'function';
      }
      if (current.type === 'impl_item' || current.type === 'struct_item' || current.type === 'enum_item') {
        return 'class';
      }
      current = current.parent;
    }
    return 'global';
  }

  private extractParameters(node: Parser.SyntaxNode): string[] {
    const parameters: string[] = [];
    const parameterList = node.childForFieldName('parameters');
    if (parameterList) {
      for (const child of parameterList.children) {
        if (child.type === 'parameter') {
          const pattern = child.childForFieldName('pattern');
          if (pattern?.text) {
            parameters.push(pattern.text);
          }
        }
      }
    }
    return parameters;
  }

  private extractImportPath(node: Parser.SyntaxNode): string | undefined {
    // For Rust use declarations
    if (node.type === 'use_declaration') {
      const pathNode = node.childForFieldName('path');
      return pathNode ? pathNode.text : undefined;
    }
    return undefined;
  }

  private extractCallMetadata(result: any, astNode: Parser.SyntaxNode): any {
    return this.callExtractor.extractCallMetadata(result, astNode, this.symbolTable);
  }

  private extractDataFlowMetadata(result: any, astNode: Parser.SyntaxNode): any {
    return this.dataFlowExtractor.extractDataFlowMetadata(result, astNode, this.symbolTable);
  }

  private extractInheritanceMetadata(result: any, astNode: Parser.SyntaxNode): any {
    return this.inheritanceExtractor.extractInheritanceMetadata(result, astNode, this.symbolTable);
  }

  private extractConcurrencyMetadata(result: any, astNode: Parser.SyntaxNode): any {
    return this.concurrencyExtractor.extractConcurrencyMetadata(result, astNode, this.symbolTable);
  }

  private extractLifecycleMetadata(result: any, astNode: Parser.SyntaxNode): any {
    return this.lifecycleExtractor.extractLifecycleMetadata(result, astNode, this.symbolTable);
  }

  private extractSemanticMetadata(result: any, astNode: Parser.SyntaxNode): any {
    return this.semanticExtractor.extractSemanticMetadata(result, astNode, this.symbolTable);
  }

  // 高级关系提取方法 - 委托给专门的提取器
  extractCallRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator';
  }> {
    const rustRelationships = this.callExtractor.extractCallRelationships(result);
    // 转换Rust特定的类型到基类期望的类型
    return rustRelationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapRustCallTypeToBaseType(rel.type)
    }));
  }

  extractDataFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'assignment' | 'parameter' | 'return';
  }> {
    const rustRelationships = this.dataFlowExtractor.extractDataFlowRelationships(result);
    // 转换Rust特定的类型到基类期望的类型
    return rustRelationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapRustDataFlowTypeToBaseType(rel.type)
    }));
  }

  extractInheritanceRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'class' | 'interface' | 'extends' | 'implements';
  }> {
    const rustRelationships = this.inheritanceExtractor.extractInheritanceRelationships(result);
    // 转换Rust特定的类型到基类期望的类型
    return rustRelationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapRustInheritanceTypeToBaseType(rel.type)
    }));
  }

  extractConcurrencyRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'synchronizes' | 'locks' | 'communicates' | 'races';
  }> {
    const rustRelationships = this.concurrencyExtractor.extractConcurrencyRelationships(result);
    // 转换Rust特定的类型到基类期望的类型
    return rustRelationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapRustConcurrencyTypeToBaseType(rel.type)
    }));
  }

  extractLifecycleRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'instantiates' | 'initializes' | 'destroys' | 'manages';
  }> {
    const rustRelationships = this.lifecycleExtractor.extractLifecycleRelationships(result);
    // 转换Rust特定的类型到基类期望的类型
    return rustRelationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapRustLifecycleTypeToBaseType(rel.type)
    }));
  }

  extractSemanticRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
  }> {
    const rustRelationships = this.semanticExtractor.extractSemanticRelationships(result);
    // 转换Rust特定的类型到基类期望的类型
    return rustRelationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapRustSemanticTypeToBaseType(rel.type)
    }));
  }

  extractControlFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'conditional' | 'loop' | 'exception' | 'callback';
  }> {
    const rustRelationships = this.controlFlowExtractor.extractControlFlowRelationships(result);
    // 转换Rust特定的类型到基类期望的类型
    return rustRelationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapRustControlFlowTypeToBaseType(rel.type)
    }));
  }

  // 新增的关系提取方法

  extractAnnotationRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'attribute' | 'derive' | 'macro' | 'doc_comment';
  }> {
    const relationships = this.annotationExtractor.extractAnnotationRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapAnnotationType(rel.type)
    }));
  }

  extractCreationRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'instantiation' | 'enum_creation' | 'closure' | 'function_object' | 'iterator' | 'collection';
  }> {
    const relationships = this.creationExtractor.extractCreationRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapCreationType(rel.type)
    }));
  }

  extractDependencyRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'use' | 'extern_crate' | 'mod' | 'macro_use' | 'macro_export';
  }> {
    const relationships = this.dependencyExtractor.extractDependencyRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapDependencyType(rel.type)
    }));
  }

  extractReferenceRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'read' | 'write' | 'declaration' | 'usage' | 'field' | 'method' | 'module' | 'type';
  }> {
    const relationships = this.referenceExtractor.extractReferenceRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapReferenceType(rel.type)
    }));
  }

  // 新的类型映射辅助方法

  private mapAnnotationType(type: string): 'attribute' | 'derive' | 'macro' | 'doc_comment' {
    switch (type) {
      case 'attribute': return 'attribute';
      case 'derive': return 'derive';
      case 'macro': return 'macro';
      case 'doc_comment': return 'doc_comment';
      default: return 'attribute';
    }
  }

  private mapCreationType(type: string): 'instantiation' | 'enum_creation' | 'closure' | 'function_object' | 'iterator' | 'collection' {
    switch (type) {
      case 'instantiation': return 'instantiation';
      case 'enum_creation': return 'enum_creation';
      case 'closure': return 'closure';
      case 'function_object': return 'function_object';
      case 'iterator': return 'iterator';
      case 'collection': return 'collection';
      default: return 'instantiation';
    }
  }

  private mapDependencyType(type: string): 'use' | 'extern_crate' | 'mod' | 'macro_use' | 'macro_export' {
    switch (type) {
      case 'use': return 'use';
      case 'extern_crate': return 'extern_crate';
      case 'mod': return 'mod';
      case 'macro_use': return 'macro_use';
      case 'macro_export': return 'macro_export';
      default: return 'use';
    }
  }

  private mapReferenceType(type: string): 'read' | 'write' | 'declaration' | 'usage' | 'field' | 'method' | 'module' | 'type' {
    switch (type) {
      case 'read': return 'read';
      case 'write': return 'write';
      case 'declaration': return 'declaration';
      case 'usage': return 'usage';
      case 'field': return 'field';
      case 'method': return 'method';
      case 'module': return 'module';
      case 'type': return 'type';
      default: return 'usage';
    }
  }

  // 类型映射辅助方法
  private mapRustCallTypeToBaseType(rustType: string): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' {
    switch (rustType) {
      case 'function': return 'function';
      case 'method': return 'method';
      case 'macro': return 'function';
      case 'async': return 'function';
      case 'closure': return 'callback';
      case 'trait': return 'method';
      default: return 'function';
    }
  }

  private mapRustDataFlowTypeToBaseType(rustType: string): 'assignment' | 'parameter' | 'return' {
    switch (rustType) {
      case 'assignment': return 'assignment';
      case 'parameter': return 'parameter';
      case 'return': return 'return';
      case 'capture': return 'assignment';
      case 'move': return 'assignment';
      case 'borrow': return 'assignment';
      case 'reference': return 'assignment';
      default: return 'assignment';
    }
  }

  private mapRustInheritanceTypeToBaseType(rustType: string): 'class' | 'interface' | 'extends' | 'implements' {
    switch (rustType) {
      case 'trait_impl': return 'implements';
      case 'trait_bound': return 'interface';
      case 'trait_inheritance': return 'extends';
      case 'struct_composition': return 'class';
      default: return 'implements';
    }
  }

  private mapRustConcurrencyTypeToBaseType(rustType: string): 'synchronizes' | 'locks' | 'communicates' | 'races' {
    switch (rustType) {
      case 'thread_spawn': return 'synchronizes';
      case 'channel_comm': return 'communicates';
      case 'mutex_lock': return 'locks';
      case 'async_await': return 'synchronizes';
      case 'atomic_op': return 'synchronizes';
      case 'shared_state': return 'races';
      default: return 'synchronizes';
    }
  }

  private mapRustLifecycleTypeToBaseType(rustType: string): 'instantiates' | 'initializes' | 'destroys' | 'manages' {
    switch (rustType) {
      case 'lifetime_annotation': return 'manages';
      case 'lifetime_bound': return 'manages';
      case 'lifetime_subtyping': return 'manages';
      case 'static_lifetime': return 'manages';
      case 'elided_lifetime': return 'manages';
      default: return 'manages';
    }
  }

  private mapRustSemanticTypeToBaseType(rustType: string): 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures' {
    switch (rustType) {
      case 'overrides': return 'overrides';
      case 'overloads': return 'overloads';
      case 'delegates': return 'delegates';
      case 'observes': return 'observes';
      case 'configures': return 'configures';
      case 'implements': return 'delegates';
      case 'specializes': return 'overrides';
      default: return 'delegates';
    }
  }

  private mapRustControlFlowTypeToBaseType(rustType: string): 'conditional' | 'loop' | 'exception' | 'callback' {
    switch (rustType) {
      case 'conditional': return 'conditional';
      case 'loop': return 'loop';
      case 'exception': return 'exception';
      case 'callback': return 'callback';
      case 'branch': return 'conditional';
      case 'iteration': return 'loop';
      default: return 'conditional';
    }
  }
}