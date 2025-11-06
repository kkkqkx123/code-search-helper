import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult, SymbolInfo, SymbolTable } from '../types';
type StandardType = StandardizedQueryResult['type'];
import { generateDeterministicNodeId } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

// 导入C语言工具模块
import {
  CHelperMethods,
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
  C_SUPPORTED_QUERY_TYPES,
  C_QUERY_TYPE_MAPPING,
  C_NODE_TYPE_MAPPING
} from './c-utils';

/**
 * C 语言适配器
 * 专门处理C语言的查询结果标准化
 */
export class CLanguageAdapter extends BaseLanguageAdapter {
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
    return C_SUPPORTED_QUERY_TYPES;
  }

  mapNodeType(nodeType: string): string {
    return C_NODE_TYPE_MAPPING[nodeType] || nodeType;
  }

  extractName(result: any): string {
    return CHelperMethods.extractName(result);
  }

  extractLanguageSpecificMetadata(result: any): Record<string, any> {
    return CHelperMethods.extractLanguageSpecificMetadata(result);
  }

  mapQueryTypeToStandardType(queryType: string): StandardType {
    const mapping: Record<string, StandardType> = C_QUERY_TYPE_MAPPING as Record<string, StandardType>;
    return mapping[queryType] || 'expression';
  }

  calculateComplexity(result: any): number {
    const baseComplexity = this.calculateBaseComplexity(result);
    return CHelperMethods.calculateComplexity(result, baseComplexity);
  }

  extractDependencies(result: any): string[] {
    const dependencies: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return dependencies;
    }

    // 查找类型引用
    CHelperMethods.findTypeReferences(mainNode, dependencies);

    // 查找函数调用引用
    CHelperMethods.findFunctionCalls(mainNode, dependencies);

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    return CHelperMethods.extractModifiers(result);
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

  // 重写normalize方法以集成nodeId生成和符号信息
  async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
    const results: StandardizedQueryResult[] = [];

    // Initialize symbol table for the current processing context
    // In a real scenario, filePath would be passed in. For now, we'll use a placeholder.
    const filePath = 'current_file.c';
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
        const nodeId = astNode ? generateDeterministicNodeId(astNode) : `${standardType}:${name}:${Date.now()}`;

        let symbolInfo: SymbolInfo | null = null;
        let relationshipMetadata: any = null;

        // Only create symbol info for entity types, not relationships
        if (['function', 'class', 'method', 'variable', 'import', 'union', 'enum'].includes(standardType)) {
          symbolInfo = CHelperMethods.createSymbolInfo(astNode, name, standardType, filePath);
          if (this.symbolTable && symbolInfo) {
            this.symbolTable.globalScope.symbols.set(name, symbolInfo);
          }
        } else {
          // For relationships, extract specific metadata
          relationshipMetadata = this.extractRelationshipMetadata(result, standardType, astNode);
        }

        results.push({
          nodeId,
          type: standardType,
          name,
          startLine: result.startLine || 1,
          endLine: result.endLine || 1,
          content,
          metadata: {
            language,
            complexity,
            dependencies,
            modifiers,
            extra: {
              ...extra,
              ...relationshipMetadata // Merge relationship-specific metadata
            }
          },
          symbolInfo: symbolInfo || undefined
        });
      } catch (error) {
        this.logger?.error(`Error normalizing C language result: ${error}`);
      }
    }

    return results;
  }

  private extractRelationshipMetadata(result: any, standardType: string, astNode: Parser.SyntaxNode | undefined): any {
    if (!astNode) return null;

    try {
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
    } catch (error) {
      this.logger?.error(`Error extracting ${standardType} relationship metadata:`, error);
      return null;
    }
  }

  // 重写isBlockNode方法以支持C语言特定的块节点类型
  protected isBlockNode(node: any): boolean {
    return CHelperMethods.isBlockNode(node) || super.isBlockNode(node);
  }
}