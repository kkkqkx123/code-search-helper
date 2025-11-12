import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
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
  CppHelperMethods,
  CPP_NODE_TYPE_MAPPING,
  CPP_QUERY_TYPE_MAPPING,
  CPP_SUPPORTED_QUERY_TYPES,
  CPP_NAME_CAPTURES,
  CPP_BLOCK_NODE_TYPES,
  CPP_MODIFIERS,
  CPP_COMPLEXITY_KEYWORDS
} from './cpp-utils';
type StandardType = StandardizedQueryResult['type'];

/**
 * C++ 语言适配器
 * 专门处理C++语言的查询结果标准化
 */
export class CppLanguageAdapter extends BaseLanguageAdapter {
  // In-memory symbol table for the current file
  private symbolTable: SymbolTable | null = null;

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

  getSupportedQueryTypes(): string[] {
    return CPP_SUPPORTED_QUERY_TYPES;
  }

  mapNodeType(nodeType: string): string {
    return CPP_NODE_TYPE_MAPPING[nodeType] || nodeType;
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    for (const captureName of CPP_NAME_CAPTURES) {
      const capture = result.captures?.find((c: any) => c.name === captureName);
      if (capture?.node?.text) {
        return capture.node.text;
      }
    }

    // 如果没有找到名称捕获，尝试从主节点提取
    if (result.captures?.[0]?.node?.childForFieldName?.('name')?.text) {
      return result.captures[0].node.childForFieldName('name').text;
    }

    // 对于C++，尝试从特定字段提取名称
    const mainNode = result.captures?.[0]?.node;
    if (mainNode) {
      // 尝试获取标识符
      const identifier = mainNode.childForFieldName?.('identifier') ||
        mainNode.childForFieldName?.('type_identifier') ||
        mainNode.childForFieldName?.('field_identifier') ||
        mainNode.childForFieldName?.('namespace_identifier');
      if (identifier?.text) {
        return identifier.text;
      }

      // 尝试获取name字段
      const nameNode = mainNode.childForFieldName?.('name');
      if (nameNode?.text) {
        return nameNode.text;
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

    // 提取模板参数
    const templateParameters = mainNode.childForFieldName?.('parameters');
    if (templateParameters) {
      extra.hasTemplate = true;
      extra.templateParameters = templateParameters.text;
    }

    // 提取继承信息
    const baseClassClause = mainNode.childForFieldName?.('base_class_clause');
    if (baseClassClause) {
      extra.hasInheritance = true;
      extra.baseClasses = baseClassClause.text;
    }

    // 提取参数信息（对于函数）
    const parameters = mainNode.childForFieldName?.('parameters');
    if (parameters) {
      extra.parameterCount = parameters.childCount;
    }

    // 提取返回类型
    const returnType = mainNode.childForFieldName?.('type');
    if (returnType) {
      extra.returnType = returnType.text;
    }

    // 提取访问修饰符
    const accessSpecifier = mainNode.childForFieldName?.('access_specifier');
    if (accessSpecifier) {
      extra.accessModifier = accessSpecifier.text;
    }

    // 提取异常规范
    const exceptionSpec = mainNode.childForFieldName?.('throw_specifier') ||
      mainNode.childForFieldName?.('noexcept_specifier');
    if (exceptionSpec) {
      extra.exceptionSpec = exceptionSpec.text;
    }

    // 提取概念约束
    const requiresClause = mainNode.childForFieldName?.('requires_clause');
    if (requiresClause) {
      extra.constraints = requiresClause.text;
    }

    // 检查是否是Lambda表达式
    if (mainNode.type === 'lambda_expression') {
      extra.isLambda = true;
    }

    // 检查是否是协程
    const text = mainNode.text || '';
    if (text.includes('co_await') || text.includes('co_yield') || text.includes('co_return')) {
      extra.isCoroutine = true;
    }

    return extra;
  }

  mapQueryTypeToStandardType(queryType: string): StandardType {
    return CPP_QUERY_TYPE_MAPPING[queryType] as StandardType || 'expression';
  }

  calculateComplexity(result: any): number {
    let complexity = this.calculateBaseComplexity(result);

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return complexity;
    }

    // 基于节点类型增加复杂度
    const nodeType = mainNode.type;
    if (nodeType.includes('class') || nodeType.includes('struct')) complexity += 2;
    if (nodeType.includes('function') || nodeType.includes('method')) complexity += 1;
    if (nodeType.includes('template')) complexity += 2;
    if (nodeType.includes('operator')) complexity += 1;
    if (nodeType.includes('data-flow')) complexity += 2;
    if (nodeType.includes('semantic-relationship')) complexity += 3;
    if (nodeType.includes('lifecycle-relationship')) complexity += 3;
    if (nodeType.includes('concurrency-relationship')) complexity += 3;

    // C++特定的复杂度因素
    const text = mainNode.text || '';
    for (const keyword of CPP_COMPLEXITY_KEYWORDS) {
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
    CppHelperMethods.findTypeReferences(mainNode, dependencies);
    CppHelperMethods.findFunctionCalls(mainNode, dependencies);
    CppHelperMethods.findTemplateDependencies(mainNode, dependencies);
    CppHelperMethods.findDataFlowDependencies(mainNode, dependencies);
    CppHelperMethods.findConcurrencyDependencies(mainNode, dependencies);

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return modifiers;
    }

    // 检查C++常见的修饰符
    const text = mainNode.text || '';

    for (const modifier of CPP_MODIFIERS) {
      if (modifier === 'coroutine') {
        if (text.includes('co_await') || text.includes('co_yield') || text.includes('co_return')) {
          modifiers.push(modifier);
        }
      } else if (modifier === 'public' || modifier === 'private' || modifier === 'protected') {
        if (text.includes(`${modifier}:`)) {
          modifiers.push(modifier);
        }
      } else if (text.includes(modifier)) {
        modifiers.push(modifier);
      }
    }

    return modifiers;
  }

  // 高级关系提取方法 - 委托给专门的提取器
  extractAnnotationRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'struct_tag' | 'comment' | 'directive';
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
    type: 'struct_instance' | 'slice' | 'map' | 'channel' | 'function' | 'goroutine_instance';
  }> {
    const relationships = this.creationExtractor.extractCreationRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapCreationType(rel.type)
    }));
  }

  extractReferenceRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'read' | 'write' | 'declaration' | 'usage';
  }> {
    const relationships = this.referenceExtractor.extractReferenceRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapReferenceType(rel.type)
    }));
  }

  extractDependencyRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'import' | 'package' | 'qualified_identifier';
  }> {
    const relationships = this.dependencyExtractor.extractDependencyRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapDependencyType(rel.type)
    }));
  }

  extractDataFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'assignment' | 'parameter' | 'return';
  }> {
    return this.dataFlowExtractor.extractDataFlowRelationships(result);
  }

  extractControlFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'conditional' | 'loop' | 'exception' | 'callback';
  }> {
    return this.controlFlowExtractor.extractControlFlowRelationships(result);
  }

  extractSemanticRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
  }> {
    return this.semanticExtractor.extractSemanticRelationships(result);
  }

  extractLifecycleRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'instantiates' | 'initializes' | 'destroys' | 'manages';
  }> {
    return this.lifecycleExtractor.extractLifecycleRelationships(result);
  }

  extractConcurrencyRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'synchronizes' | 'locks' | 'communicates' | 'races';
  }> {
    return this.concurrencyExtractor.extractConcurrencyRelationships(result);
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

  private mapReferenceType(type: string): 'read' | 'write' | 'declaration' | 'usage' {
    switch (type) {
      case 'read': return 'read';
      case 'write': return 'write';
      case 'declaration': return 'declaration';
      case 'usage': return 'usage';
      default: return 'usage';
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

  // 重写isBlockNode方法以支持C++特定的块节点类型
  protected isBlockNode(node: any): boolean {
    return CPP_BLOCK_NODE_TYPES.includes(node.type) || super.isBlockNode(node);
  }

  // 重写normalize方法以集成nodeId生成和符号信息
  async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
    const results: StandardizedQueryResult[] = [];
    const processingStartTime = Date.now();

    // Initialize symbol table for the current processing context
    // In a real scenario, filePath would be passed in. For now, we'll use a placeholder.
    const filePath = 'current_file.cpp';
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
        this.logger?.error(`Error normalizing C++ result: ${error}`);
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
      if (current.type === 'function_definition') {
        return 'function';
      }
      if (current.type === 'class_specifier' || current.type === 'struct_specifier') {
        return 'class';
      }
      current = current.parent;
    }
    return 'global';
  }

  private extractParameters(node: Parser.SyntaxNode): string[] {
    const parameters: string[] = [];
    const parameterList = node.childForFieldName?.('parameters');
    if (parameterList) {
      for (const child of parameterList.children) {
        if (child.type === 'parameter_declaration') {
          const declarator = child.childForFieldName('declarator');
          if (declarator?.text) {
            parameters.push(declarator.text);
          }
        }
      }
    }
    return parameters;
  }

  private extractImportPath(node: Parser.SyntaxNode): string | undefined {
    // For C++ includes
    if (node.type === 'preproc_include') {
      const pathNode = node.childForFieldName('path');
      return pathNode ? pathNode.text.replace(/[<>"]/g, '') : undefined;
    }
    return undefined;
  }

  /**
   * 检查是否为关系类型
   */
  private isRelationshipType(type: string): boolean {
    const relationshipTypes = ['call', 'data-flow', 'inheritance', 'concurrency', 'lifecycle', 'semantic', 'control-flow', 'dependency', 'reference', 'creation', 'annotation'];
    return relationshipTypes.includes(type);
  }

  private extractRelationshipMetadata(result: any, standardType: string, astNode: Parser.SyntaxNode | undefined): any {
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
  }
}