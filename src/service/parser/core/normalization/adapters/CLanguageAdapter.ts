import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult } from '../types';

/**
 * C 语言适配器
 * 专门处理C语言的查询结果标准化
 */
export class CLanguageAdapter extends BaseLanguageAdapter {
  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  getSupportedQueryTypes(): string[] {
    return [
      'functions',
      'structs',
      'variables',
      'preprocessor',
      'control-flow',
      'data-flow',
      'control-flow-relationships',
      'semantic-relationships',
      'lifecycle-relationships',
      'concurrency-relationships'
    ];
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {// 函数相关
      'function_definition': 'function',
      'function_declarator': 'function',
      'parameter_declaration': 'parameter',
      'call_expression': 'call',

      // 结构体和类型相关
      'struct_specifier': 'struct',
      'union_specifier': 'union',
      'enum_specifier': 'enum',
      'type_definition': 'type',
      'field_declaration': 'field',
      'array_declarator': 'array',
      'pointer_declarator': 'pointer',
      'field_expression': 'member',
      'subscript_expression': 'subscript',

      // 变量相关
      'declaration': 'variable',
      'init_declarator': 'variable',
      'assignment_expression': 'assignment',

      // 预处理器相关
      'preproc_def': 'macro',
      'preproc_function_def': 'macro',
      'preproc_include': 'include',
      'preproc_if': 'preproc_condition',
      'preproc_ifdef': 'preproc_ifdef',
      'preproc_elif': 'preproc_condition',
      'preproc_else': 'preproc_else',

      // 控制流相关
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
      'parenthesized_expression': 'parenthesized_expression',
      'comma_expression': 'comma_expression',
      'conditional_expression': 'conditional_expression',
      'generic_expression': 'generic_expression',
      'alignas_qualifier': 'alignas_qualifier',
      'alignof_expression': 'alignof_expression',
      'extension_expression': 'extension_expression',

      // 字面量和类型
      'comment': 'comment',
      'number_literal': 'number_literal',
      'string_literal': 'string_literal',
      'char_literal': 'char_literal',
      'true': 'boolean_literal',
      'false': 'boolean_literal',
      'null': 'null_literal',
      'type_qualifier': 'type_qualifier',
      'storage_class_specifier': 'storage_class',
      'primitive_type': 'primitive_type',
      // 通用标识符映射
      'identifier': 'identifier',
      'type_identifier': 'type_identifier',
      'field_identifier': 'field_identifier',
      'parameter_list': 'parameter_list',
      'statement_identifier': 'statement_identifier',
      'system_lib_string': 'system_lib_string',
      '_': 'wildcard',
    };

    return typeMapping[nodeType] || nodeType;
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      'name.definition.function',
      'name.definition.struct',
      'name.definition.union',
      'name.definition.enum',
      'name.definition.type',
      'name.definition.field',
      'name.definition.array',
      'name.definition.pointer',
      'name.definition.member',
      'name.definition.subscript',
      'name.definition.variable',
      'name.definition.assignment',
      'name.definition.macro',
      'name.definition.include',
      'name.definition.preproc_condition',
      'name.definition.preproc_ifdef',
      'name.definition.label',
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

    // 对于C语言，尝试从特定字段提取名称
    const mainNode = result.captures?.[0]?.node;
    if (mainNode) {
      // 尝试获取标识符
      const identifier = mainNode.childForFieldName?.('identifier') ||
        mainNode.childForFieldName?.('type_identifier') ||
        mainNode.childForFieldName?.('field_identifier');
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

    // 提取存储类说明符
    const storageClass = mainNode.childForFieldName?.('storage_class_specifier');
    if (storageClass) {
      extra.storageClass = storageClass.text;
    }

    // 提取类型限定符
    const typeQualifier = mainNode.childForFieldName?.('type_qualifier');
    if (typeQualifier) {
      extra.typeQualifier = typeQualifier.text;
    }

    // 检查是否是宏定义
    if (mainNode.type === 'preproc_def' || mainNode.type === 'preproc_function_def') {
      extra.isMacro = true;
    }

    // 检查是否是指针
    const text = mainNode.text || '';
    if (text.includes('*')) {
      extra.isPointer = true;
    }

    return extra;
  }

  mapQueryTypeToStandardType(queryType: string): 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' | 'data-flow' | 'parameter-flow' | 'return-flow' | 'exception-flow' | 'callback-flow' | 'semantic-relationship' | 'lifecycle-event' | 'concurrency-primitive' {
    const mapping: Record<string, 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' | 'data-flow' | 'parameter-flow' | 'return-flow' | 'exception-flow' | 'callback-flow' | 'semantic-relationship' | 'lifecycle-event' | 'concurrency-primitive'> = {
      'functions': 'function',
      'structs': 'class',  // 结构体映射为类
      'variables': 'variable',
      'preprocessor': 'expression',  // 预处理器映射为表达式
      'control-flow': 'control-flow',
      'data-flow': 'data-flow',
      'control-flow-relationships': 'control-flow',
      'semantic-relationships': 'semantic-relationship',
      'lifecycle-relationships': 'lifecycle-event',
      'concurrency-relationships': 'concurrency-primitive'
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
    if (nodeType.includes('function')) complexity += 1;
    if (nodeType.includes('struct') || nodeType.includes('union') || nodeType.includes('enum')) complexity += 1;
    if (nodeType.includes('data-flow')) complexity += 2;
    if (nodeType.includes('control-flow-relationship')) complexity += 2;
    if (nodeType.includes('semantic-relationship')) complexity += 3;
    if (nodeType.includes('lifecycle-relationship')) complexity += 3;
    if (nodeType.includes('concurrency-relationship')) complexity += 3;

    // C语言特定的复杂度因素
    const text = mainNode.text || '';
    if (text.includes('pointer') || text.includes('*')) complexity += 1; // 指针
    if (text.includes('static')) complexity += 1; // 静态
    if (text.includes('extern')) complexity += 1; // 外部
    if (text.includes('const')) complexity += 1; // 常量
    if (text.includes('volatile')) complexity += 1; // 易变
    if (text.includes('->') || text.includes('.')) complexity += 1; // 成员访问
    if (text.includes('sizeof')) complexity += 1; // 尺寸计算
    if (text.includes('malloc') || text.includes('free')) complexity += 1; // 内存管理
    if (text.includes('thread') || text.includes('mutex')) complexity += 2; // 多线程
    if (text.includes('signal')) complexity += 1; // 信号处理

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

    // 检查C语言常见的修饰符
    const text = mainNode.text || '';

    if (text.includes('static')) modifiers.push('static');
    if (text.includes('extern')) modifiers.push('extern');
    if (text.includes('const')) modifiers.push('const');
    if (text.includes('volatile')) modifiers.push('volatile');
    if (text.includes('inline')) modifiers.push('inline');
    if (text.includes('register')) modifiers.push('register');
    if (text.includes('auto')) modifiers.push('auto');
    if (text.includes('restrict')) modifiers.push('restrict');
    if (text.includes('_Atomic')) modifiers.push('atomic');
    if (text.includes('thread_local')) modifiers.push('thread_local');
    if (text.includes('_Noreturn')) modifiers.push('_Noreturn');
    if (text.includes('_Thread_local')) modifiers.push('_Thread_local');
    if (text.includes('__attribute__')) modifiers.push('attribute');

    return modifiers;
  }

