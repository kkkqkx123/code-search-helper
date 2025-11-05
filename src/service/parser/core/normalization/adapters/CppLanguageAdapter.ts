import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult, SymbolInfo, SymbolTable } from '../types';
import { generateDeterministicNodeId } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
type StandardType = StandardizedQueryResult['type'];

/**
 * C++ 语言适配器
 * 专门处理C++语言的查询结果标准化
 */
export class CppLanguageAdapter extends BaseLanguageAdapter {
  // In-memory symbol table for the current file
  private symbolTable: SymbolTable | null = null;

  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  getSupportedQueryTypes(): string[] {
    return [
      // Entity types
      'functions',
      'classes',
      'variables',
      'types',
      'namespaces',
      'preprocessor',
      'control-flow',
      'modern-features',
      // Relationship types
      'calls',
      'data-flows',
      'inheritance',
      // Advanced relationship types
      'concurrency-relationships',
      'control-flow-relationships',
      'lifecycle-relationships',
      'semantic-relationships'
    ];
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {// 类和结构体相关
      'struct_specifier': 'class',
      'union_specifier': 'class',
      'class_specifier': 'class',
      'template_declaration': 'template',
      'access_specifier': 'access_specifier',
      'base_class_clause': 'base_class',
      'member_initializer': 'member_initializer',
      'friend_declaration': 'friend',

      // 函数相关
      'function_definition': 'function',
      'function_declarator': 'function',
      'field_declarator': 'method',  // 类方法
      'declaration': 'function',  // 函数声明
      'lambda_expression': 'lambda',
      'operator_name': 'operator',
      'constructor_initializer': 'constructor',
      'destructor_name': 'destructor',
      'virtual_specifier': 'virtual_specifier',
      'co_await_expression': 'co_await_expression',
      'co_yield_expression': 'co_yield_expression',
      'co_return_statement': 'co_return_statement',

      // 变量相关
      'init_declarator': 'variable',
      'structured_binding_declarator': 'binding',
      'parameter_pack_expansion': 'parameter_pack',
      'assignment_expression': 'assignment',
      'call_expression': 'call',
      'field_expression': 'member',

      // 类型相关
      'type_definition': 'type',
      'type_alias_declaration': 'type_alias',
      'enum_specifier': 'enum',
      'concept_definition': 'concept',
      'template_function': 'template',
      'template_type': 'template',
      'auto': 'auto_var',
      'type_qualifier': 'type_qualifier',
      'primitive_type': 'primitive_type',

      // 命名空间相关
      'namespace_definition': 'namespace',
      'using_declaration': 'using',

      // 预处理器相关
      'preproc_function_def': 'macro',
      'preproc_def': 'macro',
      'preproc_include': 'include',
      'preproc_if': 'preproc_condition',
      'preproc_ifdef': 'preproc_ifdef',
      'preproc_elif': 'preproc_condition',
      'preproc_else': 'preproc_else',
      'preproc_endif': 'preproc_endif',
      'preproc_call': 'preproc_call',

      // 控制流相关
      'try_statement': 'try_statement',
      'catch_clause': 'catch_clause',
      'throw_specifier': 'throw_specifier',
      'noexcept_specifier': 'noexcept_specifier',
      'range_based_for_statement': 'range_for',
      'if_statement': 'control_statement',
      'for_statement': 'control_statement',
      'while_statement': 'control_statement',
      'do_statement': 'control_statement',
      'switch_statement': 'control_statement',
      'case_statement': 'control_statement',
      'break_statement': 'control_statement',
      'continue_statement': 'control_statement',
      'return_statement': 'control_statement',
      'goto_statement': 'control_statement',
      'labeled_statement': 'label',
      'compound_statement': 'compound_statement',

      // 表达式相关
      'binary_expression': 'binary_expression',
      'unary_expression': 'unary_expression',
      'update_expression': 'update_expression',
      'cast_expression': 'cast_expression',
      'sizeof_expression': 'sizeof_expression',
      'typeid_expression': 'typeid_expression',
      'parenthesized_expression': 'parenthesized_expression',
      'conditional_expression': 'conditional_expression',
      'new_expression': 'new_expression',
      'delete_expression': 'delete_expression',
      'comment': 'comment',
      'number_literal': 'number_literal',
      'string_literal': 'string_literal',
      'char_literal': 'char_literal',
      'true': 'boolean_literal',
      'false': 'boolean_literal',

      // 现代特性
      'explicit_specialization': 'explicit_specialization',
      'static_assert_declaration': 'static_assert',
      'attribute_declaration': 'attribute_declaration',
      'attribute_specifier': 'attribute_specifier',
      'requires_clause': 'requires_clause',
      'alignas_specifier': 'alignas_specifier',
      'literal_suffix': 'literal_suffix',
      // 通用标识符映射
      'identifier': 'identifier',
      'type_identifier': 'type_identifier',
      'field_identifier': 'field_identifier',
      'template_parameter_list': 'template_parameter_list',
      'storage_class_specifier': 'storage_class_specifier',
      'explicit_specifier': 'explicit_specifier',
      'namespace_identifier': 'namespace_identifier',
      'statement_identifier': 'statement_identifier',
      'system_lib_string': 'system_lib_string',
      '_': 'wildcard',
    };

    return typeMapping[nodeType] || nodeType;
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      'name.definition.class',
      'name.definition.template.class',
      'name.definition.template.struct',
      'name.definition.function',
      'name.definition.method',
      'name.definition.template.function',
      'name.definition.constructor',
      'name.definition.destructor',
      'name.definition.operator',
      'name.definition.operator.new',
      'name.definition.operator.delete',
      'name.definition.variable',
      'name.definition.binding',
      'name.definition.assignment',
      'name.definition.call',
      'name.definition.member',
      'name.definition.type',
      'name.definition.type_alias',
      'name.definition.enum',
      'name.definition.template.enum',
      'name.definition.concept',
      'name.definition.template.instantiation',
      'name.definition.auto_var',
      'name.definition.namespace',
      'name.definition.using',
      'name.definition.macro',
      'name.definition.include',
      'name.definition.preproc_condition',
      'name.definition.preproc_ifdef',
      'name.definition.label',
      'name.definition.try_statement',
      'name.definition.catch_clause',
      'name.definition.range_for',
      'name.definition.control_statement',
      'name.definition.compound_statement',
      'name.definition.binary_expression',
      'name.definition.unary_expression',
      'name.definition.update_expression',
      'name.definition.cast_expression',
      'name.definition.sizeof_expression',
      'name.definition.typeid_expression',
      'name.definition.parenthesized_expression',
      'name.definition.conditional_expression',
      'name.definition.new_expression',
      'name.definition.delete_expression',
      'name.definition.comment',
      'name.definition.number_literal',
      'name.definition.string_literal',
      'name.definition.char_literal',
      'name.definition.boolean_literal',
      'name.definition.explicit_specialization',
      'name.definition.static_assert',
      'name.definition.attribute_declaration',
      'name.definition.attribute_specifier',
      'name.definition.requires_clause',
      'name.definition.alignas_specifier',
      'name.definition.literal_suffix',
      'name',
      'identifier'
    ];

