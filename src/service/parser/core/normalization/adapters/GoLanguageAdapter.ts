import { BaseLanguageAdapter, AdapterOptions } from './base/BaseLanguageAdapter';
import { StandardizedQueryResult, SymbolInfo, SymbolTable } from '../types';
import { NodeIdGenerator } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
import { MetadataBuilder } from '../utils/MetadataBuilder';
import {
  AnnotationRelationshipExtractor,
  CallRelationshipExtractor,
  CreationRelationshipExtractor,
  DataFlowRelationshipExtractor,
  DependencyRelationshipExtractor,
  InheritanceRelationshipExtractor,
  ReferenceRelationshipExtractor,
  ConcurrencyRelationshipExtractor,
  LifecycleRelationshipExtractor,
  SemanticRelationshipExtractor,
  ControlFlowRelationshipExtractor,
  GoHelperMethods,
  GO_NODE_TYPE_MAPPING,
  GO_QUERY_TYPE_MAPPING,
  GO_SUPPORTED_QUERY_TYPES,
  GO_NAME_CAPTURES,
  GO_BLOCK_NODE_TYPES,
  GO_MODIFIERS,
  GO_COMPLEXITY_KEYWORDS,
  QueryDispatcher
} from './go-utils';
type StandardType = StandardizedQueryResult['type'];

/**
 * Go语言适配器
 * 处理Go特定的查询结果标准化
 */
export class GoLanguageAdapter extends BaseLanguageAdapter {
  // In-memory symbol table for the current file
  // Note: symbolTable is already defined in BaseLanguageAdapter as protected

  // 关系提取器实例
  private annotationExtractor: AnnotationRelationshipExtractor;
  private callExtractor: CallRelationshipExtractor;
  private creationExtractor: CreationRelationshipExtractor;
  private dataFlowExtractor: DataFlowRelationshipExtractor;
  private dependencyExtractor: DependencyRelationshipExtractor;
  private inheritanceExtractor: InheritanceRelationshipExtractor;
  private referenceExtractor: ReferenceRelationshipExtractor;
  private concurrencyExtractor: ConcurrencyRelationshipExtractor;
  private lifecycleExtractor: LifecycleRelationshipExtractor;
  private semanticExtractor: SemanticRelationshipExtractor;
  private controlFlowExtractor: ControlFlowRelationshipExtractor;

  constructor(options: AdapterOptions = {}) {
    super(options);

    // 初始化关系提取器
    this.annotationExtractor = new AnnotationRelationshipExtractor();
    this.callExtractor = new CallRelationshipExtractor();
    this.creationExtractor = new CreationRelationshipExtractor();
    this.dataFlowExtractor = new DataFlowRelationshipExtractor();
    this.dependencyExtractor = new DependencyRelationshipExtractor();
    this.inheritanceExtractor = new InheritanceRelationshipExtractor();
    this.referenceExtractor = new ReferenceRelationshipExtractor();
    this.concurrencyExtractor = new ConcurrencyRelationshipExtractor();
    this.lifecycleExtractor = new LifecycleRelationshipExtractor();
    this.semanticExtractor = new SemanticRelationshipExtractor();
    this.controlFlowExtractor = new ControlFlowRelationshipExtractor();
  }

  /**
   * 获取语言标识符
   */
  protected getLanguage(): string {
    return 'go';
  }

  /**
   * 获取语言扩展名
   */
  protected getLanguageExtension(): string {
    return 'go';
  }

  getSupportedQueryTypes(): string[] {
    return GO_SUPPORTED_QUERY_TYPES;
  }

