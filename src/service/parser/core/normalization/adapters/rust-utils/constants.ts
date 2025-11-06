/**
 * Rust语言适配器常量定义
 * 包含节点类型映射、查询类型映射等常量
 */

export const RUST_NODE_TYPE_MAPPING: Record<string, string> = {
  // 函数相关
  'function_item': 'function',
  'function_signature_item': 'function',
  'async_function': 'function',
  'closure_expression': 'function',
  'async_block': 'function',
  
  // 结构体/类相关
  'struct_item': 'class',
  'unit_struct_item': 'class',
  'tuple_struct_item': 'class',
  'enum_item': 'class',
  'union_item': 'class',
  'trait_item': 'interface',
  
  // 实现块
  'impl_item': 'method',
  
  // 模块和导入
  'mod_item': 'import',
  'use_declaration': 'import',
  'extern_crate_declaration': 'import',
  'foreign_item_fn': 'import',
  'foreign_static_item': 'import',
  
  // 变量和常量
  'const_item': 'variable',
  'static_item': 'variable',
  'let_declaration': 'variable',
  'assignment_expression': 'variable',
  'parameter': 'variable',
  
  // 类型定义
  'type_item': 'type',
  'type_parameter': 'type',
  'associated_type': 'type',
  'associated_constant': 'type',
  
  // 宏
  'macro_definition': 'function',
  'macro_invocation': 'function',
  'macro_rule': 'function',
  
  // 控制流
  'match_expression': 'control-flow',
  'if_expression': 'control-flow',
  'if_let_expression': 'control-flow',
  'loop_expression': 'control-flow',
  'while_expression': 'control-flow',
  'while_let_expression': 'control-flow',
  'for_expression': 'control-flow',
  'unsafe_block': 'control-flow',
  'const_block': 'control-flow',
  
  // 表达式
  'call_expression': 'expression',
  'method_call_expression': 'expression',
  'field_expression': 'expression',
  'binary_expression': 'expression',
  'unary_expression': 'expression',
  'array_expression': 'expression',
  'tuple_expression': 'expression',
  'cast_expression': 'expression',
  'index_expression': 'expression',
  'range_expression': 'expression',
  'await_expression': 'expression',
  'return_expression': 'expression',
  'continue_expression': 'expression',
  'break_expression': 'expression',
  'try_expression': 'expression',
  'reference_expression': 'expression',
  'borrow_expression': 'expression',
  'dereference_expression': 'expression',
  'literal': 'expression',
  'integer_literal': 'expression',
  'float_literal': 'expression',
  'string_literal': 'expression',
  'char_literal': 'expression',
  'boolean_literal': 'expression',
  'unit_expression': 'expression',
  
  // 属性
  'attribute_item': 'type',
  'inner_attribute_item': 'type',
  'outer_attribute_item': 'type',
  
  // 生命周期
  'lifetime': 'type',
  'lifetime_parameter': 'type',
  
  // 泛型
  'type_arguments': 'type',
  'type_parameters': 'type',
  'trait_bound': 'type',
  'where_clause': 'type',
  
  // 模式匹配
  'match_arm': 'expression',
  'match_pattern': 'expression',
  'pattern': 'expression',
  
  // 错误处理
  'question_mark_expression': 'expression',
  
  // 通用标识符映射
  'identifier': 'identifier',
  'type_identifier': 'type_identifier',
  'field_identifier': 'field_identifier',
  'scoped_identifier': 'scoped_identifier',
  'scoped_type_identifier': 'scoped_type_identifier',
  'self_parameter': 'self_parameter',
  'shorthand_field_identifier': 'shorthand_field_identifier',
  'escape_sequence': 'escape_sequence',
};

export const RUST_QUERY_TYPE_MAPPING: Record<string, string> = {
  'functions': 'function',
  'classes': 'class',         // 对应struct、enum、union
  'interfaces': 'interface',  // 对应trait
  'methods': 'method',
  'imports': 'import',        // 对应use、extern crate等
  'variables': 'variable',    // 对应const、static、let等
  'control-flow': 'control-flow',
  'types': 'type',            // 对应type alias、类型参数
  'expressions': 'expression',
  'macros': 'function',       // 宏类似函数
  'modules': 'import',        // 模块导入
  'patterns': 'expression',   // 模式匹配
  
  // 关系类型
  'calls': 'call',
  'data-flows': 'data-flow',
  'inheritance': 'inheritance',  // 对应trait实现关系
  
  // 高级关系类型
  'concurrency-relationships': 'concurrency',
  'control-flow-relationships': 'control-flow',
  'lifecycle-relationships': 'lifecycle',
  'semantic-relationships': 'semantic'
};

