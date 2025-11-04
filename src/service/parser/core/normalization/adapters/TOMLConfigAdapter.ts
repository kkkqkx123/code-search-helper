/**
 * TOML配置语言适配器
 * 处理TOML配置文件的查询结果标准化
 */

import { ConfigLanguageAdapter, ConfigAdapterOptions } from '../ConfigLanguageAdapter';

/**
 * TOML配置语言适配器
 */
export class TOMLConfigAdapter extends ConfigLanguageAdapter {
  constructor(options: ConfigAdapterOptions = {}) {
    super(options);
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      'name.definition.key',
      'name.definition.table',
      'name.definition.array',
      'name.definition.pair',
      'name.key',
      'name.table',
      'name.array'
    ];

    for (const captureName of nameCaptures) {
      const capture = result.captures?.find((c: any) => c.name === captureName);
      if (capture?.node?.text) {
        return capture.node.text;
      }
    }

    // 如果没有找到名称捕获，尝试从主节点提取
    if (result.captures?.[0]?.node?.childForFieldName('key')?.text) {
      return result.captures[0].node.childForFieldName('key').text;
    }

    return 'unnamed';
  }

  extractLanguageSpecificMetadata(result: any): Record<string, any> {
    const extra: Record<string, any> = {};
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return extra;
    }

    // 提取TOML特有的元数据
    if (mainNode.type === 'table') {
      extra.isTable = true;
      extra.tableType = this.extractTableType(mainNode);
    }

    if (mainNode.type === 'array') {
      extra.isArray = true;
      extra.arrayLength = this.extractArrayLength(mainNode);
    }

    if (mainNode.type === 'pair') {
      extra.isPair = true;
      extra.valueType = this.extractValueType(mainNode);
    }

    return extra;
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {
      'pair': 'config-item',
      'table': 'table',
      'array_table': 'array',
      'inline_table': 'table',
      'string': 'value',
      'integer': 'value',
      'float': 'value',
      'boolean': 'value',
      'offset_date_time': 'value',
      'local_date_time': 'value',
      'local_date': 'value',
      'local_time': 'value',
      'array': 'array'
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
    if (nodeType === 'table') complexity += 2;
    if (nodeType === 'array') complexity += 1;
    if (nodeType === 'array_table') complexity += 2;
    if (nodeType === 'inline_table') complexity += 1;

    // 基于嵌套深度增加复杂度
    const nestingDepth = this.calculateNestingDepth(result);
    complexity += nestingDepth;

    return complexity;
  }

  extractDependencies(result: any): string[] {
    const dependencies: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return dependencies;
    }

    // 查找表引用
    this.findTableReferences(mainNode, dependencies);

    // 查找数组引用
    this.findArrayReferences(mainNode, dependencies);

    return [...new Set(dependencies)];
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return modifiers;
    }

    const nodeType = mainNode.type;
    if (nodeType === 'array_table') modifiers.push('array-of-tables');
    if (nodeType === 'inline_table') modifiers.push('inline');
    if (nodeType === 'table') modifiers.push('section');

    return modifiers;
  }

  // TOML特定的辅助方法

  protected extractConfigPath(result: any): string {
    if (!this.options.enableConfigPathParsing) {
      return '';
    }

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return '';
    }

    // 构建TOML配置路径
    const pathParts: string[] = [];

    // 从当前节点向上遍历，构建路径
    let currentNode = mainNode;
    while (currentNode) {
      if (currentNode.type === 'table' || currentNode.type === 'array_table') {
        const tableName = this.extractTableName(currentNode);
        if (tableName) {
          pathParts.unshift(tableName);
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
      case 'integer':
        return 'integer';
      case 'float':
        return 'float';
      case 'boolean':
        return 'boolean';
      case 'array':
        return 'array';
      case 'table':
      case 'inline_table':
        return 'object';
      case 'offset_date_time':
      case 'local_date_time':
      case 'local_date':
      case 'local_time':
        return 'datetime';
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
    }

    return rules;
  }

  protected isRequired(result: any): boolean {
    // TOML中所有显式定义的键都是必需的
    return true;
  }

  // TOML特定的私有辅助方法

  private extractTableType(node: any): string {
    if (node.type === 'array_table') {
      return 'array-of-tables';
    }
    if (node.type === 'inline_table') {
      return 'inline';
    }
    return 'standard';
  }

  private extractArrayLength(node: any): number {
    if (!node.children) {
      return 0;
    }

    // 计算数组元素数量
    let count = 0;
    for (const child of node.children) {
      if (child.type === 'comment') continue;
      count++;
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

  private findTableReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      if (child.type === 'table' || child.type === 'array_table') {
        const tableName = this.extractTableName(child);
        if (tableName) {
          dependencies.push(tableName);
        }
      }

      this.findTableReferences(child, dependencies);
    }
  }

  private findArrayReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      if (child.type === 'array') {
        dependencies.push('array');
      }

      this.findArrayReferences(child, dependencies);
    }
  }

  private extractTableName(node: any): string | null {
    // 从表节点中提取表名
    const headerNode = node.childForFieldName('header');
    if (headerNode) {
      const keyNode = headerNode.childForFieldName('key');
      if (keyNode?.text) {
        return keyNode.text;
      }
    }

    // 尝试从其他位置提取表名
    if (node.children) {
      for (const child of node.children) {
        if (child.type === 'key' && child.text) {
          return child.text;
        }
      }
    }

    return null;
  }
}