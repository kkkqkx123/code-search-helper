import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult } from '../types';

/**
 * Python语言适配器
 * 处理Python特定的查询结果标准化
 */
export class PythonLanguageAdapter extends BaseLanguageAdapter {
  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  getSupportedQueryTypes(): string[] {
    return [
      'functions',
      'classes',
      'methods',
      'imports',
      'variables',
      'control-flow',
      'data-structures',
      'types-decorators'
    ];
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {
      // 函数相关
      'function_definition': 'function',
      'async_function_definition': 'function',
      'decorated_definition': 'function', // 默认为函数，后续会根据内容调整
      'method_definition': 'method',
      'lambda': 'function',
      
      // 类相关
      'class_definition': 'class',
      'class_pattern': 'class',
      
      // 导入相关
      'import_statement': 'import',
      'import_from_statement': 'import',
      'relative_import': 'import',
      'wildcard_import': 'import',
      'dotted_name': 'expression',
      
      // 变量相关
      'assignment': 'variable',
      'annotated_assignment': 'variable',
      'augmented_assignment': 'variable',
      'named_expression': 'expression',
      
      // 控制流相关
      'for_statement': 'control-flow',
      'while_statement': 'control-flow',
      'if_statement': 'control-flow',
      'try_statement': 'control-flow',
      'with_statement': 'control-flow',
      'break_statement': 'control-flow',
      'continue_statement': 'control-flow',
      'return_statement': 'control-flow',
      'raise_statement': 'control-flow',
      'assert_statement': 'control-flow',
      'expression_statement': 'control-flow',
      'type_alias_statement': 'control-flow',
      'global_statement': 'control-flow',
      'nonlocal_statement': 'control-flow',
      
      // 表达式相关
      'call': 'expression',
      'attribute': 'expression',
      'subscript': 'expression',
      'binary_operator': 'expression',
      'yield': 'expression',
      'type': 'expression',
      'parameters': 'expression',
      'default_parameter': 'expression',
      'typed_parameter': 'expression',
      'typed_default_parameter': 'expression',
      'decorator': 'expression',
      'comment': 'expression',
      'string': 'expression',
      'integer': 'expression',
      'float': 'expression',
      'true': 'expression',
      'false': 'expression',
      'none': 'expression',
      'ellipsis': 'expression',
      'list': 'expression',
      'tuple': 'expression',
      'set': 'expression',
      'dictionary': 'expression',
      'list_comprehension': 'expression',
      'dictionary_comprehension': 'expression',
      'set_comprehension': 'expression',
      'generator_expression': 'expression',
      'parenthesized_expression': 'expression',
      'expression_list': 'expression',
      'slice': 'expression',
      'tuple_pattern': 'expression',
      'list_pattern': 'expression',
      'dict_pattern': 'expression',
      'union_type': 'expression',
      'generic_type': 'expression',
      'argument_list': 'expression',
      
      // 其他
      'identifier': 'expression',
      'block': 'expression'
    };
    
    return typeMapping[nodeType] || 'expression';
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      // 基础捕获
      'name.definition.function',
      'name.definition.class',
      'name.definition.variable',
      'name.definition.import',
      'name.definition.if',
      'name.definition.binary_operator',
      'name.definition.list_comprehension',
      'name.definition.type_annotation',
      
      // 函数相关
      'name.definition.async_function',
      'name.definition.method',
      'name.definition.async_method',
      'name.definition.lambda',
      'name.definition.generator',
      'name.definition.async_generator',
      'name.definition.typed_function',
      'name.definition.typed_async_function',
      'name.definition.test',
      'name.definition.dunder_method',
      'name.definition.private_method',
      
      // 类相关
      'name.definition.class',
      'name.definition.superclass',
      'name.definition.property',
      'name.definition.static_method',
      'name.definition.class_method',
      
      // 变量相关
      'name.definition.variable',
      'name.definition.constant',
      'name.definition.typed_variable',
      'name.definition.augmented_assignment',
      'name.definition.named_expression',
      'name.definition.pattern_variable',
      'name.definition.attribute_variable',
      'name.definition.subscript_variable',
      'name.definition.tuple_variable',
      'name.definition.list_variable',
      
      // 导入相关
      'name.definition.import',
      'name.definition.import_from',
      'name.definition.wildcard_import',
      'name.definition.relative_import',
      'name.definition.global',
      'name.definition.nonlocal',
      'name.definition.imported_module',
      'name.definition.imported_name',
      
      // 控制流相关
      'name.definition.if',
      'name.definition.for',
      'name.definition.while',
      'name.definition.break',
      'name.definition.continue',
      'name.definition.return',
      'name.definition.raise',
      'name.definition.assert',
      'name.definition.expression',
      
      // 表达式相关
      'name.definition.binary_operator',
      'name.definition.call',
      'name.definition.attribute',
      'name.definition.subscript',
      
      // 数据结构相关
      'name.definition.list_comprehension',
      'name.definition.dict_comprehension',
      'name.definition.set_comprehension',
      'name.definition.generator_expression',
      'name.definition.list',
      'name.definition.tuple',
      'name.definition.set',
      'name.definition.dictionary',
      'name.definition.class_pattern',
      'name.definition.tuple_pattern',
      'name.definition.list_pattern',
      'name.definition.dict_pattern',
      'name.definition.string',
      'name.definition.integer',
      'name.definition.float',
      'name.definition.true',
      'name.definition.false',
      'name.definition.none',
      'name.definition.ellipsis',
      'name.definition.slice',
      'name.definition.parenthesized_expression',
      'name.definition.expression_list',
      'name.definition.generic_type_name',
      
      // 类型相关
      'name.definition.type_annotation',
      'name.definition.type_hint',
      'name.definition.type_alias',
      'name.definition.parameters',
      'name.definition.default_parameter',
      'name.definition.typed_parameter',
      'name.definition.typed_default_parameter',
      'name.definition.decorator',
      'name.definition.union_type',
      'name.definition.comment',
      'name.definition.docstring'
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

    return 'unnamed';
  }

