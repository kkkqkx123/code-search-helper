import { BaseLanguageAdapter, AdapterOptions } from './base/BaseLanguageAdapter';
import { StandardizedQueryResult } from '../types';
import { JsHelperMethods, JS_NODE_TYPE_MAPPING, JS_QUERY_TYPE_MAPPING, JS_SUPPORTED_QUERY_TYPES, JS_NAME_CAPTURES, JS_BLOCK_NODE_TYPES, JS_MODIFIERS, JS_COMPLEXITY_KEYWORDS } from './js-utils';
type StandardType = StandardizedQueryResult['type'];

/**
 * JavaScript语言适配器
 * 处理JavaScript特定的查询结果标准化
 */
export class JavaScriptLanguageAdapter extends BaseLanguageAdapter {
  
  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  /**
   * 获取语言标识符
   */
  protected getLanguage(): string {
    return 'javascript';
  }

  /**
   * 获取语言扩展名
   */
  protected getLanguageExtension(): string {
    return 'js';
  }

  getSupportedQueryTypes(): string[] {
    return JS_SUPPORTED_QUERY_TYPES;
  }

  mapNodeType(nodeType: string): string {
    return JS_NODE_TYPE_MAPPING[nodeType] || nodeType;
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    for (const captureName of JS_NAME_CAPTURES) {
      const capture = result.captures?.find((c: any) => c.name === captureName);
      if (capture?.node?.text) {
        return capture.node.text;
      }
    }

    // 如果没有找到名称捕获，尝试从主节点提取
    if (result.captures?.[0]?.node?.childForFieldName?.('name')?.text) {
      return result.captures[0].node.childForFieldName('name').text;
    }

    // 对于JavaScript，尝试从特定字段提取名称
    const mainNode = result.captures?.[0]?.node;
    if (mainNode) {
      // 尝试获取标识符
      const identifier = mainNode.childForFieldName?.('name') ||
        mainNode.childForFieldName?.('identifier') ||
        mainNode.childForFieldName?.('property_identifier');
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

    // 提取继承信息
    const heritageClause = mainNode.childForFieldName('heritage_clause');
    if (heritageClause) {
      extra.hasInheritance = true;
      extra.extends = heritageClause.text;
    }

    // 提取参数信息（对于函数）
    const parameters = mainNode.childForFieldName('parameters');
    if (parameters) {
      extra.parameterCount = parameters.childCount;
    }

    // 提取JSX相关信息
    if (this.isJSXElement(mainNode)) {
      extra.isJSX = true;
      extra.jsxType = mainNode.type;
    }

    return extra;
  }

  mapQueryTypeToStandardType(queryType: string): StandardType {
    return JS_QUERY_TYPE_MAPPING[queryType] as StandardType || 'expression';
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
    if (nodeType.includes('interface')) complexity += 1;

    // JavaScript特定的复杂度因素
    const text = mainNode.text || '';
    for (const keyword of JS_COMPLEXITY_KEYWORDS) {
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
    JsHelperMethods.findTypeReferences(mainNode, dependencies);
    JsHelperMethods.findFunctionCalls(mainNode, dependencies);
    JsHelperMethods.findImportDependencies(mainNode, dependencies);
    JsHelperMethods.findDataFlowDependencies(mainNode, dependencies);
    JsHelperMethods.findConcurrencyDependencies(mainNode, dependencies);
    JsHelperMethods.findInheritanceDependencies(mainNode, dependencies);
    JsHelperMethods.findInterfaceDependencies(mainNode, dependencies);
    JsHelperMethods.findTypeAliasDependencies(mainNode, dependencies);

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return modifiers;
    }

    // 检查JavaScript常见的修饰符
    const text = mainNode.text || '';

    for (const modifier of JS_MODIFIERS) {
      if (modifier === 'async' || modifier === 'export' || modifier === 'default' ||
        modifier === 'static' || modifier === 'public' || modifier === 'private' ||
        modifier === 'protected' || modifier === 'readonly' || modifier === 'abstract' ||
        modifier === 'override') {
        if (text.includes(modifier)) {
          modifiers.push(modifier);
        }
      }
    }

    return modifiers;
  }

  // JavaScript特定的辅助方法

  private isJSXElement(node: any): boolean {
    if (!node) {
      return false;
    }

    const jsxTypes = [
      'jsx_element',
      'jsx_self_closing_element',
      'jsx_fragment',
      'jsx_opening_element',
      'jsx_closing_element',
      'jsx_attribute'
    ];

    return jsxTypes.includes(node.type);
  }

  // 重写isBlockNode方法以支持JavaScript特定的块节点类型
  protected isBlockNode(node: any): boolean {
    return JS_BLOCK_NODE_TYPES.includes(node.type) || super.isBlockNode(node);
  }

  // 重写作用域确定方法以支持JavaScript特定的作用域类型
  protected isFunctionScope(node: any): boolean {
    const jsFunctionTypes = [
      'function_declaration', 'function_expression', 'arrow_function',
      'method_definition', 'constructor_definition'
    ];
    return jsFunctionTypes.includes(node.type) || super.isFunctionScope(node);
  }

  protected isClassScope(node: any): boolean {
    const jsClassTypes = [
      'class_declaration', 'class_definition', 'interface_declaration'
    ];
    return jsClassTypes.includes(node.type) || super.isClassScope(node);
  }

  // 重写导入路径提取以支持JavaScript特定的导入语法
  protected extractImportPath(node: any): string | undefined {
    // JavaScript特定的导入路径提取
    if (node.type === 'import_statement') {
      const pathNode = node.childForFieldName('source');
      return pathNode ? pathNode.text.replace(/['"]/g, '') : undefined;
    } else if (node.type === 'import_declaration') {
      const pathNode = node.childForFieldName('source');
      return pathNode ? pathNode.text.replace(/['"]/g, '') : undefined;
    }
    
    return super.extractImportPath(node);
  }
}