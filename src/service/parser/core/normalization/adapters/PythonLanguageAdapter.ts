import { BaseLanguageAdapter, AdapterOptions } from './base/BaseLanguageAdapter';
import { StandardizedQueryResult, SymbolInfo, SymbolTable } from '../types';
import { NodeIdGenerator } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
import { MetadataBuilder } from '../utils/MetadataBuilder';
import {
  CallRelationshipExtractor,
  DataFlowRelationshipExtractor,
  ControlFlowRelationshipExtractor,
  SemanticRelationshipExtractor,
  LifecycleRelationshipExtractor,
  ConcurrencyRelationshipExtractor,
  AnnotationRelationshipExtractor,
  CreationRelationshipExtractor,
  DependencyRelationshipExtractor,
  InheritanceRelationshipExtractor,
  ReferenceRelationshipExtractor,
  PythonHelperMethods,
  PYTHON_NODE_TYPE_MAPPING,
  PYTHON_QUERY_TYPE_MAPPING,
  PYTHON_SUPPORTED_QUERY_TYPES,
  PYTHON_NAME_CAPTURES,
  PYTHON_BLOCK_NODE_TYPES,
  PYTHON_MODIFIERS,
  PYTHON_COMPLEXITY_KEYWORDS
} from './python-utils';
type StandardType = StandardizedQueryResult['type'];

/**
 * Python语言适配器
 * 处理Python特定的查询结果标准化
 */
export class PythonLanguageAdapter extends BaseLanguageAdapter {
  // In-memory symbol table for the current file
  private symbolTable: SymbolTable | null = null;

  // 关系提取器实例
  private callExtractor: CallRelationshipExtractor;
  private dataFlowExtractor: DataFlowRelationshipExtractor;
  private controlFlowExtractor: ControlFlowRelationshipExtractor;
  private semanticExtractor: SemanticRelationshipExtractor;
  private lifecycleExtractor: LifecycleRelationshipExtractor;
  private concurrencyExtractor: ConcurrencyRelationshipExtractor;
  private annotationExtractor: AnnotationRelationshipExtractor;
  private creationExtractor: CreationRelationshipExtractor;
  private dependencyExtractor: DependencyRelationshipExtractor;
  private inheritanceExtractor: InheritanceRelationshipExtractor;
  private referenceExtractor: ReferenceRelationshipExtractor;

  constructor(options: AdapterOptions = {}) {
    super(options);

    // 初始化关系提取器
    this.callExtractor = new CallRelationshipExtractor();
    this.dataFlowExtractor = new DataFlowRelationshipExtractor();
    this.controlFlowExtractor = new ControlFlowRelationshipExtractor();
    this.semanticExtractor = new SemanticRelationshipExtractor();
    this.lifecycleExtractor = new LifecycleRelationshipExtractor();
    this.concurrencyExtractor = new ConcurrencyRelationshipExtractor();
    this.annotationExtractor = new AnnotationRelationshipExtractor();
    this.creationExtractor = new CreationRelationshipExtractor();
    this.dependencyExtractor = new DependencyRelationshipExtractor();
    this.inheritanceExtractor = new InheritanceRelationshipExtractor();
    this.referenceExtractor = new ReferenceRelationshipExtractor();
  }

  getSupportedQueryTypes(): string[] {
    return PYTHON_SUPPORTED_QUERY_TYPES;
  }

  mapNodeType(nodeType: string): string {
    return PYTHON_NODE_TYPE_MAPPING[nodeType] || 'expression';
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    for (const captureName of PYTHON_NAME_CAPTURES) {
      const capture = result.captures?.find((c: any) => c.name === captureName);
      if (capture?.node?.text) {
        return capture.node.text;
      }
    }

    // 如果没有找到名称捕获，尝试从主节点提取
    if (result.captures?.[0]?.node?.childForFieldName('name')?.text) {
      return result.captures[0].node.childForFieldName('name').text;
    }

    return 'unnamed';
  }

  extractLanguageSpecificMetadata(result: any): Record<string, any> {
    const extra: Record<string, any> = {};
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return extra;
    }

