/**
 * C语言适配器常量定义
 * 包含节点类型映射、查询类型映射等常量
 */

export const C_NODE_TYPE_MAPPING: Record<string, string> = {
  // 函数相关
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

export const C_QUERY_TYPE_MAPPING: Record<string, string> = {
  'functions': 'function',
  'structs': 'class',  // 结构体映射为类
  'variables': 'variable',
  'preprocessor': 'expression',  // 预处理器映射为表达式
  'control-flow': 'control-flow',
  'calls': 'call',
  'data-flows': 'data-flow',
  'inheritance': 'inheritance',
  'comments': 'comment',
  // 新增的高级关系查询类型
  'concurrency': 'concurrency',
  'lifecycle': 'lifecycle',
  'semantic': 'semantic'
};

export const C_SUPPORTED_QUERY_TYPES = [
  // Entity types
  'functions',
  'structs',
  'variables',
  'preprocessor',
  'control-flow',
  'comments',
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

export const C_NAME_CAPTURES = [
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

export const C_BLOCK_NODE_TYPES = [
  'compound_statement', 'function_definition', 'if_statement', 'for_statement',
  'while_statement', 'do_statement', 'switch_statement', 'struct_specifier', 'union_specifier'
];

export const C_FUNCTION_NODE_TYPES = [
  'function_definition',
  'function_declarator'
];

export const C_MODIFIERS = [
  'static',
  'extern',
  'const',
  'volatile',
  'inline',
  'register',
  'auto',
  'restrict',
  '_Atomic',
  'thread_local',
  '_Noreturn',
  '_Thread_local',
  '__attribute__'
];

export const C_COMPLEXITY_KEYWORDS = [
  { keyword: 'pointer', pattern: '*', weight: 1 },
  { keyword: 'static', pattern: 'static', weight: 1 },
  { keyword: 'extern', pattern: 'extern', weight: 1 },
  { keyword: 'const', pattern: 'const', weight: 1 },
  { keyword: 'volatile', pattern: 'volatile', weight: 1 },
  { keyword: 'member_access', pattern: '->|\\.', weight: 1 },
  { keyword: 'sizeof', pattern: 'sizeof', weight: 1 },
  { keyword: 'memory_management', pattern: 'malloc|free', weight: 1 },
  { keyword: 'multithreading', pattern: 'thread|mutex', weight: 2 },
  { keyword: 'signal_handling', pattern: 'signal', weight: 1 }
];