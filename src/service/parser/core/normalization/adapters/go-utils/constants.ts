/**
 * Go语言适配器常量定义
 * 包含节点类型映射、查询类型映射等常量
 */

export const GO_NODE_TYPE_MAPPING: Record<string, string> = {
  // 函数相关
  'function_declaration': 'function',
  'method_declaration': 'method',
  'func_literal': 'lambda', // 匿名函数
  'function_type': 'type',

  // 类型相关
  'type_declaration': 'class', // Go结构体/接口作为类
  'struct_type': 'struct',
  'interface_type': 'interface',
  'type_alias': 'type',
  'type_identifier': 'type',
  'field_declaration': 'field',
  'field_identifier': 'field',
  'qualified_type': 'type', // 限定类型 (package.Type)

  // 导入相关
  'import_declaration': 'import',
  'import_spec': 'import',
  'package_clause': 'package',
  'dot': 'import', // 点导入标识符

  // 变量相关
  'var_declaration': 'variable',
  'var_spec': 'variable',
  'const_declaration': 'constant',
  'const_spec': 'constant',
  'assignment_statement': 'assignment',
  'short_var_declaration': 'assignment',
  'parameter_declaration': 'parameter',
  'variadic_parameter_declaration': 'parameter',
  'identifier': 'identifier',

  // 控制流
  'if_statement': 'control_flow',
  'for_statement': 'control_flow',
  'range_clause': 'control_flow',
  'select_statement': 'control_flow',
  'expression_case': 'control_flow',
  'default_case': 'control_flow',
  'type_case': 'control_flow',
  'type_switch_statement': 'control_flow',
  'return_statement': 'control_flow',
  'defer_statement': 'control_flow',
  'go_statement': 'control_flow',
  'break_statement': 'control_flow',
  'continue_statement': 'control_flow',
  'fallthrough_statement': 'control_flow',
  'block': 'block',
  'labeled_statement': 'control_flow', // 标签语句

  // 表达式
  'call_expression': 'call',
  'selector_expression': 'selector',
  'composite_literal': 'literal',
  'slice_expression': 'slice',
  'index_expression': 'index',
  'send_statement': 'channel',
  'unary_expression': 'unary',
  'binary_expression': 'binary',
  'type_assertion_expression': 'type_assertion',
  'type_conversion_expression': 'type_conversion',
  'expression_statement': 'expression',
  'parenthesized_expression': 'parenthesized',
  'argument_list': 'arguments',
  'expression_list': 'expressions',
  'literal_value': 'literal',
  'keyed_element': 'element',
  'literal_element': 'element',
  'inc_statement': 'increment', // 增量语句
  'dec_statement': 'decrement', // 减量语句
  'variadic_argument': 'variadic', // 可变参数
  'escape_sequence': 'escape', // 转义序列

  // 字面量
  'int_literal': 'literal',
  'float_literal': 'literal',
  'interpreted_string_literal': 'string',
  'raw_string_literal': 'string',
  'rune_literal': 'rune',

  // 类型
  'array_type': 'array',
  'slice_type': 'slice',
  'map_type': 'map',
  'pointer_type': 'pointer',
  'channel_type': 'channel',
  'type_parameter_list': 'generics',

  // 其他
  'comment': 'comment',
  'blank_identifier': 'blank',
  'iota': 'iota',
  'package_identifier': 'package'
};

export const GO_QUERY_TYPE_MAPPING: Record<string, string> = {
  'functions-types': 'function',
  'variables-imports': 'variable',
  'expressions-control-flow': 'expression',
  
  // 关系类型
  'annotations': 'annotation',
  'calls': 'call',
  'creations': 'creation',
  'data-flows': 'data-flow',
  'dependencies': 'dependency',
  'inheritance': 'inheritance',
  'references': 'reference',
  'concurrency-relationships': 'concurrency',
  'control-flow-relationships': 'control-flow',
  'lifecycle-relationships': 'lifecycle',
  'semantic-relationships': 'semantic'
};

export const GO_SUPPORTED_QUERY_TYPES = [
  // Entity types
  'functions-types',
  'variables-imports',
  'expressions-control-flow',
  // Relationship types
  'annotations',
  'calls',
  'creations',
  'data-flows',
  'dependencies',
  'inheritance',
  'references',
  // Advanced relationship types
  'concurrency-relationships',
  'control-flow-relationships',
  'lifecycle-relationships',
  'semantic-relationships'
];