  extractLanguageSpecificMetadata(result: any): Record<string, any> {
    const extra: Record<string, any> = {};
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return extra;
    }

    // 提取装饰器信息 - 检查捕获中的装饰器
    const capturedDecorators = result.captures?.filter((capture: any) =>
      capture.name === 'decorator' && capture.node?.text
    ).map((capture: any) => capture.node.text) || [];
    
    const nodeDecorators = this.extractDecorators(mainNode);
    const allDecorators = [...new Set([...capturedDecorators, ...nodeDecorators])]; // 合并并去重
    
    if (allDecorators.length > 0) {
      extra.decorators = allDecorators;
    }

    // 提取参数信息（对于函数）
    const parameters = mainNode.childForFieldName('parameters');
    if (parameters) {
      extra.parameterCount = parameters.childCount;
      extra.hasTypeHints = this.hasTypeHints(parameters);
    }

    // 提取返回类型信息
    const returnType = mainNode.childForFieldName('return_type');
    if (returnType) {
      extra.hasReturnType = true;
      extra.returnType = returnType.text;
    }

    // 提取继承信息（对于类）
    const superclasses = mainNode.childForFieldName('superclasses');
    if (superclasses) {
      extra.hasInheritance = true;
      extra.superclasses = this.extractSuperclassNames(superclasses);
    }

    // 检查是否是异步函数
    if (mainNode.type === 'async_function_definition' || 
        mainNode.type === 'async_method_definition' ||
        (mainNode.text && mainNode.text.includes('async'))) {
      extra.isAsync = true;
    }

    // 检查是否是生成器函数
    if (mainNode.text && mainNode.text.includes('yield')) {
      extra.isGenerator = true;
    }

