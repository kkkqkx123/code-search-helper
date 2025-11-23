import { BaseLanguageAdapter, AdapterOptions } from './base/BaseLanguageAdapter';
import { StandardizedQueryResult } from '../types';
import {
  CppHelperMethods,
  CPP_SUPPORTED_QUERY_TYPES,
  CPP_QUERY_TYPE_MAPPING,
  CPP_NODE_TYPE_MAPPING,
  CPP_BLOCK_NODE_TYPES,
  CPP_COMPLEXITY_KEYWORDS,
  CPP_NAME_CAPTURES
} from './cpp-utils';
type StandardType = StandardizedQueryResult['type'];

/**
 * C++ 语言适配器
 * 专门处理C++语言的查询结果标准化
 */
export class CppLanguageAdapter extends BaseLanguageAdapter {
  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  /**
   * 获取语言标识符
   */
  protected getLanguage(): string {
    return 'cpp';
  }

  /**
   * 获取语言扩展名
   */
  protected getLanguageExtension(): string {
    return 'cpp';
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

    const text = mainNode.text || '';

    // Check for C++ specific modifiers
    if (text.includes('static')) modifiers.push('static');
    if (text.includes('virtual')) modifiers.push('virtual');
    if (text.includes('const')) modifiers.push('const');
    if (text.includes('volatile')) modifiers.push('volatile');
    if (text.includes('inline')) modifiers.push('inline');
    if (text.includes('extern')) modifiers.push('extern');
    if (text.includes('friend')) modifiers.push('friend');
    if (text.includes('explicit')) modifiers.push('explicit');
    if (text.includes('mutable')) modifiers.push('mutable');
    if (text.includes('noexcept')) modifiers.push('noexcept');
    if (text.includes('constexpr')) modifiers.push('constexpr');
    if (text.includes('public:')) modifiers.push('public');
    if (text.includes('private:')) modifiers.push('private');
    if (text.includes('protected:')) modifiers.push('protected');
    if (text.includes('co_await') || text.includes('co_yield') || text.includes('co_return')) {
      modifiers.push('coroutine');
    }

    return modifiers;
  }

  // 重写isBlockNode方法以支持C++特定的块节点类型
  protected isBlockNode = (node: any): boolean => {
    return CPP_BLOCK_NODE_TYPES.includes(node.type) || ((node: any) => {
      const blockNodeTypes = ['block', 'compound_statement', 'block_statement'];
      return blockNodeTypes.includes(node.type);
    })(node);
  };

  // 重写shouldCreateSymbolInfo以支持C++特定的符号类型
  protected shouldCreateSymbolInfo = (standardType: string): boolean => {
    const entityTypes = ['function', 'class', 'method', 'variable', 'import', 'template', 'namespace'];
    return entityTypes.includes(standardType);
  };

  // 重写符号类型映射以支持C++特定的类型
  protected mapToSymbolType = (standardType: string): any => {
    const mapping: Record<string, any> = {
      'function': 'function',
      'method': 'method',
      'class': 'class',
      'template': 'class',
      'namespace': 'class',
      'interface': 'interface',
      'variable': 'variable',
      'import': 'import'
    };
    return mapping[standardType] || 'variable';
  };

  // 重写作用域确定方法以支持C++特定的作用域类型
  protected isFunctionScope = (node: any): boolean => {
    const cppFunctionTypes = [
      'function_definition', 'function_declaration', 'lambda_expression'
    ];
    const baseFunctionTypes = [
      'function_declaration', 'function_expression', 'arrow_function',
      'method_definition', 'constructor_definition'
    ];
    return cppFunctionTypes.includes(node.type) || baseFunctionTypes.includes(node.type);
  };

  protected isClassScope = (node: any): boolean => {
    const cppClassTypes = [
      'class_specifier', 'struct_specifier', 'namespace_definition'
    ];
    const baseClassTypes = [
      'class_declaration', 'class_definition', 'interface_declaration',
      'struct_specifier'
    ];
    return cppClassTypes.includes(node.type) || baseClassTypes.includes(node.type);
  };
}