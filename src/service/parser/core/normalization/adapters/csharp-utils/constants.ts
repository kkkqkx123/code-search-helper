/**
 * C#语言适配器常量定义
 * 包含节点类型映射、查询类型映射等常量
 */

export const CSHARP_NODE_TYPE_MAPPING: Record<string, string> = {
  // 命名空间和类相关
  'namespace_declaration': 'namespace',
  'file_scoped_namespace_declaration': 'namespace',
  'class_declaration': 'class',
  'record_class_declaration': 'record_class',
  'record_struct_declaration': 'record_struct',
  'struct_declaration': 'struct',
  'interface_declaration': 'interface',
  'enum_declaration': 'enum',
  'record_declaration': 'record',
  'constructor_declaration': 'constructor',
  'destructor_declaration': 'destructor',
  'field_declaration': 'field',
  'event_field_declaration': 'event_field',
  'attribute': 'attribute',
  'attribute_list': 'attribute_list',
  'type_parameter': 'type_parameter',

  // 方法相关
  'method_declaration': 'method',
  'operator_declaration': 'operator',
  'conversion_operator_declaration': 'conversion_operator',
  'lambda_expression': 'lambda',
  'anonymous_method_expression': 'anonymous_method',
  'accessor_declaration': 'accessor',
  'get_accessor_declaration': 'get_accessor',
  'set_accessor_declaration': 'set_accessor',
  'init_accessor_declaration': 'init_accessor',
  'add_accessor_declaration': 'add_accessor',
  'remove_accessor_declaration': 'remove_accessor',
  'invocation_expression': 'invocation',

  // 属性和变量相关
  'property_declaration': 'property',
  'indexer_declaration': 'indexer',
  'event_declaration': 'event',
  'delegate_declaration': 'delegate',
  'local_declaration_statement': 'local_variable',
  'for_each_statement': 'loop_variable',
  'catch_declaration': 'catch_variable',
  'declaration_expression': 'declaration_expression',

  // LINQ相关
  'query_expression': 'linq_expression',
  'from_clause': 'linq_from',
  'where_clause': 'linq_where',
  'select_clause': 'linq_select',
  'group_clause': 'linq_group',
  'order_by_clause': 'linq_order',
  'join_clause': 'linq_join',
  'let_clause': 'linq_let',

  // 模式匹配相关
  'is_pattern_expression': 'pattern_is',
  'switch_expression': 'switch_expression',
  'switch_expression_arm': 'switch_arm',
  'constant_pattern': 'constant_pattern',
  'relational_pattern': 'relational_pattern',
  'var_pattern': 'var_pattern',
  'discard_pattern': 'discard_pattern',
  'binary_pattern': 'binary_pattern',
  'unary_pattern': 'unary_pattern',
  'parenthesized_pattern': 'parenthesized_pattern',
  'list_pattern': 'list_pattern',
  'slice_pattern': 'slice_pattern',
  'recursive_pattern': 'recursive_pattern',
  'positional_pattern': 'positional_pattern',
  'property_pattern_clause': 'property_pattern',
  'subpattern': 'subpattern',
  'switch_statement': 'switch_statement',
  'switch_section': 'switch_section',
  'case_switch_label': 'case_label',
  'default_switch_label': 'default_label',
  'case_pattern_switch_label': 'pattern_label',

  // 表达式相关
  'using_directive': 'using',
  'using_statement': 'using',
  'extern_alias_directive': 'extern_alias',
  'type_parameter_constraints_clause': 'type_constraint',
  'conditional_expression': 'conditional',
  'conditional_access_expression': 'conditional_access',
  'member_binding_expression': 'member_binding',
  'element_binding_expression': 'element_binding',
  'assignment_expression': 'assignment',
  'binary_expression': 'binary_operation',
  'unary_expression': 'unary_operation',
  'update_expression': 'update_operation',
  'cast_expression': 'cast',
  'as_expression': 'as_expression',
  'null_coalescing_expression': 'null_coalescing',
  'throw_expression': 'throw_expression',
  'await_expression': 'await_expression',
  'sizeof_expression': 'sizeof_expression',
  'typeof_expression': 'typeof_expression',
  'nameof_expression': 'nameof_expression',
  'default_expression': 'default_expression',
  'interpolated_string_expression': 'interpolated_string',
  'interpolated_verbatim_string_expression': 'interpolated_verbatim_string',
  'interpolated_string_text': 'interpolated_text',
  'interpolation': 'interpolation',
  'with_expression': 'with_expression',
  'member_access_expression': 'member_access',
  'element_access_expression': 'element_access',
  'object_creation_expression': 'object_creation',
  'anonymous_object_creation_expression': 'anonymous_object_creation',
  'array_creation_expression': 'array_creation',
  'implicit_array_creation_expression': 'implicit_array_creation',
  'stack_alloc_array_creation_expression': 'stackalloc_array_creation',
  'array_type': 'array_type',
  'pointer_type': 'pointer_type',
  'nullable_type': 'nullable_type',
  'tuple_type': 'tuple_type',
  'tuple_element': 'tuple_element',
  'tuple_expression': 'tuple',
  'parenthesized_expression': 'parenthesized',
  'identifier': 'identifier',
  'this_expression': 'this',
  'base_expression': 'base',
  'literal': 'literal',
  'string_literal': 'string_literal',
  'character_literal': 'character_literal',
  'numeric_literal': 'numeric_literal',
  'boolean_literal': 'boolean_literal',
  'null_literal': 'null_literal',
  
  // 通用标识符映射
  'qualified_name': 'qualified_name',
};