export const GO_NAME_CAPTURES = [
  'name.definition.function',
  'name.definition.method',
  'name.definition.type',
  'name.definition.interface',
  'name.definition.struct',
  'name.definition.var',
  'name.definition.const',
  'name.definition.import',
  'name.definition.package',
  'name.definition.call',
  'name.definition.field',
  'name.definition.field_identifier',
  'name.definition.identifier',
  'name.definition.type_identifier',
  'name.definition.package_identifier',
  'name.definition.test',
  'name.definition.benchmark',
  'name.definition.example',
  'name.definition.selector',
  'name.definition.composite_literal',
  'name.definition.channel',
  'name.definition.if',
  'name.definition.for',
  'name.definition.return',
  'name.definition.defer',
  'name.definition.goroutine',
  'name.definition.block',
  'name.definition.expression',
  'name.definition.string_literal',
  'name.definition.int_literal',
  'name.definition.float_literal',
  'name.definition.rune_literal',
  'name.definition.comment',
  'name.definition.type_alias',
  'name.definition.func_literal',
  'name.definition.function_type',
  'name.definition.type_parameter_list',
  'name.definition.generic_type',
  'name.definition.field_declaration',
  'name.definition.parameter',
  'name.definition.variadic_parameter',
  'name.definition.import_spec',
  'name.definition.var_spec',
  'name.definition.const_spec',
  'name.definition.assignment',
  'name.definition.short_var',
  'name.definition.embedded_field',
  'name.definition.qualified_embedded_field',
  'name.definition.variadic',
  'name.definition.blank_identifier',
  'name.definition.iota',
  'name.definition.dot_import',
  'name.definition.import_path',
  'name.definition.type_assertion',
  'name.definition.type_conversion',
  'name.definition.slice',
  'name.definition.index',
  'name.definition.send',
  'name.definition.receive',
  'name.definition.range',
  'name.definition.select',
  'name.definition.case',
  'name.definition.default_case',
  'name.definition.type_switch',
  'name.definition.type_case',
  'name.definition.binary',
  'name.definition.unary',
  'name.definition.inc',
  'name.definition.dec',
  'name.definition.raw_string_literal',
  'name.definition.qualified_type',
  'name.definition.array_type',
  'name.definition.slice_type',
  'name.definition.map_type',
  'name.definition.pointer_type',
  'name.definition.label',
  'name.definition.break',
  'name.definition.continue',
  'name.definition.fallthrough',
  'name.definition.parenthesized',
  'name.definition.builtin',
  'name.definition.generic_call',
  'name.definition.variadic_argument',
  'name.definition.argument_list',
  'name.definition.expression_list',
  'name.definition.literal_value',
  'name.definition.keyed_element',
  'name.definition.literal_element',
  'name.definition.escape_sequence'
];

export const GO_BLOCK_NODE_TYPES = [
  'block', 'function_declaration', 'method_declaration', 'func_literal',
  'if_statement', 'for_statement', 'switch_statement', 'select_statement',
  'type_switch_statement'
];

export const GO_MODIFIERS = [
  'func',
  'type',
  'interface',
  'struct',
  'var',
  'const',
  'import',
  'package',
  'goroutine',
  'channel',
  'select',
  'defer',
  'range',
  'error-handling',
  'panic',
  'recover',
  'exported',
  'blank-identifier',
  'iota',
  'go',
  'make',
  'new',
  'append',
  'copy',
  'delete',
  'close',
  'len',
  'cap'
];

export const GO_COMPLEXITY_KEYWORDS = [
  { keyword: 'goroutine', pattern: 'go\\s+', weight: 2 },
  { keyword: 'channel', pattern: 'chan|<-|make\\s*\\(.*chan', weight: 2 },
  { keyword: 'select', pattern: 'select\\s*{', weight: 2 },
  { keyword: 'interface', pattern: 'interface\\s*{', weight: 1 },
  { keyword: 'struct', pattern: 'struct\\s*{', weight: 1 },
  { keyword: 'defer', pattern: 'defer\\s+', weight: 1 },
  { keyword: 'range', pattern: 'range\\s+', weight: 1 },
  { keyword: 'panic', pattern: 'panic\\s*\\(', weight: 1 },
  { keyword: 'recover', pattern: 'recover\\s*\\(', weight: 1 },
  { keyword: 'context', pattern: 'context\\.', weight: 1 },
  { keyword: 'mutex', pattern: 'mutex|sync\\.', weight: 1 },
  { keyword: 'error', pattern: 'error\\s*\\(|if.*error', weight: 0.5 },
  { keyword: 'function', pattern: 'func\\s+', weight: 1 },
  { keyword: 'method', pattern: 'func\\s*\\([^)]+\\)\\s+\\w+', weight: 1 },
  { keyword: 'type', pattern: 'type\\s+\\w+', weight: 1 },
  { keyword: 'data_flow', pattern: 'data-flow', weight: 2 },
  { keyword: 'semantic_relationship', pattern: 'semantic-relationship', weight: 3 },
  { keyword: 'lifecycle_relationship', pattern: 'lifecycle-relationship', weight: 3 },
  { keyword: 'concurrency_relationship', pattern: 'concurrency-relationship', weight: 3 }
];

// Go内置函数列表
export const GO_BUILTIN_FUNCTIONS = [
  'append', 'cap', 'close', 'complex', 'copy', 'delete', 'imag', 'len', 
  'make', 'new', 'panic', 'print', 'println', 'real', 'recover'
];

// Go并发相关关键词
export const GO_CONCURRENCY_KEYWORDS = [
  'go', 'chan', 'select', 'sync', 'mutex', 'waitgroup', 'once', 'cond', 'pool'
];

// Go错误处理相关关键词
export const GO_ERROR_KEYWORDS = [
  'error', 'panic', 'recover', 'fmt.Errorf', 'errors.New'
];