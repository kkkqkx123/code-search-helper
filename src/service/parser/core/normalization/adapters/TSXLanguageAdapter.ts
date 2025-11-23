import { TypeScriptLanguageAdapter } from './TypeScriptLanguageAdapter';
import { AdapterOptions } from './base/BaseLanguageAdapter';
import { JS_SUPPORTED_QUERY_TYPES } from './js-utils';

/**
 * TSX语言适配器
 * 处理TSX特定的查询结果标准化
 * 继承TypeScriptLanguageAdapter并添加TSX特有功能
 */
export class TSXLanguageAdapter extends TypeScriptLanguageAdapter {
  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  getSupportedQueryTypes(): string[] {
    // 基于JavaScript支持的查询类型，添加TSX特定的类型
    return [
      ...JS_SUPPORTED_QUERY_TYPES,
      'components',
      'jsx',
      'types-hooks',
      'annotation-relationships',
      'creation-relationships',
      'reference-relationships',
      'dependency-relationships'
    ];
  }

  mapNodeType(nodeType: string): string {
    // 调用父类方法处理基础映射
    const baseMapping = super.mapNodeType(nodeType);

    // 添加TSX特有的类型映射
    const tsxTypeMapping: Record<string, string> = {
      'jsx_element': 'jsx-element',
      'jsx_self_closing_element': 'jsx-element',
      'jsx_fragment': 'jsx-fragment',
      'jsx_attribute': 'jsx-attribute',
      'jsx_expression': 'jsx-expression'
    };

    return tsxTypeMapping[nodeType] || baseMapping;
  }

  extractName(result: any): string {
    // 先调用父类方法处理基础名称提取
    const baseName = super.extractName(result);

    // 如果父类找到了名称，直接返回
    if (baseName !== 'unnamed') {
      return baseName;
    }

    // 添加TSX特有的名称捕获
    const tsxNameCaptures = [
      'definition.jsx_element',
      'definition.jsx_self_closing_element',
      'definition.jsx_fragment',
      'definition.jsx_attribute',
      'definition.jsx_expression',
      'definition.component'
    ];

    for (const captureName of tsxNameCaptures) {
      const capture = result.captures?.find((c: any) => c.name === captureName);
      if (capture?.node?.text) {
        return capture.node.text;
      }
    }

    return 'unnamed';
  }

  extractLanguageSpecificMetadata(result: any): Record<string, any> {
    // 先调用父类方法获取基础元数据
    const extra = super.extractLanguageSpecificMetadata(result);
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return extra;
    }

    // 添加TSX特有的元数据
    if (mainNode.type.includes('jsx')) {
      extra.isJSX = true;
      extra.jsxType = mainNode.type;
    }

    // 检查是否是React组件
    if (this.isReactComponent(mainNode)) {
      extra.isComponent = true;
    }

    return extra;
  }

  calculateComplexity(result: any): number {
    // 调用父类方法获取基础复杂度
    let complexity = super.calculateComplexity(result);

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return complexity;
    }

    // 添加TSX特有的复杂度因素
    const text = mainNode.text || '';
    if (text.includes('jsx') || text.includes('<')) complexity += 1; // JSX元素
    if (text.includes('React') || text.includes('Component')) complexity += 1; // React组件

    return complexity;
  }

  extractModifiers(result: any): string[] {
    // 调用父类方法获取基础修饰符
    const modifiers = super.extractModifiers(result);
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return modifiers;
    }

    // 添加TSX特有的修饰符
    const text = mainNode.text || '';

    if (text.includes('export default')) modifiers.push('default-export');

    return modifiers;
  }

  // TSX特定的辅助方法

  private isReactComponent(node: any): boolean {
    if (!node) {
      return false;
    }

    // 检查是否是React组件（首字母大写的函数或类）
    const text = node.text || '';
    return text.match(/^[A-Z][a-zA-Z0-9]*\s*=\s*(function|class)/) !== null;
  }

  // 重写isBlockNode方法以支持TSX特定的块节点类型
  protected isBlockNode(node: any): boolean {
    const tsxBlockTypes = ['jsx_element', 'jsx_self_closing_element', 'jsx_fragment'];
    return tsxBlockTypes.includes(node.type) || super.isBlockNode(node);
  }
}