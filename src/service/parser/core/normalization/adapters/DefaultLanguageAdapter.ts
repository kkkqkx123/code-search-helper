import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult } from '../types';
type StandardType = StandardizedQueryResult['type'];

/**
 * 默认语言适配器
 * 处理没有特定适配器的语言的查询结果标准化
 */
export class DefaultLanguageAdapter extends BaseLanguageAdapter {
  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  getSupportedQueryTypes(): string[] {
    return [
      'functions',
      'classes',
      'methods',
      'imports',
      'variables'
    ];
  }

  mapNodeType(nodeType: string): string {
    // 通用的节点类型映射
    const typeMapping: Record<string, string> = {
      'function_definition': 'function',
      'function_declaration': 'function',
      'func_literal': 'function',
      'lambda': 'function',
      'method_definition': 'method',
      'method_declaration': 'method',
      'class_declaration': 'class',
      'class_definition': 'class',
      'struct_specifier': 'class',
      'struct_item': 'class',
      'union_specifier': 'class',
      'enum_specifier': 'class',
      'interface_declaration': 'interface',
      'type_declaration': 'type',
      'type_definition': 'type',
      'import_statement': 'import',
      'import_from_statement': 'import',
      'include_directive': 'import',
      'variable_declaration': 'variable',
      'var_declaration': 'variable',
      'let_declaration': 'variable',
      'const_declaration': 'variable',
      'assignment_expression': 'variable',
      'local_variable_declaration': 'variable'
    };
    
    return typeMapping[nodeType] || nodeType;
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      'name.definition.function',
      'name.definition.method', 
      'name.definition.class',
      'name.definition.interface',
      'name.definition.type',
      'name.definition.variable',
      'name.definition.property'
    ];

    for (const captureName of nameCaptures) {
      const capture = result.captures?.find((c: any) => c.name === captureName);
      if (capture?.node?.text) {
        return capture.node.text;
      }
    }

    // 如果没有找到名称捕获，尝试从主节点提取
    if (result.captures?.[0]?.node?.childForFieldName('name')?.text) {
      return result.captures[0].node.childForFieldName('name').text;
    }

    // 尝试从第一个标识符节点提取
    const firstIdentifier = this.findFirstIdentifier(result.captures?.[0]?.node);
    if (firstIdentifier) {
      return firstIdentifier;
    }

    return 'unnamed';
  }

  extractLanguageSpecificMetadata(result: any): Record<string, any> {
    const extra: Record<string, any> = {};
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return extra;
    }

    // 提取参数信息（对于函数）
    const parameters = mainNode.childForFieldName('parameters');
    if (parameters) {
      extra.parameterCount = parameters.childCount;
    }

    // 提取继承信息
    const heritageClause = mainNode.childForFieldName('heritage_clause') ||
                          mainNode.childForFieldName('superclasses') ||
                          mainNode.childForFieldName('base_class');
    if (heritageClause) {
      extra.hasInheritance = true;
      extra.inheritance = heritageClause.text;
    }

    // 提取泛型信息
    const typeParameters = mainNode.childForFieldName('type_parameters');
    if (typeParameters) {
      extra.hasGenerics = true;
      extra.typeParameters = typeParameters.text;
    }

    return extra;
  }

  mapQueryTypeToStandardType(queryType: string): StandardType {
    const mapping: Record<string, StandardType> = {
      'functions': 'function',
      'classes': 'class',
      'methods': 'method',
      'imports': 'import',
      'variables': 'variable',
      'exports': 'export',
      'interfaces': 'interface',
      'types': 'type',
      'properties': 'variable'  // 将properties映射到variable，因为StandardizedQueryResult不支持property类型
    };
    
    return mapping[queryType] || 'expression';
  }

  calculateComplexity(result: any): number {
    let complexity = this.calculateBaseComplexity(result);
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return complexity;
    }

    // 基于节点类型增加复杂度
    const nodeType = mainNode.type;
    if (nodeType.includes('class')) complexity += 2;
    if (nodeType.includes('function')) complexity += 1;
    if (nodeType.includes('interface')) complexity += 1;
    if (nodeType.includes('struct')) complexity += 1;
    if (nodeType.includes('union')) complexity += 1;
    if (nodeType.includes('enum')) complexity += 1;

    // 基于关键字增加复杂度
    const text = mainNode.text || '';
    const complexKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', 'try', 'catch', 'throw'];
    for (const keyword of complexKeywords) {
      if (text.includes(keyword)) {
        complexity += 0.5;
      }
    }

    return Math.round(complexity);
  }

  extractDependencies(result: any): string[] {
    const dependencies: string[] = [];
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return dependencies;
    }

    // 查找标识符引用
    this.findIdentifiers(mainNode, dependencies);
    
    // 查找类型引用
    this.findTypeReferences(mainNode, dependencies);

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return modifiers;
    }

    const text = mainNode.text || '';
    
    // 通用的修饰符检查
    const commonModifiers = [
      'public', 'private', 'protected', 'static', 'final', 'abstract',
      'virtual', 'override', 'async', 'export', 'import', 'const',
      'readonly', 'volatile', 'synchronized', 'native', 'transient'
    ];

    for (const modifier of commonModifiers) {
      if (text.includes(modifier)) {
        modifiers.push(modifier);
      }
    }

    return modifiers;
  }

  // 默认适配器特定的辅助方法

  private findFirstIdentifier(node: any): string | null {
    if (!node) {
      return null;
    }

    if (node.type === 'identifier' && node.text) {
      return node.text;
    }

    if (node.children) {
      for (const child of node.children) {
        const identifier = this.findFirstIdentifier(child);
        if (identifier) {
          return identifier;
        }
      }
    }

    return null;
  }

  protected findIdentifiers(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      if (child.type === 'identifier' && child.text) {
        dependencies.push(child.text);
      }
      
      this.findIdentifiers(child, dependencies);
    }
  }

  protected findTypeReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找可能的类型引用（通常以大写字母开头）
      if (child.type === 'type_identifier' || 
          (child.type === 'identifier' && child.text && child.text[0] === child.text[0].toUpperCase())) {
        dependencies.push(child.text);
      }
      
      this.findTypeReferences(child, dependencies);
    }
  }
}