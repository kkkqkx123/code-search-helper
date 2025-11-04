/**
 * YAML配置语言适配器
 * 处理YAML配置文件的查询结果标准化
 */

import { ConfigLanguageAdapter, ConfigAdapterOptions } from '../ConfigLanguageAdapter';

/**
 * YAML配置语言适配器
 */
export class YAMLConfigAdapter extends ConfigLanguageAdapter {
  constructor(options: ConfigAdapterOptions = {}) {
    super(options);
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      'name.definition.key',
      'name.definition.mapping',
      'name.definition.sequence',
      'name.definition.scalar',
      'name.definition.alias',
      'name.definition.anchor',
      'name.key',
      'name.mapping',
      'name.sequence',
      'name.scalar',
      'name.alias',
      'name.anchor'
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

    // 提取YAML特有的元数据
    if (mainNode.type === 'block_mapping') {
      extra.isMapping = true;
      extra.mappingType = 'block';
    }

    if (mainNode.type === 'flow_mapping') {
      extra.isMapping = true;
      extra.mappingType = 'flow';
    }

    if (mainNode.type === 'block_sequence') {
      extra.isSequence = true;
      extra.sequenceType = 'block';
    }

    if (mainNode.type === 'flow_sequence') {
      extra.isSequence = true;
      extra.sequenceType = 'flow';
    }

    // 提取锚点和别名信息
    const anchor = this.extractAnchor(mainNode);
    if (anchor) {
      extra.anchor = anchor;
    }

    const alias = this.extractAlias(mainNode);
    if (alias) {
      extra.alias = alias;
    }

    // 提取缩进信息
    extra.indentationLevel = this.calculateIndentationLevel(mainNode);

    return extra;
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {
      'block_mapping': 'table',
      'flow_mapping': 'table',
      'block_sequence': 'array',
      'flow_sequence': 'array',
      'plain_scalar': 'value',
      'single_quoted_scalar': 'value',
      'double_quoted_scalar': 'value',
      'literal_scalar': 'value',
      'folded_scalar': 'value',
      'alias': 'dependency',
      'anchor': 'type-def',
      'tag': 'type-def',
      'pair': 'config-item',
      'key': 'key',
      'document': 'section'
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
    if (nodeType.includes('mapping')) complexity += 2;
    if (nodeType.includes('sequence')) complexity += 1;
    if (nodeType.includes('alias')) complexity += 1;
    if (nodeType.includes('anchor')) complexity += 1;

    // 基于嵌套深度增加复杂度
    const nestingDepth = this.calculateNestingDepth(result);
    complexity += nestingDepth;

    // 基于缩进级别增加复杂度
    const indentationLevel = this.calculateIndentationLevel(mainNode);
    complexity += Math.floor(indentationLevel / 2);

    return complexity;
  }

  extractDependencies(result: any): string[] {
    const dependencies: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return dependencies;
    }

    // 查找别名引用
    this.findAliasReferences(mainNode, dependencies);

    // 查找锚点定义
    this.findAnchorDefinitions(mainNode, dependencies);

    return [...new Set(dependencies)];
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return modifiers;
    }

    const nodeType = mainNode.type;
    if (nodeType.includes('flow')) modifiers.push('flow-style');
    if (nodeType.includes('block')) modifiers.push('block-style');
    if (nodeType.includes('quoted')) modifiers.push('quoted');
    if (nodeType.includes('literal')) modifiers.push('literal');
    if (nodeType.includes('folded')) modifiers.push('folded');

    // 检查是否有锚点或别名
    if (this.extractAnchor(mainNode)) modifiers.push('anchored');
    if (this.extractAlias(mainNode)) modifiers.push('alias');

    return modifiers;
  }

  // YAML特定的辅助方法

  protected extractConfigPath(result: any): string {
    if (!this.options.enableConfigPathParsing) {
      return '';
    }

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return '';
    }

    // 构建YAML配置路径
    const pathParts: string[] = [];

    // 从当前节点向上遍历，构建路径
    let currentNode = mainNode;
    while (currentNode) {
      if (currentNode.type === 'block_mapping' || currentNode.type === 'flow_mapping') {
        const keyName = this.extractMappingKey(currentNode);
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
      case 'plain_scalar':
      case 'single_quoted_scalar':
      case 'double_quoted_scalar':
      case 'literal_scalar':
      case 'folded_scalar':
        return this.inferScalarType(mainNode);
      case 'block_sequence':
      case 'flow_sequence':
        return 'array';
      case 'block_mapping':
      case 'flow_mapping':
        return 'object';
      case 'alias':
        return 'reference';
      case 'anchor':
        return 'anchor';
      case 'tag':
        return 'tag';
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
      case 'number':
      case 'integer':
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

    // YAML特有的验证规则
    if (this.extractAlias(mainNode)) {
      rules.push('reference');
    }

    if (this.extractAnchor(mainNode)) {
      rules.push('anchor');
    }

    return rules;
  }

  protected isRequired(result: any): boolean {
    // YAML中所有显式定义的键都是必需的，除非明确标记为可选
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return false;
    }

    // 检查是否有可选标记（如注释中包含optional）
    const text = mainNode.text || '';
    if (text.includes('optional') || text.includes('?')) {
      return false;
    }

    return true;
  }

  // YAML特定的私有辅助方法

  private inferScalarType(node: any): string {
    if (!node.text) {
      return 'string';
    }

    const text = node.text.trim();

    // 尝试推断具体的标量类型
    if (text === 'null' || text === '~' || text === '') {
      return 'null';
    }

    if (text === 'true' || text === 'false') {
      return 'boolean';
    }

    if (/^-?\d+$/.test(text)) {
      return 'integer';
    }

    if (/^-?\d*\.\d+$/.test(text)) {
      return 'float';
    }

    if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
      return 'date';
    }

    return 'string';
  }

  private extractAnchor(node: any): string | null {
    if (!node.children) {
      return null;
    }

    for (const child of node.children) {
      if (child.type === 'anchor' && child.text) {
        return child.text;
      }
    }

    return null;
  }

  private extractAlias(node: any): string | null {
    if (!node.children) {
      return null;
    }

    for (const child of node.children) {
      if (child.type === 'alias' && child.text) {
        return child.text;
      }
    }

    return null;
  }

  private calculateIndentationLevel(node: any): number {
    if (!node.startPosition) {
      return 0;
    }

    return node.startPosition.column;
  }

  private extractMappingKey(node: any): string | null {
    if (!node.children) {
      return null;
    }

    for (const child of node.children) {
      if (child.type === 'key' && child.text) {
        return child.text;
      }
    }

    return null;
  }

  private findAliasReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      if (child.type === 'alias' && child.text) {
        dependencies.push(child.text);
      }

      this.findAliasReferences(child, dependencies);
    }
  }

  private findAnchorDefinitions(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      if (child.type === 'anchor' && child.text) {
        dependencies.push(child.text);
      }

      this.findAnchorDefinitions(child, dependencies);
    }
  }
}