  mapNodeType(nodeType: string): string {
    return GO_NODE_TYPE_MAPPING[nodeType] || 'variableDeclaration';
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    for (const captureName of GO_NAME_CAPTURES) {
      const capture = result.captures?.find((c: any) => c.name === captureName);
      if (capture?.node?.text) {
        return capture.node.text;
      }
    }

    // 如果没有找到名称捕获，尝试从主节点提取
    if (result.captures?.[0]?.node?.childForFieldName?.('name')?.text) {
      return result.captures[0].node.childForFieldName('name').text;
    }

    // 对于Go，尝试从特定字段提取名称
    const mainNode = result.captures?.[0]?.node;
    if (mainNode) {
      // 使用辅助方法提取名称
      const name = GoHelperMethods.extractNameFromNode(mainNode);
      if (name) {
        return name;
      }

      // 尝试获取name字段
      const nameNode = mainNode.childForFieldName?.('name');
      if (nameNode?.text) {
        return nameNode.text;
      }

      // For function declarations, try to get the name of the function
      if (mainNode.type === 'function_declaration') {
        // Look for the name identifier in the function declaration
        if (mainNode.children) {
          for (const child of mainNode.children) {
            if (child.type === 'identifier' && child.text) {
              return child.text;
            }
          }
        }
      }
    }

    return 'unnamed';
  }

  extractLanguageSpecificMetadata(result: any): Record<string, any> {
    const extra: Record<string, any> = {};
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return extra;
    }

    // 提取参数信息（对于函数）
    if (typeof mainNode.childForFieldName === 'function') {
      const parameters = mainNode.childForFieldName('parameters');
      if (parameters) {
        extra.parameterCount = parameters.childCount;
      }

      // 提取返回类型
      const returnType = mainNode.childForFieldName('type');
      if (returnType) {
        extra.returnType = returnType.text;
      }

      // 提取接收器（对于方法）
      const receiver = mainNode.childForFieldName('receiver');
      if (receiver) {
        extra.receiver = receiver.text;
        extra.isMethod = true;
      }

      // 提取嵌入式字段信息
      const type = mainNode.childForFieldName('type');
      if (type && mainNode.type === 'field_declaration') {
        extra.embedded = type.text;
      }

      // 提取类型参数
      const typeParameterList = mainNode.childForFieldName('type_parameter_list');
      if (typeParameterList) {
        extra.hasGeneric = true;
        extra.typeParameters = typeParameterList.text;
      }

      // 提取导出状态
      const nameNode = mainNode.childForFieldName('name');
      if (nameNode?.text && nameNode.text && /^[A-Z]/.test(nameNode.text)) {
        extra.isExported = true;
      }
    }

    // 检查是否是接口类型
    if (mainNode.type === 'interface_type') {
      extra.isInterface = true;
    }

    // 检查是否是结构体类型
    if (mainNode.type === 'struct_type') {
      extra.isStruct = true;
    }

    // 检查是否是方法（通过查看是否包含接收者）
    if (mainNode.type === 'method_declaration' || extra.receiver) {
      extra.isMethod = true;
    }

    // 检查是否是匿名函数
    if (mainNode.type === 'func_literal') {
      extra.isAnonymous = true;
    }

    // 检查是否是内置函数
    if (mainNode.type === 'call_expression') {
      const funcNode = mainNode.childForFieldName?.('function') ||
        mainNode.childForFieldName?.('name') ||
        (mainNode.children?.[0]?.type === 'identifier' ? mainNode.children[0] : null);
      if (funcNode && GoHelperMethods.isBuiltinFunction(funcNode.text)) {
        extra.isBuiltinCall = true;
      }
    }