    // 提取装饰器信息 - 检查捕获中的装饰器
    const capturedDecorators = result.captures?.filter((capture: any) =>
      capture.name === 'decorator' && capture.node?.text
    ).map((capture: any) => capture.node.text) || [];

    const nodeDecorators = PythonHelperMethods.extractDecorators(mainNode);
    const allDecorators = [...new Set([...capturedDecorators, ...nodeDecorators])]; // 合并并去重

    if (allDecorators.length > 0) {
      extra.decorators = allDecorators;
    }

    // 提取参数信息（对于函数）
    const parameters = mainNode.childForFieldName('parameters');
    if (parameters) {
      extra.parameterCount = parameters.childCount;
      extra.hasTypeHints = PythonHelperMethods.hasTypeHints(mainNode);
    }

    // 提取返回类型信息
    const returnType = PythonHelperMethods.extractReturnType(mainNode);
    if (returnType) {
      extra.hasReturnType = true;
      extra.returnType = returnType;
    }

    // 提取继承信息（对于类）
    const superclasses = PythonHelperMethods.extractSuperclasses(mainNode);
    if (superclasses.length > 0) {
      extra.hasInheritance = true;
      extra.superclasses = superclasses;
    }

    // 检查是否是异步函数
    if (PythonHelperMethods.isAsyncFunction(mainNode)) {
      extra.isAsync = true;
    }

    // 检查是否是生成器函数
    if (PythonHelperMethods.isGeneratorFunction(mainNode)) {
      extra.isGenerator = true;
    }