export const RUST_SUPPORTED_QUERY_TYPES = [
  // Entity types
  'functions',
  'classes',
  'interfaces',
  'methods',
  'imports',
  'variables',
  'control-flow',
  'types',
  'expressions',
  'macros',
  'modules',
  'patterns',
  
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

export const RUST_NAME_CAPTURES = [
  'name.definition.function',
  'name.definition.struct',
  'name.definition.unit_struct',
  'name.definition.tuple_struct',
  'name.definition.enum',
  'name.definition.trait',
  'name.definition.impl',
  'name.definition.impl_trait',
  'name.definition.impl_for',
  'name.definition.method',
  'name.definition.method_container',
  'name.definition.union',
  'name.definition.async_block',
  'name.definition.async_function',
  'name.definition.closure',
  'name.definition.constant',
  'name.definition.static',
  'name.definition.variable',
  'name.definition.module',
  'name.definition.type_alias',
  'name.definition.macro',
  'name.definition.extern_crate',
  'name',
  'identifier',
  'type_identifier',
  'field_identifier'
];

export const RUST_BLOCK_NODE_TYPES = [
  'block',
  'function_body',
  'match_arm',
  'match_block',
  'loop_expression',
  'while_expression',
  'for_expression',
  'if_expression',
  'unsafe_block',
  'const_block',
  'async_block',
  'impl_item',
  'struct_item',
  'enum_item',
  'trait_item',
  'union_item'
];

export const RUST_MODIFIERS = [
  'unsafe',
  'async',
  'const',
  'static',
  'extern',
  'pub',
  'pub(crate)',
  'pub(super)',
  'pub(self)',
  'pub(in',
  'mut',
  'ref',
  'move',
  'impl',
  'trait',
  'where',
  'for',
  'async',
  'await',
  'crate',
  'super',
  'self',
  'Self',
  'dyn',
  'box',
  'lifetime',
  'macro',
  'derive',
  'allow',
  'deny',
  'warn',
  'forbid',
  'must_use',
  'deprecated',
  'cfg',
  'test',
  'bench',
  'doc',
  'inline',
  'no_mangle',
  'cold',
  'link_section',
  'repr',
  'packed',
  'non_exhaustive',
  'macro_export',
  'macro_use',
  'proc_macro',
  'proc_macro_derive',
  'proc_macro_attribute'
];

export const RUST_COMPLEXITY_KEYWORDS = [
  { keyword: 'unsafe', pattern: 'unsafe', weight: 2 },
  { keyword: 'async', pattern: 'async', weight: 1 },
  { keyword: 'await', pattern: 'await', weight: 1 },
  { keyword: 'macro', pattern: 'macro', weight: 2 },
  { keyword: 'trait', pattern: 'trait', weight: 1 },
  { keyword: 'impl', pattern: 'impl', weight: 1 },
  { keyword: 'generic', pattern: '<.*>', weight: 1 },
  { keyword: 'lifetime', pattern: '\'[a-zA-Z]', weight: 1 },
  { keyword: 'match', pattern: 'match', weight: 1 },
  { keyword: 'closure', pattern: '\\|.*\\|', weight: 1 },
  { keyword: 'concurrency', pattern: 'thread|mutex|channel|Arc|Mutex|RwLock', weight: 2 },
  { keyword: 'error_handling', pattern: 'Result|Option|\\?|unwrap|expect', weight: 1 },
  { keyword: 'iterator', pattern: 'iter|collect|map|filter|fold', weight: 1 },
  { keyword: 'smart_pointer', pattern: 'Box|Rc|Arc|RefCell', weight: 1 },
  { keyword: 'module_path', pattern: 'crate::|super::|self::', weight: 1 },
  { keyword: 'attribute', pattern: '#\\[.*\\]', weight: 1 },
  { keyword: 'function', pattern: 'fn', weight: 1 },
  { keyword: 'struct', pattern: 'struct', weight: 2 },
  { keyword: 'enum', pattern: 'enum', weight: 2 },
  { keyword: 'union', pattern: 'union', weight: 2 },
  { keyword: 'data_flow', pattern: 'data-flow', weight: 2 },
  { keyword: 'semantic_relationship', pattern: 'semantic-relationship', weight: 3 },
  { keyword: 'lifecycle_relationship', pattern: 'lifecycle-relationship', weight: 3 },
  { keyword: 'concurrency_relationship', pattern: 'concurrency-relationship', weight: 3 }
];