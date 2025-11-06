import { JavaScriptLanguageAdapter } from './JavaScriptLanguageAdapter';
import { AdapterOptions } from '../BaseLanguageAdapter';
import { JS_SUPPORTED_QUERY_TYPES } from './js-utils';

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
    // 基于JavaScript支持的查询类型，添加TypeScript特定的类型
    return [
      ...JS_SUPPORTED_QUERY_TYPES,
      'annotation-relationships',
      'creation-relationships',
      'reference-relationships',
      'dependency-relationships'
    ];
  }

  mapNodeType(nodeType: string): string {
    // 调用父类方法处理基础映射
    const baseMapping = super.mapNodeType(nodeType);

    // 添加TypeScript特有的类型映射
    const tsTypeMapping: Record<string, string> = {
      'abstract_class_declaration': 'classDeclaration',
      'interface_declaration': 'interfaceDeclaration',
      'type_alias_declaration': 'typeAnnotation',
      'enum_declaration': 'enumDeclaration',
      'class_static_block': 'block',
      'for_in_statement': 'controlFlow',
      'for_of_statement': 'controlFlow',
      'generator_function_declaration': 'functionDeclaration',
      'async_function_declaration': 'functionDeclaration',
      'async_function_expression': 'functionDeclaration',
      'type_assertion': 'expression',
      'as_expression': 'expression',
      'satisfies_expression': 'expression',
      'non_null_expression': 'expression',
      'ternary_expression': 'expression',
      'subscript_expression': 'memberExpression',
      'parenthesized_expression': 'expression',
      'named_imports': 'propertyIdentifier',
      'method_signature': 'methodDeclaration',
      'abstract_method_signature': 'methodDeclaration',
      'public_field_definition': 'variableDeclaration',
      'internal_module': 'typeAnnotation'
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

  // 高级关系提取方法 - TypeScript特定的实现
  
  extractDataFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'assignment' | 'parameter' | 'return';
  }> {
    // 先调用父类方法获取基础关系
    const relationships = super.extractDataFlowRelationships(result);
    
    // 添加TypeScript特有的数据流关系
    this.extractTypeScriptDataFlowRelationships(result, relationships);
    
    return relationships;
  }
  
  private extractTypeScriptDataFlowRelationships(result: any, relationships: Array<{
    source: string;
    target: string;
    type: 'assignment' | 'parameter' | 'return';
  }>): void {
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return;
    }
    
    // TypeScript特有的数据流关系
    
    // 类型注解变量赋值数据流
    if (mainNode.type === 'lexical_declaration') {
      for (const child of mainNode.children || []) {
        if (child.type === 'variable_declarator') {
          const name = child.childForFieldName('name');
          const type = child.childForFieldName('type');
          const value = child.childForFieldName('value');
          
          if (name?.text && value?.text) {
            relationships.push({
              source: value.text,
              target: name.text,
              type: 'assignment'
            });
          }
        }
      }
    }
    
    // 类型断言数据流
    if (mainNode.type === 'as_expression') {
      const value = mainNode.childForFieldName('value');
      const type = mainNode.childForFieldName('type');
      
      if (value?.text && type?.text) {
        relationships.push({
          source: value.text,
          target: type.text,
          type: 'assignment'
        });
      }
    }
    
    // 非空断言数据流
    if (mainNode.type === 'non_null_expression') {
      const value = mainNode.childForFieldName('value');
      if (value?.text) {
        relationships.push({
          source: value.text,
          target: 'non-null-asserted',
          type: 'assignment'
        });
      }
    }
    
    // 空值合并数据流
    if (mainNode.type === 'binary_expression') {
      const operator = mainNode.childForFieldName('operator');
      if (operator?.text === '??') {
        const left = mainNode.childForFieldName('left');
        const right = mainNode.childForFieldName('right');
        
        if (left?.text && right?.text) {
          relationships.push({
            source: left.text,
            target: right.text,
            type: 'assignment'
          });
        }
      }
    }
    
    // Promise异步数据流
    if (mainNode.type === 'assignment_expression') {
      const right = mainNode.childForFieldName('right');
      if (right?.type === 'await_expression') {
        const awaitValue = right.childForFieldName('value');
        const left = mainNode.childForFieldName('left');
        
        if (awaitValue?.text && left?.text) {
          relationships.push({
            source: awaitValue.text,
            target: left.text,
            type: 'assignment'
          });
        }
      }
    }
    
    // 枚举成员数据流
    if (mainNode.type === 'member_expression') {
      const object = mainNode.childForFieldName('object');
      const property = mainNode.childForFieldName('property');
      
      if (object?.text && property?.text) {
        relationships.push({
          source: object.text,
          target: property.text,
          type: 'assignment'
        });
      }
    }
    
    // 命名空间成员数据流
    if (mainNode.type === 'member_expression') {
      const object = mainNode.childForFieldName('object');
      const property = mainNode.childForFieldName('property');
      
      if (object?.text && property?.text) {
        relationships.push({
          source: object.text,
          target: property.text,
          type: 'assignment'
        });
      }
    }
  }

  extractControlFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'conditional' | 'loop' | 'exception' | 'callback';
  }> {
    // 先调用父类方法获取基础关系
    const relationships = super.extractControlFlowRelationships(result);
    
    // 添加TypeScript特有的控制流关系
    this.extractTypeScriptControlFlowRelationships(result, relationships);
    
    return relationships;
  }
  
  private extractTypeScriptControlFlowRelationships(result: any, relationships: Array<{
    source: string;
    target: string;
    type: 'conditional' | 'loop' | 'exception' | 'callback';
  }>): void {
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return;
    }
    
    // TypeScript特有的控制流关系
    
    // 泛型约束控制流
    if (mainNode.type === 'type_parameters') {
      for (const child of mainNode.children || []) {
        if (child.type === 'type_parameter' && child.text) {
          const constraint = child.childForFieldName('constraint');
          if (constraint?.text) {
            relationships.push({
              source: child.text,
              target: constraint.text,
              type: 'conditional'
            });
          }
        }
      }
    }
    
    // 类型守卫控制流
    if (mainNode.type === 'type_predicate') {
      const parameter = mainNode.childForFieldName('parameter');
      const type = mainNode.childForFieldName('type');
      
      if (parameter?.text && type?.text) {
        relationships.push({
          source: parameter.text,
          target: type.text,
          type: 'conditional'
        });
      }
    }
    
    // 异步/等待控制流
    if (mainNode.type === 'await_expression') {
      const value = mainNode.childForFieldName('value');
      if (value?.text) {
        relationships.push({
          source: value.text,
          target: 'async-result',
          type: 'callback'
        });
      }
    }
    
    // Promise链式调用控制流
    if (mainNode.type === 'call_expression') {
      const func = mainNode.childForFieldName('function');
      if (func?.type === 'member_expression') {
        const property = func.childForFieldName('property');
        if (property?.text && ['then', 'catch', 'finally'].includes(property.text)) {
          relationships.push({
            source: 'promise',
            target: `promise-${property.text}`,
            type: 'callback'
          });
        }
      }
    }
  }

  extractSemanticRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
  }> {
    // 先调用父类方法获取基础语义关系
    const relationships = super.extractSemanticRelationships(result);
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 添加TypeScript特有的语义关系
    const text = mainNode.text || '';
    
    // 检查TypeScript接口实现
    if (text.includes('implements')) {
      relationships.push({
        source: 'interface',
        target: 'implementing-class',
        type: 'overrides'
      });
    }

    // 检查TypeScript类型别名和泛型
    if (text.includes('type ') || text.includes('<') && text.includes('>')) {
      relationships.push({
        source: 'generic-type',
        target: 'concrete-type',
        type: 'delegates'
      });
    }

    return relationships;
  }

  extractLifecycleRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'instantiates' | 'initializes' | 'destroys' | 'manages';
  }> {
    // TypeScript继承JavaScript的实现，可以复用
    return super.extractLifecycleRelationships(result);
  }

  extractConcurrencyRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'synchronizes' | 'locks' | 'communicates' | 'races';
  }> {
    // TypeScript继承JavaScript的实现，可以复用
    return super.extractConcurrencyRelationships(result);
  }
}