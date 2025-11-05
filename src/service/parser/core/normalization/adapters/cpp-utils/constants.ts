/**
 * C++语言适配器常量定义
 * 包含节点类型映射、查询类型映射等常量
 */

export const CPP_NODE_TYPE_MAPPING: Record<string, string> = {
  // 类和结构体相关
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

export const CPP_QUERY_TYPE_MAPPING: Record<string, string> = {
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
  'concurrency-relationships': 'concurrency',
  'control-flow-relationships': 'control-flow',
  'lifecycle-relationships': 'lifecycle',
  'semantic-relationships': 'semantic'
};

export const CPP_SUPPORTED_QUERY_TYPES = [
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

export const CPP_NAME_CAPTURES = [
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

export const CPP_BLOCK_NODE_TYPES = [
  'compound_statement', 'class_specifier', 'struct_specifier', 'function_definition',
  'method_declaration', 'namespace_definition', 'if_statement', 'for_statement',
  'while_statement', 'do_statement', 'switch_statement', 'try_statement', 'template_declaration'
];

export const CPP_MODIFIERS = [
  'virtual',
  'static',
  'const',
  'volatile',
  'inline',
  'extern',
  'mutable',
  'thread_local',
  'constexpr',
  'consteval',
  'constinit',
  'explicit',
  'override',
  'final',
  'noexcept',
  'throw',
  'public',
  'private',
  'protected',
  'friend',
  'coroutine',
  'requires',
  'concept',
  'decltype'
];

export const CPP_COMPLEXITY_KEYWORDS = [
  { keyword: 'template', pattern: 'template', weight: 2 },
  { keyword: 'virtual', pattern: 'virtual', weight: 1 },
  { keyword: 'override', pattern: 'override', weight: 1 },
  { keyword: 'constexpr', pattern: 'constexpr', weight: 1 },
  { keyword: 'consteval', pattern: 'consteval', weight: 1 },
  { keyword: 'constinit', pattern: 'constinit', weight: 1 },
  { keyword: 'noexcept', pattern: 'noexcept', weight: 1 },
  { keyword: 'lambda', pattern: 'lambda|\\[\\]', weight: 1 },
  { keyword: 'coroutine', pattern: 'co_await|co_yield|co_return', weight: 2 },
  { keyword: 'concept', pattern: 'concept', weight: 2 },
  { keyword: 'requires', pattern: 'requires', weight: 1 },
  { keyword: 'multithreading', pattern: 'thread|mutex|condition_variable', weight: 2 },
  { keyword: 'smart_pointer', pattern: 'unique_ptr|shared_ptr|weak_ptr', weight: 1 },
  { keyword: 'namespace', pattern: 'std::|::', weight: 1 },
  { keyword: 'exception', pattern: 'try|catch', weight: 1 },
  { keyword: 'class', pattern: 'class|struct', weight: 2 },
  { keyword: 'function', pattern: 'function|method', weight: 1 },
  { keyword: 'operator', pattern: 'operator', weight: 1 },
  { keyword: 'data_flow', pattern: 'data-flow', weight: 2 },
  { keyword: 'semantic_relationship', pattern: 'semantic-relationship', weight: 3 },
  { keyword: 'lifecycle_relationship', pattern: 'lifecycle-relationship', weight: 3 },
  { keyword: 'concurrency_relationship', pattern: 'concurrency-relationship', weight: 3 }
];