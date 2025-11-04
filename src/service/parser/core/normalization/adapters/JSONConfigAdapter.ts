/**
 * JSON配置语言适配器
 * 处理JSON配置文件的查询结果标准化
 */

import { ConfigLanguageAdapter, ConfigAdapterOptions } from '../ConfigLanguageAdapter';

/**
 * JSON配置语言适配器
 */
export class JSONConfigAdapter extends ConfigLanguageAdapter {
  constructor(options: ConfigAdapterOptions = {}) {
    super(options);
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      'name.definition.key',
      'name.definition',
      'definition.key',
      'definition.pair'
    ];

    for (const captureName of nameCaptures) {
      const capture = result.captures?.find((c: any) => c.name === captureName);
      if (capture?.node?.text) {
        return capture.node.text.replace(/"/g, ''); // 移除JSON字符串的引号
      }
    }

    // 如果没有找到名称捕获，尝试从主节点提取
    if (result.captures?.[0]?.node?.childForFieldName('key')?.text) {
      return result.captures[0].node.childForFieldName('key').text.replace(/"/g, '');
    }

    return 'unnamed';
  }

  extractLanguageSpecificMetadata(result: any): Record<string, any> {
    const extra: Record<string, any> = {};
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return extra;
    }

    // 提取JSON特有的元数据
    if (mainNode.type === 'object') {
      extra.isObject = true;
      extra.objectType = 'standard';
    }

    if (mainNode.type === 'array') {
      extra.isArray = true;
      extra.arrayLength = this.extractArrayLength(mainNode);
    }

    if (mainNode.type === 'pair') {
      extra.isPair = true;
      extra.valueType = this.extractValueType(mainNode);
    }

    // 提取嵌套深度信息
    extra.nestingLevel = this.calculateNestingLevel(mainNode);

    return extra;
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {
      'object': 'table',
      'array': 'array',
      'pair': 'config-item',
      'string': 'value',
      'number': 'value',
      'true': 'value',
      'false': 'value',
      'null': 'value'
    };

    return typeMapping[nodeType] || nodeType;
  }

  mapQueryTypeToStandardType(queryType: string): 'config-item' | 'section' | 'key' | 'value' | 'array' | 'table' | 'dependency' | 'type-def' {
    const mapping: Record<string, 'config-item' | 'section' | 'key' | 'value' | 'array' | 'table' | 'dependency' | 'type-def'> = {
      'config-items': 'config-item',
      'sections': 'section',
      'keys': 'key',
      'values': 'value',
      'arrays': 'array',
      'tables': 'table',
      'dependencies': 'dependency',
      'types': 'type-def'
    };

    return mapping[queryType] || 'config-item';
  }

  calculateComplexity(result: any): number {
    let complexity = 1;
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return complexity;
    }

    // 基于节点类型增加复杂度
    const nodeType = mainNode.type;
    if (nodeType === 'object') complexity += 2;
    if (nodeType === 'array') complexity += 1;
    if (nodeType === 'pair') complexity += 1;

    // 基于嵌套深度增加复杂度
    const nestingDepth = this.calculateNestingDepth(result);
    complexity += nestingDepth;

    // 基于子元素数量增加复杂度
    if (mainNode.children) {
      complexity += Math.min(mainNode.children.length / 2, 5); // 最多增加5点
    }

    return complexity;
  }

  extractDependencies(result: any): string[] {
    const dependencies: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return dependencies;
    }

    // JSON通常没有显式的依赖关系，但可以查找字符串中的URL或文件引用
    this.findStringReferences(mainNode, dependencies);

    return [...new Set(dependencies)];
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return modifiers;
    }

    const nodeType = mainNode.type;
    if (nodeType === 'object') modifiers.push('object');
    if (nodeType === 'array') modifiers.push('array');
    if (nodeType === 'pair') modifiers.push('key-value');

    return modifiers;
  }

  // JSON特定的辅助方法

  protected extractConfigPath(result: any): string {
    if (!this.options.enableConfigPathParsing) {
      return '';
    }

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return '';
    }

    // 构建JSON配置路径
    const pathParts: string[] = [];

    // 从当前节点向上遍历，构建路径
    let currentNode = mainNode;
    while (currentNode) {
      if (currentNode.type === 'pair') {
        const keyName = this.extractPairKey(currentNode);
        if (keyName) {
          pathParts.unshift(keyName);
        }
      }
      currentNode = currentNode.parent;
    }

    // 添加当前键名
    const keyName = this.extractName(result);
    if (keyName && keyName !== 'unnamed') {
      pathParts.push(keyName);
    }

    return pathParts.join('.');
  }

  protected extractDataType(result: any): string {
    if (!this.options.enableDataTypeInference) {
      return 'unknown';
    }

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return 'unknown';
    }

    // 基于节点类型推断数据类型
    switch (mainNode.type) {
      case 'string':
        return 'string';
      case 'number':
        return this.inferNumberType(mainNode);
      case 'true':
      case 'false':
        return 'boolean';
      case 'null':
        return 'null';
      case 'array':
        return 'array';
      case 'object':
        return 'object';
      default:
        return 'unknown';
    }
  }

  protected extractValidationRules(result: any): string[] {
    const rules: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return rules;
    }

    // 基于数据类型添加验证规则
    const dataType = this.extractDataType(result);
    switch (dataType) {
      case 'string':
        rules.push('type:string');
        break;
      case 'integer':
        rules.push('type:integer');
        break;
      case 'float':
        rules.push('type:number');
        break;
      case 'boolean':
        rules.push('type:boolean');
        break;
      case 'array':
        rules.push('type:array');
        break;
      case 'object':
        rules.push('type:object');
        break;
      case 'null':
        rules.push('nullable');
        break;
    }

    return rules;
  }

  protected isRequired(result: any): boolean {
    // JSON中所有显式定义的键都是必需的
    return true;
  }

  // JSON特定的私有辅助方法

  private inferNumberType(node: any): string {
    if (!node.text) {
      return 'number';
    }

    const text = node.text.trim();

    // 检查是否为整数
    if (/^-?\d+$/.test(text)) {
      return 'integer';
    }

    // 检查是否为浮点数
    if (/^-?\d*\.\d+$/.test(text)) {
      return 'float';
    }

    return 'number';
  }

  private extractArrayLength(node: any): number {
    if (!node.children) {
      return 0;
    }

    // 计算数组元素数量（排除括号和逗号）
    let count = 0;
    for (const child of node.children) {
      if (child.type !== '[' && child.type !== ']' && child.type !== ',') {
        count++;
      }
    }
    return count;
  }

  private extractValueType(node: any): string {
    const valueNode = node.childForFieldName('value');
    if (!valueNode) {
      return 'unknown';
    }
    return valueNode.type;
  }

  private extractPairKey(node: any): string | null {
    const keyNode = node.childForFieldName('key');
    if (keyNode && keyNode.text) {
      return keyNode.text.replace(/"/g, '');
    }
    return null;
  }

  private calculateNestingLevel(node: any): number {
    if (!node.startPosition) {
      return 0;
    }

    // JSON中基于缩进计算嵌套级别
    return Math.floor(node.startPosition.column / 2);
  }

  private findStringReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      if (child.type === 'string' && child.text) {
        const text = child.text.replace(/"/g, '');
        // 查找可能的URL或文件引用
        if (text.match(/^https?:\/\//)) {
          dependencies.push(text);
        } else if (text.match(/\.(json|js|ts|html|css)$/)) {
          dependencies.push(text);
        }
      }

      this.findStringReferences(child, dependencies);
    }
  }
}