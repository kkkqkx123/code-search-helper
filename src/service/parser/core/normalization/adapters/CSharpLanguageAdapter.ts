import { BaseLanguageAdapter, AdapterOptions } from './base/BaseLanguageAdapter';
import { StandardizedQueryResult } from '../types';
import {
  CSharpHelperMethods,
  CSHARP_SUPPORTED_QUERY_TYPES,
  CSHARP_QUERY_TYPE_MAPPING,
  CSHARP_NODE_TYPE_MAPPING,
  CSHARP_BLOCK_NODE_TYPES,
  CSHARP_COMPLEXITY_KEYWORDS,
  CSHARP_NAME_CAPTURES
} from './csharp-utils';
type StandardType = StandardizedQueryResult['type'];

/**
 * C# 语言适配器
 * 专门处理C#语言的查询结果标准化
 */
export class CSharpLanguageAdapter extends BaseLanguageAdapter {
  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  /**
   * 获取语言标识符
   */
  protected getLanguage(): string {
    return 'csharp';
  }

  /**
   * 获取语言扩展名
   */
  protected getLanguageExtension(): string {
    return 'cs';
  }

  getSupportedQueryTypes(): string[] {
    return CSHARP_SUPPORTED_QUERY_TYPES;
  }

  mapNodeType(nodeType: string): string {
    return CSHARP_NODE_TYPE_MAPPING[nodeType] || nodeType;
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    for (const captureName of CSHARP_NAME_CAPTURES) {
      const capture = result.captures?.find((c: any) => c.name === captureName);
      if (capture?.node?.text) {
        return capture.node.text;
      }
    }

    // 如果没有找到名称捕获，尝试从主节点提取
    if (result.captures?.[0]?.node?.childForFieldName?.('name')?.text) {
      return result.captures[0].node.childForFieldName('name').text;
    }

    // 对于C#，尝试从特定字段提取名称
    const mainNode = result.captures?.[0]?.node;
    if (mainNode) {
      // 尝试获取标识符
      const identifier = mainNode.childForFieldName?.('identifier') ||
        mainNode.childForFieldName?.('type_identifier');
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

    // 提取泛型参数
    const typeParameters = mainNode.childForFieldName?.('type_parameters');
    if (typeParameters) {
      extra.hasGenerics = true;
      extra.typeParameters = typeParameters.text;
    }

    // 提取继承信息
    const baseList = mainNode.childForFieldName?.('base_list');
    if (baseList) {
      extra.hasInheritance = true;
      extra.baseTypes = baseList.text;
    }

    // 提取参数信息（对于方法）
    const parameters = mainNode.childForFieldName?.('parameters');
    if (parameters) {
      extra.parameterCount = parameters.childCount;
    }

    // 提取返回类型
    const returnType = mainNode.childForFieldName?.('type');
    if (returnType) {
      extra.returnType = returnType.text;
    }

    // 提取约束信息
    const constraints = mainNode.childForFieldName?.('type_parameter_constraints_clause');
    if (constraints) {
      extra.constraints = constraints.text;
    }

    // 提取属性信息
    const attributeLists = mainNode.childForFieldName?.('attribute_list');
    if (attributeLists) {
      extra.hasAttributes = true;
      extra.attributes = attributeLists.text;
    }

    // 提取异步信息
    if (mainNode.text.includes('async')) {
      extra.isAsync = true;
    }

    // 检查是否是LINQ表达式
    if (mainNode.type === 'query_expression') {
      extra.isLinq = true;
    }

    // 检查是否是模式匹配
    if (mainNode.type === 'switch_expression' || mainNode.type === 'is_pattern_expression') {
      extra.isPatternMatching = true;
    }

    return extra;
  }

  mapQueryTypeToStandardType(queryType: string): StandardType {
    return CSHARP_QUERY_TYPE_MAPPING[queryType] as StandardType || 'expression';
  }

  calculateComplexity(result: any): number {
    let complexity = this.calculateBaseComplexity(result);

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return complexity;
    }

    // 基于节点类型增加复杂度
    const nodeType = mainNode.type;
    if (nodeType.includes('class') || nodeType.includes('interface') || nodeType.includes('struct')) complexity += 2;
    if (nodeType.includes('method') || nodeType.includes('constructor') || nodeType.includes('destructor')) complexity += 1;
    if (nodeType.includes('generic') || nodeType.includes('template')) complexity += 1;
    if (nodeType.includes('operator')) complexity += 1;
    if (nodeType.includes('linq') || nodeType.includes('query')) complexity += 2;
    if (nodeType.includes('pattern')) complexity += 1;

    // C#特定的复杂度因素
    const text = mainNode.text || '';
    for (const keyword of CSHARP_COMPLEXITY_KEYWORDS) {
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
    CSharpHelperMethods.findTypeReferences(mainNode, dependencies);
    CSharpHelperMethods.findMethodCalls(mainNode, dependencies);
    CSharpHelperMethods.findLinqDependencies(mainNode, dependencies);
    CSharpHelperMethods.findDataFlowDependencies(mainNode, dependencies);
    CSharpHelperMethods.findConcurrencyDependencies(mainNode, dependencies);

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return modifiers;
    }

    const text = mainNode.text || '';

    // Check for C# specific modifiers
    if (text.includes('public')) modifiers.push('public');
    if (text.includes('private')) modifiers.push('private');
    if (text.includes('protected')) modifiers.push('protected');
    if (text.includes('internal')) modifiers.push('internal');
    if (text.includes('static')) modifiers.push('static');
    if (text.includes('abstract')) modifiers.push('abstract');
    if (text.includes('virtual')) modifiers.push('virtual');
    if (text.includes('override')) modifiers.push('override');
    if (text.includes('sealed')) modifiers.push('sealed');
    if (text.includes('readonly')) modifiers.push('readonly');
    if (text.includes('const')) modifiers.push('const');
    if (text.includes('volatile')) modifiers.push('volatile');
    if (text.includes('extern')) modifiers.push('extern');
    if (text.includes('partial')) modifiers.push('partial');
    if (text.includes('async') || text.includes('await')) modifiers.push('async');
    if (text.includes('params')) modifiers.push('params');
    if (text.includes('ref')) modifiers.push('ref');
    if (text.includes('out')) modifiers.push('out');
    if (text.includes('in')) modifiers.push('in');

    return modifiers;
  }