  // C语言特定的辅助方法

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
              funcText.includes('lock') || funcText.includes('signal')) {
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

    // 函数指针调用关系
    if (mainNode.type === 'call_expression') {
      const funcNode = mainNode.childForFieldName('function');
      if (funcNode?.type === 'identifier') {
        // 在C语言中，函数指针赋值可以表示某种语义关系
        // 这里只是示例，实际实现会更复杂
        relationships.push({
          source: 'function_pointer',
          target: funcNode.text,
          type: 'delegates'
        });
      }
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

    // 内存分配关系
    const text = mainNode.text || '';
    if (text.includes('malloc') || text.includes('calloc') || text.includes('realloc')) {
      relationships.push({
        source: 'memory_allocator',
        target: 'allocated_memory',
        type: 'instantiates'
      });
    }
    
    // 内存释放关系
    if (text.includes('free')) {
      relationships.push({
        source: 'memory_manager',
        target: 'allocated_memory',
        type: 'destroys'
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
    // C语言并发关系（如使用pthread库）
    if (text.includes('pthread_mutex_lock') || text.includes('pthread_mutex_unlock')) {
      relationships.push({
        source: 'mutex',
        target: 'critical_section',
        type: 'locks'
      });
    }
    
    if (text.includes('pthread_create')) {
      relationships.push({
        source: 'thread_creator',
        target: 'new_thread',
        type: 'synchronizes'
      });
    }

    return relationships;
  }

  // 重写isBlockNode方法以支持C语言特定的块节点类型
  protected isBlockNode(node: any): boolean {
    const cBlockTypes = [
      'compound_statement', 'function_definition', 'if_statement', 'for_statement',
      'while_statement', 'do_statement', 'switch_statement', 'struct_specifier', 'union_specifier'
    ];
    return cBlockTypes.includes(node.type) || super.isBlockNode(node);
  }
}