    return extra;
  }

  mapQueryTypeToStandardType(queryType: string): StandardType {
    return PYTHON_QUERY_TYPE_MAPPING[queryType] as StandardType || 'expression';
  }

  calculateComplexity(result: any): number {
    let complexity = this.calculateBaseComplexity(result);

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return complexity;
    }

    // 基于节点类型增加复杂度
    const nodeType = mainNode.type;
    if (nodeType.includes('class')) complexity += 2;
    if (nodeType.includes('function')) complexity += 1;
    if (nodeType.includes('async')) complexity += 1;
    if (nodeType.includes('decorated')) complexity += 1;

    // Python特有的复杂度因素
    const text = mainNode.text || '';
    for (const keyword of PYTHON_COMPLEXITY_KEYWORDS) {
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
    PythonHelperMethods.findImportDependencies(mainNode, dependencies);
    PythonHelperMethods.findFunctionCalls(mainNode, dependencies);
    PythonHelperMethods.findTypeReferences(mainNode, dependencies);
    PythonHelperMethods.findDataFlowDependencies(mainNode, dependencies);
    PythonHelperMethods.findConcurrencyDependencies(mainNode, dependencies);

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return modifiers;
    }

    // 检查装饰器 - 检查捕获中是否有装饰器
    const hasDecoratorCapture = result.captures?.some((capture: any) => capture.name === 'decorator' || capture.node?.type === 'decorator');
    if (hasDecoratorCapture || PythonHelperMethods.hasDecorators(mainNode)) {
      modifiers.push('decorated');
    }

    // 检查常见的修饰符
    const text = mainNode.text || '';
    for (const modifier of PYTHON_MODIFIERS) {
      if (text.includes(modifier)) {
        modifiers.push(modifier);
      }
    }

    // 检查类方法修饰符
    if (PythonHelperMethods.isClassMethod(mainNode)) {
      if (PythonHelperMethods.isStaticMethod(mainNode)) {
        modifiers.push('static');
      }
      if (PythonHelperMethods.isClassMethodDecorator(mainNode)) {
        modifiers.push('classmethod');
      }
      if (PythonHelperMethods.isPropertyMethod(mainNode)) {
        modifiers.push('property');
      }
    }

    return modifiers;
  }

  // Python特定的辅助方法

  private extractDecorators(node: any): string[] {
    const decorators: string[] = [];
    const decoratorsNode = node.children?.find((child: any) => child.type === 'decorators');

    if (decoratorsNode) {
      for (const child of decoratorsNode.children) {
        if (child.type === 'decorator' && child.text) {
          decorators.push(child.text.trim());
        }
      }
    }

    return decorators;
  }

  private hasDecorators(node: any): boolean {
    return node.children?.some((child: any) => child.type === 'decorators') || false;
  }

  private isClassMethod(node: any): boolean {
    // 检查是否是类方法（通过检查父节点是否是类定义）
    let parent = node.parent;
    while (parent) {
      if (parent.type === 'class_definition') {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  private isStaticMethod(node: any): boolean {
    const text = node.text || '';
    return text.includes('@staticmethod') || text.includes('@classmethod');
  }

  private isPropertyMethod(node: any): boolean {
    const text = node.text || '';
    return text.includes('@property');
  }

  private hasTypeHints(parameters: any): boolean {
    if (!parameters || !parameters.children) {
      return false;
    }

    return parameters.children.some((child: any) =>
      child.type === 'typed_parameter' || child.type === 'type_annotation'
    );
  }

  private extractSuperclassNames(superclasses: any): string[] {
    const names: string[] = [];

    if (superclasses && superclasses.children) {
      for (const child of superclasses.children) {
        if (child.type === 'identifier' || child.type === 'dotted_name') {
          names.push(child.text);
        }
      }
    }

    return names;
  }

  private findImportReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找导入引用
      if (child.type === 'identifier' || child.type === 'dotted_name') {
        dependencies.push(child.text);
      }

      this.findImportReferences(child, dependencies);
    }
  }

  private findFunctionCalls(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找函数调用
      if (child.type === 'call') {
        const functionNode = child.childForFieldName('function');
        if (functionNode?.text) {
          dependencies.push(functionNode.text);
        }
      }

      this.findFunctionCalls(child, dependencies);
    }
  }

  // 重写isBlockNode方法以支持Python特定的块节点类型
  protected isBlockNode(node: any): boolean {
    return PYTHON_BLOCK_NODE_TYPES.includes(node.type) || super.isBlockNode(node);
  }

  // 重写normalize方法以集成nodeId生成和符号信息
  async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
    const results: StandardizedQueryResult[] = [];
    const processingStartTime = Date.now();

    // Initialize symbol table for the current processing context
    // In a real scenario, filePath would be passed in. For now, we'll use a placeholder.
    const filePath = 'current_file.py';
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
        this.logger?.error(`Error normalizing Python result: ${error}`);
        // 使用 MetadataFactory 创建错误元数据
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

  /**
   * 检查是否为关系类型
   */
  private isRelationshipType(type: string): boolean {
    const relationshipTypes = ['call', 'data-flow', 'inheritance', 'concurrency', 'lifecycle', 'semantic', 'control-flow', 'dependency', 'reference', 'creation', 'annotation'];
    return relationshipTypes.includes(type);
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
      if (current.type === 'function_definition' || current.type === 'async_function_definition') {
        return 'function';
      }
      if (current.type === 'class_definition') {
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
        if (child.type === 'identifier') {
          parameters.push(child.text);
        }
      }
    }
    return parameters;
  }

  private extractImportPath(node: Parser.SyntaxNode): string | undefined {
    // For Python imports
    if (node.type === 'import_from_statement') {
      const moduleNode = node.childForFieldName('module_name');
      return moduleNode ? moduleNode.text : undefined;
    } else if (node.type === 'import_statement') {
      const moduleNode = node.childForFieldName('name');
      return moduleNode ? moduleNode.text : undefined;
    }
    return undefined;
  }

  private extractRelationshipMetadata(result: any, standardType: string, astNode: Parser.SyntaxNode | undefined): any {
    if (!astNode) return null;

    switch (standardType) {
      case 'call':
        return this.callExtractor.extractCallMetadata(result, astNode, this.symbolTable);
      case 'data-flow':
        return this.dataFlowExtractor.extractDataFlowMetadata(result, astNode, this.symbolTable);
      case 'control-flow':
        return this.controlFlowExtractor.extractControlFlowMetadata(result, astNode, this.symbolTable);
      case 'semantic':
        return this.semanticExtractor.extractSemanticMetadata(result, astNode, this.symbolTable);
      case 'lifecycle':
        return this.lifecycleExtractor.extractLifecycleMetadata(result, astNode, this.symbolTable);
      case 'concurrency':
        return this.concurrencyExtractor.extractConcurrencyMetadata(result, astNode, this.symbolTable);
      case 'annotation':
        return this.annotationExtractor.extractAnnotationMetadata(result, astNode, this.symbolTable);
      case 'creation':
        return this.creationExtractor.extractCreationMetadata(result, astNode, this.symbolTable);
      case 'dependency':
        return this.dependencyExtractor.extractDependencyMetadata(result, astNode, this.symbolTable);
      case 'inheritance':
        return this.inheritanceExtractor.extractInheritanceMetadata(result, astNode, this.symbolTable);
      case 'reference':
        return this.referenceExtractor.extractReferenceMetadata(result, astNode, this.symbolTable);
      default:
        return null;
    }
  }

  // 高级关系提取方法

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

  extractCallRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator';
  }> {
    return this.callExtractor.extractCallRelationships(result);
  }

  // 新增的关系提取方法

  extractAnnotationRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'decorator' | 'type_annotation' | 'docstring';
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
    type: 'instantiation' | 'function_object' | 'comprehension' | 'generator' | 'closure';
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
    type: 'import' | 'from_import' | 'relative_import' | 'wildcard_import';
  }> {
    const relationships = this.dependencyExtractor.extractDependencyRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapDependencyType(rel.type)
    }));
  }

  extractInheritanceRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'class_inheritance' | 'interface_implementation' | 'mixin' | 'protocol';
  }> {
    const relationships = this.inheritanceExtractor.extractInheritanceRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapInheritanceType(rel.type)
    }));
  }

  extractReferenceRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'read' | 'write' | 'declaration' | 'usage' | 'attribute' | 'import';
  }> {
    const relationships = this.referenceExtractor.extractReferenceRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map(rel => ({
      source: rel.source,
      target: rel.target,
      type: this.mapReferenceType(rel.type)
    }));
  }

  // 类型映射辅助方法

  private mapAnnotationType(type: string): 'decorator' | 'type_annotation' | 'docstring' {
    switch (type) {
      case 'decorator': return 'decorator';
      case 'type_annotation': return 'type_annotation';
      case 'docstring': return 'docstring';
      default: return 'decorator';
    }
  }

  private mapCreationType(type: string): 'instantiation' | 'function_object' | 'comprehension' | 'generator' | 'closure' {
    switch (type) {
      case 'instantiation': return 'instantiation';
      case 'function_object': return 'function_object';
      case 'comprehension': return 'comprehension';
      case 'generator': return 'generator';
      case 'closure': return 'closure';
      default: return 'instantiation';
    }
  }

  private mapDependencyType(type: string): 'import' | 'from_import' | 'relative_import' | 'wildcard_import' {
    switch (type) {
      case 'import': return 'import';
      case 'from_import': return 'from_import';
      case 'relative_import': return 'relative_import';
      case 'wildcard_import': return 'wildcard_import';
      default: return 'import';
    }
  }

  private mapInheritanceType(type: string): 'class_inheritance' | 'interface_implementation' | 'mixin' | 'protocol' {
    switch (type) {
      case 'class_inheritance': return 'class_inheritance';
      case 'interface_implementation': return 'interface_implementation';
      case 'mixin': return 'mixin';
      case 'protocol': return 'protocol';
      default: return 'class_inheritance';
    }
  }

  private mapReferenceType(type: string): 'read' | 'write' | 'declaration' | 'usage' | 'attribute' | 'import' {
    switch (type) {
      case 'read': return 'read';
      case 'write': return 'write';
      case 'declaration': return 'declaration';
      case 'usage': return 'usage';
      case 'attribute': return 'attribute';
      case 'import': return 'import';
      default: return 'usage';
    }
  }
}