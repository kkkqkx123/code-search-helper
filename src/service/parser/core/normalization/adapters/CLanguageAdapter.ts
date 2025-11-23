import { BaseLanguageAdapter, AdapterOptions } from './base/BaseLanguageAdapter';
import { StandardizedQueryResult } from '../types';
import {
  CHelperMethods,
  C_SUPPORTED_QUERY_TYPES,
  C_QUERY_TYPE_MAPPING,
  C_NODE_TYPE_MAPPING,
  QueryDispatcher
} from './c-utils';
type StandardType = StandardizedQueryResult['type'];

/**
 * C 语言适配器
 * 专门处理C语言的查询结果标准化
 */
export class CLanguageAdapter extends BaseLanguageAdapter {
  
  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  /**
   * 获取语言标识符
   */
  protected getLanguage(): string {
    return 'c';
  }

  /**
   * 获取语言扩展名
   */
  protected getLanguageExtension(): string {
    return 'c';
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

  // 重写isBlockNode以支持C语言特定的块节点类型
  protected isBlockNode = (node: any): boolean => {
    const baseIsBlockNode = (node: any): boolean => {
      const blockNodeTypes = ['block', 'compound_statement', 'block_statement'];
      return blockNodeTypes.includes(node.type);
    };
    return CHelperMethods.isBlockNode(node) || baseIsBlockNode(node);
  };

  // 重写符号信息创建以支持C语言特定的符号类型
  protected shouldCreateSymbolInfo = (standardType: string): boolean => {
    const entityTypes = ['function', 'class', 'method', 'variable', 'import', 'union', 'enum', 'struct'];
    return entityTypes.includes(standardType);
  };

  // 重写符号类型映射以支持C语言特定的类型
  protected mapToSymbolType = (standardType: string): any => {
    const mapping: Record<string, any> = {
      'function': 'function',
      'method': 'method',
      'class': 'class',
      'struct': 'class',
      'union': 'class',
      'enum': 'class',
      'interface': 'interface',
      'variable': 'variable',
      'import': 'import'
    };
    return mapping[standardType] || 'variable';
  };

  // 重写作用域确定方法以支持C语言特定的作用域类型
  protected isFunctionScope = (node: any): boolean => {
    const cFunctionTypes = [
      'function_definition', 'function_declaration'
    ];
    const baseFunctionTypes = [
      'function_declaration', 'function_expression', 'arrow_function',
      'method_definition', 'constructor_definition'
    ];
    return cFunctionTypes.includes(node.type) || baseFunctionTypes.includes(node.type);
  };

  protected isClassScope = (node: any): boolean => {
    const cStructTypes = [
      'struct_specifier', 'union_specifier', 'enum_specifier'
    ];
    const baseClassTypes = [
      'class_declaration', 'class_definition', 'interface_declaration',
      'struct_specifier', 'enum_specifier'
    ];
    return cStructTypes.includes(node.type) || baseClassTypes.includes(node.type);
  };

  // 重写符号信息创建以支持C语言特定的符号信息
  protected createSymbolInfo(
    node: any, 
    name: string, 
    standardType: string, 
    filePath: string
  ): any {
    const symbolInfo = super.createSymbolInfo(node, name, standardType, filePath);
    
    if (symbolInfo && CHelperMethods.createSymbolInfo) {
      // 使用C语言特定的符号信息创建方法
      const cSymbolInfo = CHelperMethods.createSymbolInfo(node, name, standardType, filePath);
      if (cSymbolInfo) {
        return { ...symbolInfo, ...cSymbolInfo };
      }
    }
    
    return symbolInfo;
  }
  
  /**
   * 处理查询分流 - 根据查询类型分发到相应的查询模式
   */
  processQueryWithDispatch(queryType: string, baseQuery: string): string {
    return QueryDispatcher.mergeQueries(baseQuery, queryType);
  }
}