    for (const captureName of nameCaptures) {
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
    const mapping: Record<string, StandardType> = {
      'functions': 'function',
      'classes': 'class',
      'variables': 'variable',
      'types': 'type',
      'namespaces': 'class',  // 命名空间映射为类
      'preprocessor': 'expression',  // 预处理器映射为表达式
      'control-flow': 'control-flow',
      'modern-features': 'expression',  // 现代特性映射为表达式
      
      // 关系类型
      'calls': 'call',
      'data-flows': 'data-flow',
      'inheritance': 'inheritance',
      // ... 其他关系类型
      'concurrency-relationships': 'concurrency',
      'control-flow-relationships': 'control-flow',
      'lifecycle-relationships': 'lifecycle',
      'semantic-relationships': 'semantic'
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
    if (text.includes('template')) complexity += 2; // 模板
    if (text.includes('virtual')) complexity += 1; // 虚函数
    if (text.includes('override')) complexity += 1; // 重写
    if (text.includes('constexpr')) complexity += 1; // 常量表达式
    if (text.includes('consteval')) complexity += 1; // 立即函数
    if (text.includes('constinit')) complexity += 1; // 常量初始化
    if (text.includes('noexcept')) complexity += 1; // 异常规范
    if (text.includes('lambda') || text.includes('[]')) complexity += 1; // Lambda表达式
    if (text.includes('co_await') || text.includes('co_yield') || text.includes('co_return')) complexity += 2; // 协程
    if (text.includes('concept')) complexity += 2; // 概念
    if (text.includes('requires')) complexity += 1; // 约束
    if (text.includes('thread') || text.includes('mutex') || text.includes('condition_variable')) complexity += 2; // 多线程
    if (text.includes('unique_ptr') || text.includes('shared_ptr') || text.includes('weak_ptr')) complexity += 1; // 智能指针
    if (text.includes('std::') || text.includes('::')) complexity += 1; // 命名空间使用
    if (text.includes('try') || text.includes('catch')) complexity += 1; // 异常处理

    return complexity;
  }

  extractDependencies(result: any): string[] {
    const dependencies: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return dependencies;
    }

    // 查找类型引用
    this.findTypeReferences(mainNode, dependencies);

    // 查找函数调用引用
    this.findFunctionCalls(mainNode, dependencies);

    // 查找模板依赖
    this.findTemplateDependencies(mainNode, dependencies);

    // 查找数据流依赖
    this.findDataFlowDependencies(mainNode, dependencies);

    // 查找并发相关依赖
    this.findConcurrencyDependencies(mainNode, dependencies);

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return modifiers;
    }

