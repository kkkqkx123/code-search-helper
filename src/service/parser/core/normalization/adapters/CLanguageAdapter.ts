import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult, SymbolInfo, SymbolTable } from '../types';
type StandardType = StandardizedQueryResult['type'];
import { generateDeterministicNodeId } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

// 导入C语言工具模块
import {
  CHelperMethods,
  CCallRelationshipExtractor,
  CDataFlowRelationshipExtractor,
  CInheritanceRelationshipExtractor,
  CConcurrencyRelationshipExtractor,
  CLifecycleRelationshipExtractor,
  CSemanticRelationshipExtractor,
  CControlFlowRelationshipExtractor,
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
  private callExtractor: CCallRelationshipExtractor;
  private dataFlowExtractor: CDataFlowRelationshipExtractor;
  private inheritanceExtractor: CInheritanceRelationshipExtractor;
  private concurrencyExtractor: CConcurrencyRelationshipExtractor;
  private lifecycleExtractor: CLifecycleRelationshipExtractor;
  private semanticExtractor: CSemanticRelationshipExtractor;
  private controlFlowExtractor: CControlFlowRelationshipExtractor;

  constructor(options: AdapterOptions = {}) {
    super(options);
    
    // 初始化关系提取器
    this.callExtractor = new CCallRelationshipExtractor();
    this.dataFlowExtractor = new CDataFlowRelationshipExtractor();
    this.inheritanceExtractor = new CInheritanceRelationshipExtractor();
    this.concurrencyExtractor = new CConcurrencyRelationshipExtractor();
    this.lifecycleExtractor = new CLifecycleRelationshipExtractor();
    this.semanticExtractor = new CSemanticRelationshipExtractor();
    this.controlFlowExtractor = new CControlFlowRelationshipExtractor();
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
        case 'call':
          return this.callExtractor.extractCallMetadata(result, astNode, this.symbolTable);
        case 'data-flow':
          return this.dataFlowExtractor.extractDataFlowMetadata(result, astNode, this.symbolTable);
        case 'inheritance':
          return this.inheritanceExtractor.extractInheritanceMetadata(result, astNode, this.symbolTable);
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