    return extra;
  }

  mapQueryTypeToStandardType(queryType: string): StandardType {
    return GO_QUERY_TYPE_MAPPING[queryType] as StandardType || 'expression';
  }

  calculateComplexity(result: any): number {
    let complexity = this.calculateBaseComplexity(result);

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return complexity;
    }

    // 基于节点类型增加复杂度
    const nodeType = mainNode.type;
    if (nodeType.includes('function') || nodeType.includes('method')) complexity += 1;
    if (nodeType.includes('struct') || nodeType.includes('interface')) complexity += 1;
    if (nodeType.includes('type')) complexity += 1;

    // Go特定复杂度因素
    const text = this.extractContent(result);
    for (const keyword of GO_COMPLEXITY_KEYWORDS) {
      if (new RegExp(keyword.pattern).test(text)) {
        complexity += keyword.weight;
      }
    }

    return complexity;
  }

  extractDependencies(result: any): string[] {
    const dependencies: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return dependencies;
    }

    // 使用辅助方法查找依赖
    GoHelperMethods.findPackageDependencies(mainNode, dependencies);
    GoHelperMethods.findTypeReferences(mainNode, dependencies);
    GoHelperMethods.findFunctionCalls(mainNode, dependencies);
    GoHelperMethods.findDataFlowDependencies(mainNode, dependencies);
    GoHelperMethods.findConcurrencyDependencies(mainNode, dependencies);

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];

    // 使用extractContent方法获取内容，这样可以正确处理mock的情况
    const text = this.extractContent(result);

    // 使用预定义的修饰符列表
    for (const modifier of GO_MODIFIERS) {
      if (modifier === 'exported') {
        // 特殊处理导出标识符
        if (text.match(/\b[A-Z]\w*/)) {
          modifiers.push(modifier);
        }
      } else if (modifier === 'goroutine') {
        // 特殊处理goroutine
        if (text.includes('go ')) {
          modifiers.push(modifier);
        }
      } else if (modifier === 'channel') {
        // 特殊处理channel
        if (text.includes('<-')) {
          modifiers.push(modifier);
        }
      } else if (text.includes(modifier)) {
        modifiers.push(modifier);
      }
    }

    return modifiers;
  }

  // 高级关系提取方法 - 委托给专门的提取器
  async extractAnnotationRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'struct_tag' | 'comment' | 'directive';
  }>> {
    const relationships = this.annotationExtractor.extractAnnotationRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapAnnotationType(rel.type)
    }));
  }

  async extractCreationRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'struct_instance' | 'slice' | 'map' | 'channel' | 'function' | 'goroutine_instance';
  }>> {
    const relationships = this.creationExtractor.extractCreationRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapCreationType(rel.type)
    }));
  }

  async extractDataFlowRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'assignment' | 'parameter' | 'return';
  }>> {
    const relationships = this.dataFlowExtractor.extractDataFlowRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapDataFlowType(rel.type)
    }));
  }

  async extractDependencyRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'import' | 'package' | 'qualified_identifier';
  }>> {
    const relationships = this.dependencyExtractor.extractDependencyRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapDependencyType(rel.type)
    }));
  }

  async extractReferenceRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'read' | 'write' | 'declaration' | 'usage';
  }>> {
    const relationships = this.referenceExtractor.extractReferenceRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapReferenceType(rel.type)
    }));
  }

  async extractControlFlowRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'conditional' | 'loop' | 'exception' | 'callback';
  }>> {
    const relationships = this.controlFlowExtractor.extractControlFlowRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapControlFlowType(rel.type)
    }));
  }

  async extractSemanticRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
  }>> {
    const relationships = this.semanticExtractor.extractSemanticRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapSemanticType(rel.type)
    }));
  }

  async extractLifecycleRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'instantiates' | 'initializes' | 'destroys' | 'manages';
  }>> {
    const relationships = this.lifecycleExtractor.extractLifecycleRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapLifecycleType(rel.type)
    }));
  }

  async extractConcurrencyRelationships(result: any): Promise<Array<{
    source: string;
    target: string;
    type: 'synchronizes' | 'locks' | 'communicates' | 'races';
  }>> {
    const relationships = this.concurrencyExtractor.extractConcurrencyRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapConcurrencyType(rel.type)
    }));
  }

  // 类型映射辅助方法
  private mapAnnotationType(type: string): 'struct_tag' | 'comment' | 'directive' {
    switch (type) {
      case 'struct_tag': return 'struct_tag';
      case 'comment': return 'comment';
      case 'build_directive': return 'directive';
      default: return 'comment';
    }
  }

  private mapCreationType(type: string): 'struct_instance' | 'slice' | 'map' | 'channel' | 'function' | 'goroutine_instance' {
    switch (type) {
      case 'struct_instance': return 'struct_instance';
      case 'slice': return 'slice';
      case 'map': return 'map';
      case 'channel': return 'channel';
      case 'function': return 'function';
      case 'goroutine_instance': return 'goroutine_instance';
      case 'composite_literal': return 'struct_instance';
      case 'make_call': return 'slice';
      case 'new_call': return 'struct_instance';
      default: return 'struct_instance';
    }
  }

  private mapDataFlowType(type: string): 'assignment' | 'parameter' | 'return' {
    switch (type) {
      case 'variable_assignment': return 'assignment';
      case 'parameter_passing': return 'parameter';
      case 'return_value': return 'return';
      case 'field_access': return 'assignment';
      case 'channel_operation': return 'assignment';
      default: return 'assignment';
    }
  }

  private mapDependencyType(type: string): 'import' | 'package' | 'qualified_identifier' {
    switch (type) {
      case 'import': return 'import';
      case 'package': return 'package';
      case 'qualified_identifier': return 'qualified_identifier';
      default: return 'import';
    }
  }

  private mapReferenceType(type: string): 'read' | 'write' | 'declaration' | 'usage' {
    switch (type) {
      case 'read': return 'read';
      case 'write': return 'write';
      case 'declaration': return 'declaration';
      case 'usage': return 'usage';
      default: return 'usage';
    }
  }

  private mapControlFlowType(type: string): 'conditional' | 'loop' | 'exception' | 'callback' {
    switch (type) {
      case 'conditional': return 'conditional';
      case 'loop': return 'loop';
      case 'exception': return 'exception';
      case 'callback': return 'callback';
      case 'select': return 'exception';
      case 'switch': return 'conditional';
      case 'jump': return 'exception';
      default: return 'conditional';
    }
  }

  private mapSemanticType(type: string): 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures' {
    switch (type) {
      case 'overrides': return 'overrides';
      case 'overloads': return 'overloads';
      case 'delegates': return 'delegates';
      case 'observes': return 'observes';
      case 'configures': return 'configures';
      case 'implements': return 'configures';
      case 'decorates': return 'delegates';
      case 'composes': return 'delegates';
      default: return 'configures';
    }
  }

  private mapLifecycleType(type: string): 'instantiates' | 'initializes' | 'destroys' | 'manages' {
    switch (type) {
      case 'instantiates': return 'instantiates';
      case 'initializes': return 'initializes';
      case 'destroys': return 'destroys';
      case 'manages': return 'manages';
      case 'allocates': return 'instantiates';
      case 'releases': return 'destroys';
      default: return 'manages';
    }
  }

  private mapConcurrencyType(type: string): 'synchronizes' | 'locks' | 'communicates' | 'races' {
    switch (type) {
      case 'synchronizes': return 'synchronizes';
      case 'locks': return 'locks';
      case 'communicates': return 'communicates';
      case 'races': return 'races';
      case 'waits': return 'synchronizes';
      case 'coordinates': return 'communicates';
      default: return 'synchronizes';
    }
  }

  // 重写isBlockNode方法以支持Go特定的块节点类型
  protected isBlockNode = (node: any): boolean => {
    const baseBlockTypes = [
      'block', 'statement_block', 'class_body', 'interface_body', 'suite',
      'function_definition', 'method_definition', 'class_definition',
      'if_statement', 'for_statement', 'while_statement',
      'switch_statement', 'try_statement', 'catch_clause'
    ];
    return GO_BLOCK_NODE_TYPES.includes(node.type) || baseBlockTypes.includes(node.type);
  };


  // 重写normalize方法以集成nodeId生成和符号信息
  async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
    const results: StandardizedQueryResult[] = [];
    const processingStartTime = Date.now();

    // Initialize symbol table for the current processing context
    // In a real scenario, filePath would be passed in. For now, we'll use a placeholder.
    const filePath = 'current_file.go';
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
        this.logger?.error(`Error normalizing Go result: ${error}`);
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

  protected createSymbolInfo(node: Parser.SyntaxNode | undefined, name: string, standardType: string, filePath: string): SymbolInfo | null {
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

  protected mapToSymbolType = (standardType: string): 'function' | 'method' | 'class' | 'interface' | 'variable' | 'import' => {
    const mapping: Record<string, 'function' | 'method' | 'class' | 'interface' | 'variable' | 'import'> = {
      'function': 'function',
      'method': 'method',
      'class': 'class',
      'interface': 'interface',
      'variable': 'variable',
      'import': 'import'
    };
    return mapping[standardType] || 'variable';
  };

  protected determineScope = (node: Parser.SyntaxNode): 'global' | 'function' | 'class' => {
    // Simplified scope determination. A real implementation would traverse up the AST.
    let current = node.parent;
    while (current) {
      if (current.type === 'function_declaration' || current.type === 'method_declaration') {
        return 'function';
      }
      if (current.type === 'struct_type' || current.type === 'interface_type') {
        return 'class';
      }
      current = current.parent;
    }
    return 'global';
  };

  protected extractParameters = (node: Parser.SyntaxNode): string[] => {
    const parameters: string[] = [];
    const parameterList = node.childForFieldName?.('parameters');
    if (parameterList) {
      for (const child of parameterList.children) {
        if (child.type === 'parameter_declaration') {
          const identifier = child.childForFieldName('name');
          if (identifier) {
            parameters.push(identifier.text);
          }
        }
      }
    }
    return parameters;
  };

  protected extractImportPath = (node: Parser.SyntaxNode): string | undefined => {
    // For Go imports
    if (node.type === 'import_spec') {
      const pathNode = node.childForFieldName('path');
      return pathNode ? pathNode.text.replace(/"/g, '') : undefined;
    }
    return undefined;
  };

  /**
   * 检查是否为关系类型
   */
  protected isRelationshipType = (type: string): boolean => {
    const relationshipTypes = ['call', 'data-flow', 'inheritance', 'concurrency', 'lifecycle', 'semantic', 'control-flow', 'dependency', 'reference', 'creation', 'annotation'];
    return relationshipTypes.includes(type);
  };

  protected extractRelationshipMetadata = async (result: any, standardType: string, astNode: Parser.SyntaxNode | undefined): Promise<any> => {
    if (!astNode) return null;

    switch (standardType) {
      case 'annotation':
        return this.annotationExtractor.extractAnnotationMetadata(result, astNode, this.symbolTable);
      case 'call':
        return this.callExtractor.extractCallMetadata(result, astNode, this.symbolTable);
      case 'creation':
        return this.creationExtractor.extractCreationMetadata(result, astNode, this.symbolTable);
      case 'data-flow':
        return this.dataFlowExtractor.extractDataFlowMetadata(result, astNode, this.symbolTable);
      case 'dependency':
        return this.dependencyExtractor.extractDependencyMetadata(result, astNode, this.symbolTable);
      case 'inheritance':
        return this.inheritanceExtractor.extractInheritanceMetadata(result, astNode, this.symbolTable);
      case 'reference':
        return this.referenceExtractor.extractReferenceMetadata(result, astNode, this.symbolTable);
      case 'concurrency':
        return this.concurrencyExtractor.extractConcurrencyMetadata(result, astNode, this.symbolTable);
      case 'lifecycle':
        return this.lifecycleExtractor.extractLifecycleMetadata(result, astNode, this.symbolTable);
      case 'semantic':
        return this.semanticExtractor.extractSemanticMetadata(result, astNode, this.symbolTable);
      case 'control-flow':
        return this.controlFlowExtractor.extractControlFlowMetadata(result, astNode, this.symbolTable);
      default:
        return null;
    }
  };

  private findCallerFunctionContext(callNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let current = callNode.parent;
    while (current) {
      if (current.type === 'function_declaration' || current.type === 'method_declaration') {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * 处理查询分流 - 根据查询类型分发到相应的查询模式
   */
  processQueryWithDispatch(queryType: string, baseQuery: string): string {
    return QueryDispatcher.mergeQueries(baseQuery, queryType);
  }
}