    // 检查C++常见的修饰符
    const text = mainNode.text || '';

    if (text.includes('virtual')) modifiers.push('virtual');
    if (text.includes('static')) modifiers.push('static');
    if (text.includes('const')) modifiers.push('const');
    if (text.includes('volatile')) modifiers.push('volatile');
    if (text.includes('inline')) modifiers.push('inline');
    if (text.includes('extern')) modifiers.push('extern');
    if (text.includes('mutable')) modifiers.push('mutable');
    if (text.includes('thread_local')) modifiers.push('thread_local');
    if (text.includes('constexpr')) modifiers.push('constexpr');
    if (text.includes('consteval')) modifiers.push('consteval');
    if (text.includes('constinit')) modifiers.push('constinit');
    if (text.includes('explicit')) modifiers.push('explicit');
    if (text.includes('override')) modifiers.push('override');
    if (text.includes('final')) modifiers.push('final');
    if (text.includes('noexcept')) modifiers.push('noexcept');
    if (text.includes('throw')) modifiers.push('throw');
    if (text.includes('public:')) modifiers.push('public');
    if (text.includes('private:')) modifiers.push('private');
    if (text.includes('protected:')) modifiers.push('protected');
    if (text.includes('friend')) modifiers.push('friend');
    if (text.includes('co_await')) modifiers.push('coroutine');
    if (text.includes('co_yield')) modifiers.push('coroutine');
    if (text.includes('co_return')) modifiers.push('coroutine');
    if (text.includes('requires')) modifiers.push('requires');
    if (text.includes('concept')) modifiers.push('concept');
    if (text.includes('decltype')) modifiers.push('decltype');