  // 重写isBlockNode方法以支持C#特定的块节点类型
  protected isBlockNode = (node: any): boolean => {
    return CSHARP_BLOCK_NODE_TYPES.includes(node.type) || ((node: any) => {
      const blockNodeTypes = ['block', 'compound_statement', 'block_statement'];
      return blockNodeTypes.includes(node.type);
    })(node);
  };

  // 重写shouldCreateSymbolInfo以支持C#特定的符号类型
  protected shouldCreateSymbolInfo = (standardType: string): boolean => {
    const entityTypes = ['function', 'class', 'method', 'variable', 'import', 'interface', 'type', 'property'];
    return entityTypes.includes(standardType);
  };

  // 重写符号类型映射以支持C#特定的类型
  protected mapToSymbolType = (standardType: string): any => {
    const mapping: Record<string, any> = {
      'function': 'function',
      'method': 'method',
      'class': 'class',
      'interface': 'interface',
      'property': 'variable',
      'variable': 'variable',
      'import': 'import'
    };
    return mapping[standardType] || 'variable';
  };

  // 重写作用域确定方法以支持C#特定的作用域类型
  protected isFunctionScope = (node: any): boolean => {
    const csharpFunctionTypes = [
      'method_declaration', 'constructor_declaration', 'destructor_declaration', 'property_declaration'
    ];
    const baseFunctionTypes = [
      'function_declaration', 'function_expression', 'arrow_function',
      'method_definition', 'constructor_definition'
    ];
    return csharpFunctionTypes.includes(node.type) || baseFunctionTypes.includes(node.type);
  };

  protected isClassScope = (node: any): boolean => {
    const csharpClassTypes = [
      'class_declaration', 'struct_declaration', 'interface_declaration', 'enum_declaration', 'record_declaration'
    ];
    const baseClassTypes = [
      'class_declaration', 'class_definition', 'interface_declaration',
      'struct_specifier'
    ];
    return csharpClassTypes.includes(node.type) || baseClassTypes.includes(node.type);
  };
}