    return extra;
  }

  mapQueryTypeToStandardType(queryType: string): 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' {
    const mapping: Record<string, 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression'> = {
      'functions': 'function',
      'classes': 'class',
      'methods': 'method',
      'imports': 'import',
      'variables': 'variable',
      'control-flow': 'control-flow',
      'data-structures': 'class', // Python的数据结构通常映射为类
      'types-decorators': 'type'
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
    if (nodeType.includes('async')) complexity += 1;
    if (nodeType.includes('decorated')) complexity += 1;

    // Python特有的复杂度因素
    const text = mainNode.text || '';
    if (text.includes('yield')) complexity += 1; // 生成器
    if (text.includes('await')) complexity += 1; // 异步等待
    if (text.includes('lambda')) complexity += 1; // Lambda表达式
    if (text.includes('@')) complexity += 1; // 装饰器

    return complexity;
  }

  extractDependencies(result: any): string[] {
    const dependencies: string[] = [];
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return dependencies;
    }

    // 查找导入引用
    this.findImportReferences(mainNode, dependencies);
    
    // 查找函数调用
    this.findFunctionCalls(mainNode, dependencies);

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return modifiers;
    }

    // 检查装饰器 - 检查捕获中是否有装饰器
    const hasDecoratorCapture = result.captures?.some((capture: any) => capture.name === 'decorator' || capture.node?.type === 'decorator');
    if (hasDecoratorCapture || this.hasDecorators(mainNode)) {
      modifiers.push('decorated');
    }

    // 检查异步
    const text = mainNode.text || '';
    if (text.includes('async')) {
      modifiers.push('async');
    }

    // 检查生成器
    if (text.includes('yield')) {
      modifiers.push('generator');
    }

    // 检查类方法修饰符
    if (this.isClassMethod(mainNode)) {
      if (this.isStaticMethod(mainNode)) {
        modifiers.push('static');
      }
      if (this.isClassMethod(mainNode)) {
        modifiers.push('classmethod');
      }
      if (this.isPropertyMethod(mainNode)) {
        modifiers.push('property');
      }
    }

    return modifiers;
  }

  // Python特定的辅助方法

  private extractDecorators(node: any): string[] {
    const decorators: string[] = [];
    const decoratorsNode = node.children?.find((child: any) => child.type === 'decorators');
    
    if (decoratorsNode) {
      for (const child of decoratorsNode.children) {
        if (child.type === 'decorator' && child.text) {
          decorators.push(child.text.trim());
        }
      }
    }
    
    return decorators;
  }

  private hasDecorators(node: any): boolean {
    return node.children?.some((child: any) => child.type === 'decorators') || false;
  }

  private isClassMethod(node: any): boolean {
    // 检查是否是类方法（通过检查父节点是否是类定义）
    let parent = node.parent;
    while (parent) {
      if (parent.type === 'class_definition') {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  private isStaticMethod(node: any): boolean {
    const text = node.text || '';
    return text.includes('@staticmethod') || text.includes('@classmethod');
  }

  private isPropertyMethod(node: any): boolean {
    const text = node.text || '';
    return text.includes('@property');
  }

  private hasTypeHints(parameters: any): boolean {
    if (!parameters || !parameters.children) {
      return false;
    }
    
    return parameters.children.some((child: any) => 
      child.type === 'typed_parameter' || child.type === 'type_annotation'
    );
  }

  private extractSuperclassNames(superclasses: any): string[] {
    const names: string[] = [];
    
    if (superclasses && superclasses.children) {
      for (const child of superclasses.children) {
        if (child.type === 'identifier' || child.type === 'dotted_name') {
          names.push(child.text);
        }
      }
    }
    
    return names;
  }

  private findImportReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找导入引用
      if (child.type === 'identifier' || child.type === 'dotted_name') {
        dependencies.push(child.text);
      }
      
      this.findImportReferences(child, dependencies);
    }
  }

  private findFunctionCalls(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找函数调用
      if (child.type === 'call') {
        const functionNode = child.childForFieldName('function');
        if (functionNode?.text) {
          dependencies.push(functionNode.text);
        }
      }
      
      this.findFunctionCalls(child, dependencies);
    }
  }

  // 重写isBlockNode方法以支持Python特定的块节点类型
  protected isBlockNode(node: any): boolean {
    const pythonBlockTypes = ['block', 'suite'];
    return pythonBlockTypes.includes(node.type) || super.isBlockNode(node);
  }
}