export const CSHARP_QUERY_TYPE_MAPPING: Record<string, string> = {
  'classes': 'class',
  'methods': 'method',
  'properties': 'variable',  // 属性映射为变量
  'linq': 'expression',  // LINQ映射为表达式
  'patterns': 'expression',  // 模式匹配映射为表达式
  'expressions': 'expression',
  
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

export const CSHARP_SUPPORTED_QUERY_TYPES = [
  // Entity types
  'classes',
  'methods',
  'properties',
  'linq',
  'patterns',
  'expressions',
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

export const CSHARP_NAME_CAPTURES = [
  'name.definition.namespace',
  'name.definition.class',
  'name.definition.record_class',
  'name.definition.record_struct',
  'name.definition.struct',
  'name.definition.interface',
  'name.definition.enum',
  'name.definition.record',
  'name.definition.constructor',
  'name.definition.destructor',
  'name.definition.field',
  'name.definition.event_field',
  'name.definition.attribute',
  'name.definition.type_parameter',
  'name.definition.method',
  'name.definition.operator',
  'name.definition.conversion_operator',
  'name.definition.accessor',
  'name.definition.get_accessor',
  'name.definition.set_accessor',
  'name.definition.init_accessor',
  'name.definition.add_accessor',
  'name.definition.remove_accessor',
  'name.definition.property',
  'name.definition.indexer',
  'name.definition.event',
  'name.definition.delegate',
  'name.definition.local_variable',
  'name.definition.loop_variable',
  'name.definition.catch_variable',
  'name.definition.declaration_expression',
  'name.definition.linq_from',
  'name.definition.linq_select',
  'name.definition.linq_group',
  'name.definition.linq_join_left',
  'name.definition.linq_join_right',
  'name.definition.linq_let',
  'name.definition.var_pattern',
  'name.definition.using',
  'name.definition.extern_alias',
  'name',
  'identifier'
];

export const CSHARP_BLOCK_NODE_TYPES = [
  'class_declaration', 'struct_declaration', 'interface_declaration', 'method_declaration',
  'constructor_declaration', 'property_declaration', 'namespace_declaration', 'block',
  'if_statement', 'for_statement', 'while_statement', 'do_statement', 'switch_statement',
  'try_statement', 'catch_clause', 'finally_clause', 'lambda_expression', 'query_expression'
];

export const CSHARP_MODIFIERS = [
  'public',
  'private',
  'protected',
  'internal',
  'static',
  'readonly',
  'const',
  'virtual',
  'abstract',
  'sealed',
  'override',
  'async',
  'await',
  'extern',
  'unsafe',
  'partial',
  'new',
  'volatile',
  'fixed',
  'lock'
];

export const CSHARP_COMPLEXITY_KEYWORDS = [
  { keyword: 'async', pattern: 'async|await', weight: 1 },
  { keyword: 'lambda', pattern: 'lambda|=>', weight: 1 },
  { keyword: 'linq', pattern: 'LINQ|from|select|where|group|join|let|orderby', weight: 2 },
  { keyword: 'pattern', pattern: 'pattern|is|switch', weight: 1 },
  { keyword: 'generic', pattern: '<.*>', weight: 1 },
  { keyword: 'override', pattern: 'override', weight: 1 },
  { keyword: 'virtual', pattern: 'virtual', weight: 1 },
  { keyword: 'abstract', pattern: 'abstract', weight: 1 },
  { keyword: 'interface', pattern: 'interface', weight: 1 },
  { keyword: 'delegate', pattern: 'delegate', weight: 1 },
  { keyword: 'event', pattern: 'event', weight: 1 },
  { keyword: 'class', pattern: 'class|struct', weight: 2 },
  { keyword: 'method', pattern: 'method|constructor|destructor', weight: 1 },
  { keyword: 'operator', pattern: 'operator', weight: 1 },
  { keyword: 'data_flow', pattern: 'data-flow', weight: 2 },
  { keyword: 'semantic_relationship', pattern: 'semantic-relationship', weight: 3 },
  { keyword: 'lifecycle_relationship', pattern: 'lifecycle-relationship', weight: 3 },
  { keyword: 'concurrency_relationship', pattern: 'concurrency-relationship', weight: 3 }
];