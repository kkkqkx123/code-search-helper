import { JavaScriptLanguageAdapter } from './JavaScriptLanguageAdapter';
import { AdapterOptions } from '../BaseLanguageAdapter';

/**
 * TypeScript语言适配器
 * 处理TypeScript特定的查询结果标准化
 * 继承JavaScriptLanguageAdapter并添加TypeScript特有功能
 */
export class TypeScriptLanguageAdapter extends JavaScriptLanguageAdapter {
  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  getSupportedQueryTypes(): string[] {
    return [
      'functions',
      'classes', 
      'methods',
      'imports',
      'exports',
      'interfaces',
      'types',
      'properties',
      'variables',
      'control-flow',
      'expressions'
    ];
  }

  mapNodeType(nodeType: string): string {
    // 调用父类方法处理基础映射
    const baseMapping = super.mapNodeType(nodeType);

    // 添加TypeScript特有的类型映射
    const tsTypeMapping: Record<string, string> = {
      'abstract_class_declaration': 'class',
      'interface_declaration': 'interface',
      'type_alias_declaration': 'type',
      'enum_declaration': 'enum'
    };

    return tsTypeMapping[nodeType] || baseMapping;
  }

  extractName(result: any): string {
    // 先调用父类方法处理基础名称提取
    const baseName = super.extractName(result);

    // 如果父类找到了名称，直接返回
    if (baseName !== 'unnamed') {
      return baseName;
    }

    // 添加TypeScript特有的名称捕获
    const tsNameCaptures = [
      'definition.type_assertion',
      'definition.as_expression',
      'definition.satisfies_expression',
      'definition.non_null_expression',
      'definition.type_alias',
      'definition.enum',
      'definition.namespace',
      'definition.type_parameters',
      'definition.type_arguments',
      'definition.generic_type',
      'definition.type_predicate',
      'definition.typed_property'
    ];

    for (const captureName of tsNameCaptures) {
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

    // 添加TypeScript特有的元数据

    // 提取泛型信息
    const typeParameters = mainNode.childForFieldName('type_parameters');
    if (typeParameters) {
      extra.hasGenerics = true;
      extra.typeParameters = typeParameters.text;
    }

    // 提取装饰器信息
    const decorators = this.extractDecorators(mainNode);
    if (decorators.length > 0) {
      extra.decorators = decorators;
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

  // 添加TypeScript特有的复杂度因素
  const text = mainNode.text || '';
  if (text.includes('decorator') || text.includes('@')) complexity += 1; // 装饰器
  if (text.includes('implements')) complexity += 1; // 接口实现
  if (text.includes('generic') || text.includes('<')) complexity += 1; // 泛型

  return complexity;
  }

  extractModifiers(result: any): string[] {
  // 调用父类方法获取基础修饰符
  const modifiers = super.extractModifiers(result);
  const mainNode = result.captures?.[0]?.node;

  if (!mainNode) {
    return modifiers;
    }

  // 添加TypeScript特有的修饰符
  const text = mainNode.text || '';

  if (text.includes('public')) modifiers.push('public');
  if (text.includes('private')) modifiers.push('private');
    if (text.includes('protected')) modifiers.push('protected');
  if (text.includes('readonly')) modifiers.push('readonly');
  if (text.includes('abstract')) modifiers.push('abstract');

  return modifiers;
  }

  // TypeScript特定的辅助方法

  private extractDecorators(node: any): string[] {
    const decorators: string[] = [];

    if (!node || !node.children) {
      return decorators;
    }

  for (const child of node.children) {
    if (child.type === 'decorator' && child.text) {
      decorators.push(child.text.trim());
  }
    decorators.push(...this.extractDecorators(child));
    }

  return decorators;
  }

  // 重写isBlockNode方法以支持TypeScript特定的块节点类型
  protected isBlockNode(node: any): boolean {
  const tsBlockTypes = ['interface_body'];
  return tsBlockTypes.includes(node.type) || super.isBlockNode(node);
  }
}