    return modifiers;
  }

  // C++特定的辅助方法

  private findFunctionCalls(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找函数调用
      if (child.type === 'call_expression') {
        const functionNode = child.childForFieldName('function');
        if (functionNode?.text) {
          dependencies.push(functionNode.text);
        }
      }

      this.findFunctionCalls(child, dependencies);
    }
  }

  private findTemplateDependencies(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找模板实例化
      if (child.type === 'template_function' || child.type === 'template_type') {
        const identifier = child.childForFieldName('identifier') ||
          child.childForFieldName('type_identifier');
        if (identifier?.text) {
          dependencies.push(identifier.text);
        }
      }

      this.findTemplateDependencies(child, dependencies);
    }
  }

  private findDataFlowDependencies(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找赋值表达式中的依赖
      if (child.type === 'assignment_expression') {
        const rightSide = child.childForFieldName('right');
        if (rightSide?.type === 'identifier' && rightSide.text) {
          dependencies.push(rightSide.text);
        }
      }

      this.findDataFlowDependencies(child, dependencies);
    }
  }

  private findConcurrencyDependencies(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找并发相关函数
      if (child.type === 'call_expression') {
        const functionNode = child.childForFieldName('function');
        if (functionNode?.text) {
          const funcText = functionNode.text.toLowerCase();
          if (funcText.includes('thread') || funcText.includes('mutex') || 
              funcText.includes('lock') || funcText.includes('future') || 
              funcText.includes('promise') || funcText.includes('async')) {
            dependencies.push(funcText);
          }
        }
      }

      this.findConcurrencyDependencies(child, dependencies);
    }
  }

  // 高级关系提取方法
  extractDataFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'assignment' | 'parameter' | 'return';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'assignment' | 'parameter' | 'return';
    }> = [];
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 提取赋值关系
    if (mainNode.type === 'assignment_expression') {
      const leftNode = mainNode.childForFieldName('left');
      const rightNode = mainNode.childForFieldName('right');
      if (leftNode?.text && rightNode?.text) {
        relationships.push({
          source: rightNode.text,
          target: leftNode.text,
          type: 'assignment'
        });
      }
    }
    
    // 提取参数传递关系
    if (mainNode.type === 'call_expression') {
      const funcNode = mainNode.childForFieldName('function');
      const argsNode = mainNode.childForFieldName('arguments');
      
      if (funcNode?.text && argsNode) {
        for (const arg of argsNode.children || []) {
          if (arg.type === 'identifier' && arg.text) {
            relationships.push({
              source: arg.text,
              target: funcNode.text,
              type: 'parameter'
            });
          }
        }
      }
    }
    
    // 提取返回值关系
    if (mainNode.type === 'return_statement') {
      const valueNode = mainNode.children?.find((child: any) => child.type === 'identifier');
      if (valueNode?.text) {
        relationships.push({
          source: valueNode.text,
          target: 'function_return',
          type: 'return'
        });
      }
    }
    
    // 提取智能指针关系
    if (mainNode.type === 'call_expression') {
      const funcNode = mainNode.childForFieldName('function');
      if (funcNode?.text && (funcNode.text.includes('make_unique') || funcNode.text.includes('make_shared'))) {
        const argsNode = mainNode.childForFieldName('arguments');
        if (argsNode) {
          for (const arg of argsNode.children || []) {
            if (arg.type === 'identifier' && arg.text) {
              relationships.push({
                source: arg.text,
                target: funcNode.text,
                type: 'assignment'
              });
            }
          }
        }
      }
    }

    return relationships;
  }

  extractControlFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'conditional' | 'loop' | 'exception' | 'callback';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'conditional' | 'loop' | 'exception' | 'callback';
    }> = [];
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 条件控制流
    if (mainNode.type === 'if_statement' || mainNode.type === 'conditional_expression') {
      const condition = mainNode.childForFieldName('condition')?.text || 'condition';
      relationships.push({
        source: condition,
        target: 'if_branch',
        type: 'conditional'
      });
    }
    
    // 循环控制流
    if (mainNode.type.includes('for_') || mainNode.type.includes('while_') || mainNode.type === 'do_statement') {
      relationships.push({
        source: 'loop_condition',
        target: 'loop_body',
        type: 'loop'
      });
    }
    
    // 异常控制流
    if (mainNode.type === 'try_statement' || mainNode.type === 'catch_clause') {
      relationships.push({
        source: 'exception_source',
        target: 'catch_handler',
        type: 'exception'
      });
    }

    return relationships;
  }

  extractSemanticRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
    }> = [];
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 虚函数重写关系
    const text = mainNode.text || '';
    if (text.includes('override')) {
      relationships.push({
        source: 'derived_method',
        target: 'base_method',
        type: 'overrides'
      });
    }
    
    // 函数重载关系
    if (mainNode.type === 'function_definition' && text.includes('operator')) {
      relationships.push({
        source: 'operator',
        target: 'operands',
        type: 'overloads'
      });
    }
    
    // 模板特化关系
    if (mainNode.type === 'template_declaration') {
      relationships.push({
        source: 'template_specialization',
        target: 'primary_template',
        type: 'overloads'
      });
    }

    return relationships;
  }

  extractLifecycleRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'instantiates' | 'initializes' | 'destroys' | 'manages';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'instantiates' | 'initializes' | 'destroys' | 'manages';
    }> = [];
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    // 构造函数关系
    if (mainNode.type === 'function_definition' && 
        (mainNode.text?.includes('constructor') || mainNode.text?.includes('ctor'))) {
      relationships.push({
        source: 'constructor',
        target: 'object_instance',
        type: 'initializes'
      });
    }
    
    // 析构函数关系
    if (mainNode.type === 'function_definition' && 
        (mainNode.text?.includes('destructor') || mainNode.text?.includes('dtor'))) {
      relationships.push({
        source: 'destructor',
        target: 'object_instance',
        type: 'destroys'
      });
    }
    
    // 智能指针管理关系
    const text = mainNode.text || '';
    if (text.includes('unique_ptr') || text.includes('shared_ptr')) {
      relationships.push({
        source: 'smart_pointer',
        target: 'managed_object',
        type: 'manages'
      });
    }

    return relationships;
  }

  extractConcurrencyRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'synchronizes' | 'locks' | 'communicates' | 'races';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'synchronizes' | 'locks' | 'communicates' | 'races';
    }> = [];
    
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return relationships;
    }

    const text = mainNode.text || '';
    // C++并发关系（如使用std::thread, std::mutex等）
    if (text.includes('std::mutex') || text.includes('lock_guard') || text.includes('unique_lock')) {
      relationships.push({
        source: 'mutex',
        target: 'critical_section',
        type: 'locks'
      });
    }
    
    if (text.includes('std::thread')) {
      relationships.push({
        source: 'thread_creator',
        target: 'new_thread',
        type: 'synchronizes'
      });
    }
    
    if (text.includes('std::promise') || text.includes('std::future') || text.includes('std::async')) {
      relationships.push({
        source: 'sync_object',
        target: 'async_operation',
        type: 'communicates'
      });
    }

    return relationships;
  }

  // 重写isBlockNode方法以支持C++特定的块节点类型
  protected isBlockNode(node: any): boolean {
    const cppBlockTypes = [
      'compound_statement', 'class_specifier', 'struct_specifier', 'function_definition',
      'method_declaration', 'namespace_definition', 'if_statement', 'for_statement',
      'while_statement', 'do_statement', 'switch_statement', 'try_statement', 'template_declaration'
    ];
    return cppBlockTypes.includes(node.type) || super.isBlockNode(node);
  }

  // 重写normalize方法以集成nodeId生成和符号信息
  async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
    const results: StandardizedQueryResult[] = [];

    // Initialize symbol table for the current processing context
    // In a real scenario, filePath would be passed in. For now, we'll use a placeholder.
    const filePath = 'current_file.cpp';
    this.symbolTable = {
      filePath,
      globalScope: { symbols: new Map() },
      imports: new Map()
    };

    for (const result of queryResults) {
      try {
        const standardType = this.mapQueryTypeToStandardType(queryType);
        const name = this.extractName(result);
        const content = this.extractContent(result);
        const complexity = this.calculateComplexity(result);
        const dependencies = this.extractDependencies(result);
        const modifiers = this.extractModifiers(result);
        const extra = this.extractLanguageSpecificMetadata(result);

        // 获取AST节点以生成确定性ID
        const astNode = result.captures?.[0]?.node;
        const nodeId = astNode ? generateDeterministicNodeId(astNode) : `${standardType}:${name}:${Date.now()}`;

        let symbolInfo: SymbolInfo | null = null;
        let relationshipMetadata: any = null;

        // Only create symbol info for entity types, not relationships
        if (['function', 'class', 'method', 'variable', 'import', 'type'].includes(standardType)) {
          symbolInfo = this.createSymbolInfo(astNode, name, standardType, filePath);
          if (this.symbolTable && symbolInfo) {
            this.symbolTable.globalScope.symbols.set(name, symbolInfo);
          }
        } else {
          // For relationships, extract specific metadata
          relationshipMetadata = this.extractRelationshipMetadata(result, standardType, astNode);
        }

        results.push({
          nodeId,
          type: standardType,
          name,
          startLine: result.startLine || 1,
          endLine: result.endLine || 1,
          content,
          metadata: {
            language,
            complexity,
            dependencies,
            modifiers,
            extra: {
              ...extra,
              ...relationshipMetadata // Merge relationship-specific metadata
            }
          },
          symbolInfo: symbolInfo || undefined
        });
      } catch (error) {
        this.logger?.error(`Error normalizing C++ result: ${error}`);
      }
    }

    return results;
  }

  private createSymbolInfo(node: Parser.SyntaxNode | undefined, name: string, standardType: string, filePath: string): SymbolInfo | null {
    if (!name || !node) return null;

    const symbolType = this.mapToSymbolType(standardType);

    const symbolInfo: SymbolInfo = {
      name,
      type: symbolType,
      filePath,
      location: {
        startLine: node.startPosition.row + 1,
        startColumn: node.startPosition.column,
        endLine: node.endPosition.row + 1,
        endColumn: node.endPosition.column,
      },
      scope: this.determineScope(node)
    };

    // Add parameters for functions
    if (symbolType === 'function' || symbolType === 'method') {
      symbolInfo.parameters = this.extractParameters(node);
    }

    // Add source path for imports
    if (symbolType === 'import') {
      symbolInfo.sourcePath = this.extractImportPath(node);
    }

    return symbolInfo;
  }

  private mapToSymbolType(standardType: string): SymbolInfo['type'] {
    const mapping: Record<string, SymbolInfo['type']> = {
      'function': 'function',
      'method': 'method',
      'class': 'class',
      'interface': 'interface',
      'variable': 'variable',
      'import': 'import'
    };
    return mapping[standardType] || 'variable';
  }

  private determineScope(node: Parser.SyntaxNode): SymbolInfo['scope'] {
    // Simplified scope determination. A real implementation would traverse up the AST.
    let current = node.parent;
    while (current) {
      if (current.type === 'function_definition') {
        return 'function';
      }
      if (current.type === 'class_specifier' || current.type === 'struct_specifier') {
        return 'class';
      }
      current = current.parent;
    }
    return 'global';
  }

  private extractParameters(node: Parser.SyntaxNode): string[] {
    const parameters: string[] = [];
    const parameterList = node.childForFieldName?.('parameters');
    if (parameterList) {
      for (const child of parameterList.children) {
        if (child.type === 'parameter_declaration') {
          const declarator = child.childForFieldName('declarator');
          if (declarator?.text) {
            parameters.push(declarator.text);
          }
        }
      }
    }
    return parameters;
  }

  private extractImportPath(node: Parser.SyntaxNode): string | undefined {
    // For C++ includes
    if (node.type === 'preproc_include') {
      const pathNode = node.childForFieldName('path');
      return pathNode ? pathNode.text.replace(/[<>"]/g, '') : undefined;
    }
    return undefined;
  }

  private extractRelationshipMetadata(result: any, standardType: string, astNode: Parser.SyntaxNode | undefined): any {
    if (!astNode) return null;

    switch (standardType) {
      case 'call':
        return this.extractCallMetadata(result, astNode);
      case 'data-flow':
        return this.extractDataFlowMetadata(result, astNode);
      case 'inheritance':
        return this.extractInheritanceMetadata(result, astNode);
      case 'concurrency':
        return this.extractConcurrencyMetadata(result, astNode);
      case 'lifecycle':
        return this.extractLifecycleMetadata(result, astNode);
      case 'semantic':
        return this.extractSemanticMetadata(result, astNode);
      default:
        return null;
    }
  }

  private extractCallMetadata(result: any, astNode: Parser.SyntaxNode): any {
    const functionNode = astNode.childForFieldName('function');
    const callerNode = this.findCallerFunctionContext(astNode);

    return {
      fromNodeId: callerNode ? generateDeterministicNodeId(callerNode) : 'unknown',
      toNodeId: functionNode ? generateDeterministicNodeId(functionNode) : 'unknown',
      callName: functionNode?.text || 'unknown',
      location: {
        filePath: 'current_file.cpp',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  private extractDataFlowMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // Simplified data flow extraction
    const left = astNode.childForFieldName('left');
    const right = astNode.childForFieldName('right');

    return {
      fromNodeId: right ? generateDeterministicNodeId(right) : 'unknown',
      toNodeId: left ? generateDeterministicNodeId(left) : 'unknown',
      flowType: 'assignment',
      location: {
        filePath: 'current_file.cpp',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  private extractInheritanceMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // For C++, this might be for class inheritance
    // This is a placeholder for more complex logic
    return null;
  }

  private findCallerFunctionContext(callNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let current = callNode.parent;
    while (current) {
      if (current.type === 'function_definition') {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  private extractConcurrencyMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // Placeholder for concurrency metadata extraction
    // This would analyze thread, mutex, condition_variable operations from the query result
    return {
      type: 'concurrency',
      operation: 'unknown', // e.g., 'thread', 'mutex', 'condition_variable'
      location: {
        filePath: 'current_file.cpp',
        lineNumber: astNode.startPosition.row + 1,
      }
    };
  }

  private extractLifecycleMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // Placeholder for lifecycle metadata extraction
    // This would analyze object creation, destruction, etc.
    return {
      type: 'lifecycle',
      operation: 'unknown', // e.g., 'create', 'destroy', 'construct', 'destruct'
      location: {
        filePath: 'current_file.cpp',
        lineNumber: astNode.startPosition.row + 1,
      }
    };
  }

  private extractSemanticMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // Placeholder for semantic metadata extraction
    // This would analyze design patterns, error handling, etc.
    return {
      type: 'semantic',
      pattern: 'unknown', // e.g., 'singleton', 'factory', 'observer'
      location: {
        filePath: 'current_file.cpp',
        lineNumber: astNode.startPosition.row + 1,
      }
    };
  }
}