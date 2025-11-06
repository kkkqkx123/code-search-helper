/**
 * JavaScript/TypeScript语言适配器常量定义
 * 包含节点类型映射、查询类型映射等常量
 */

export const JS_NODE_TYPE_MAPPING: Record<string, string> = {
  // 函数相关
 'function_declaration': 'functionDeclaration',
  'function_expression': 'functionDeclaration',
  'arrow_function': 'lambdaExpression',
  'generator_function': 'functionDeclaration',
  'generator_function_declaration': 'functionDeclaration',
  'async_function_declaration': 'functionDeclaration',
  'async_function_expression': 'functionDeclaration',
  'method_definition': 'methodDeclaration',

  // 类相关
  'class_declaration': 'classDeclaration',
  'class_expression': 'classDeclaration',
  'class': 'classDeclaration',

  // 导入导出
  'import_statement': 'importDeclaration',
  'export_statement': 'exportDeclaration',

  // 变量相关
 'variable_declaration': 'variableDeclaration',
  'lexical_declaration': 'variableDeclaration',
  'property_definition': 'variableDeclaration',
  'public_field_definition': 'variableDeclaration',
  'private_field_definition': 'variableDeclaration',
  'pair': 'propertyIdentifier',

  // 控制流
  'if_statement': 'controlFlow',
  'for_statement': 'controlFlow',
  'while_statement': 'controlFlow',
  'do_statement': 'controlFlow',
  'switch_statement': 'controlFlow',
  'switch_case': 'controlFlow',
  'switch_default': 'controlFlow',
  'try_statement': 'controlFlow',
  'catch_clause': 'controlFlow',
  'finally_clause': 'controlFlow',
  'return_statement': 'controlFlow',
  'break_statement': 'controlFlow',
  'continue_statement': 'controlFlow',
  'labeled_statement': 'controlFlow',
  'with_statement': 'controlFlow',
  'debugger_statement': 'controlFlow',

  // 表达式
 'expression_statement': 'expression',
  'binary_expression': 'expression',
  'unary_expression': 'expression',
  'update_expression': 'expression',
  'logical_expression': 'expression',
  'conditional_expression': 'expression',
  'assignment_expression': 'expression',
  'augmented_assignment_expression': 'expression',
  'sequence_expression': 'expression',
  'yield_expression': 'expression',
  'await_expression': 'expression',
  'new_expression': 'callExpression',
  'optional_chain': 'memberExpression',
  'call_expression': 'callExpression',
  'member_expression': 'memberExpression',

  // 字面量
  'string': 'literal',
  'template_string': 'literal',
  'regex': 'literal',
  'number': 'literal',
  'true': 'literal',
  'false': 'literal',
  'null': 'literal',

  // 模式
  'array_pattern': 'pattern',
  'object_pattern': 'pattern',
  'assignment_pattern': 'pattern',
  'spread_element': 'pattern',
  '_': 'pattern',

  // 类型相关 (TypeScript)
  'type_alias_declaration': 'typeAnnotation',
  'namespace_declaration': 'typeAnnotation',
  'interface_declaration': 'interfaceDeclaration',
  'type_parameters': 'genericTypes',
  'type_arguments': 'genericTypes',
  'type_annotation': 'typeAnnotation',
  'parameter': 'parameter',
  'property_signature': 'propertyIdentifier',
  'method_signature': 'methodDeclaration',

  // JSX
  'jsx_element': 'classDeclaration',
  'jsx_self_closing_element': 'classDeclaration',
  'jsx_fragment': 'classDeclaration',
  'jsx_attribute': 'propertyIdentifier',
  'jsx_expression': 'expression',

  // 注释
  'comment': 'comment',

  // 标识符
  'private_property_identifier': 'propertyIdentifier',
  'identifier': 'propertyIdentifier',
  'property_identifier': 'propertyIdentifier',

  // 对象和数组
 'object': 'variableDeclaration',
  'array': 'variableDeclaration',

  // 函数
  'function': 'functionDeclaration'
};

export const JS_QUERY_TYPE_MAPPING: Record<string, string> = {
  'functions': 'function',
  'classes': 'class',
 'variables': 'variable',
  'imports': 'import',
  'exports': 'export',
  'interfaces': 'interface',
  'methods': 'method',
  'properties': 'variable',
  'types': 'type',
  'control-flow': 'control-flow',
  'expressions': 'expression',

  // 关系类型
  'calls': 'call',
  'data-flows': 'data-flow',
  'inheritance': 'inheritance',
  'concurrency-relationships': 'concurrency',
 'control-flow-relationships': 'control-flow',
  'lifecycle-relationships': 'lifecycle',
  'semantic-relationships': 'semantic'
};

export const JS_SUPPORTED_QUERY_TYPES = [
  // 实体类型
  'functions',
  'classes',
  'variables',
  'imports',
  'exports',
  'interfaces',
  'methods',
  'properties',
  'types',
  'control-flow',
  'expressions',
  // 关系类型
  'calls',
  'data-flows',
  'inheritance',
  // 高级关系类型
  'concurrency-relationships',
  'control-flow-relationships',
  'lifecycle-relationships',
  'semantic-relationships'
];

export const JS_NAME_CAPTURES = [
  'name', // Simple name capture from queries like (class name: (_) @name)
  'name.definition.function',
  'name.definition.method',
  'name.definition.class',
  'name.definition.interface',
  'name.definition.type',
  'name.definition.variable',
  'name.definition.property',
  'name.definition.constant',
  'name.definition.let_variable',
  'name.assignment',
  'name.definition.import',
  'name.definition.export',
  // Support for definition.xxx format (used in both TS and JS queries)
  'definition.function',
  'definition.method',
  'definition.class',
  'definition.interface',
  'definition.type',
  'definition.variable',
  'definition.property',
  'definition.constant',
  'definition.constructor',
  'definition.getter',
  'definition.setter',
  'definition.static',
  'definition.private_property',
  'definition.private_method',
  'definition.async_function',
  'definition.async_method',
  'definition.generator_function',
  'definition.generator_method',
  'definition.arrow_function',
  'definition.function_expression',
  'definition.import',
  'definition.export',
  'definition.if',
  'definition.for',
  'definition.for_in',
  'definition.for_of',
  'definition.while',
  'definition.do_while',
  'definition.switch',
  'definition.switch_case',
  'definition.switch_default',
  'definition.try',
  'definition.catch',
  'definition.finally',
  'definition.throw',
  'definition.return',
  'definition.break',
  'definition.continue',
  'definition.labeled',
  'definition.debugger',
  'definition.yield',
  'definition.await',
  'definition.ternary',
  'definition.call',
  'definition.new_expression',
  'definition.member_expression',
  'definition.optional_chain',
  'definition.binary_expression',
  'definition.unary_expression',
  'definition.update_expression',
  'definition.logical_expression',
 'definition.assignment',
  'definition.augmented_assignment',
 'definition.subscript_expression',
  'definition.template_string',
  'definition.regex',
  // JavaScript-specific captures
  'definition.accessor',
  'definition.private_field',
  'definition.test',
  'definition.lexical_declaration',
  'definition.variable_declaration',
  'definition.computed_method',
  'definition.static_property',
  'definition.object_property',
  'definition.computed_property',
  'definition.object_method',
  'definition.object_getter',
  'definition.object_setter',
  'definition.pattern_property',
  'definition.with',
  'definition.expression',
  'definition.conditional',
  'definition.sequence',
  'definition.async_function_expression',
  'definition.async_arrow_function',
  'definition.array_pattern',
 'definition.object_pattern',
  'definition.assignment_pattern',
  'definition.spread_element',
  'definition.jsx_self_closing_element',
  'definition.jsx_fragment',
  'definition.jsx_attribute',
  'definition.jsx_expression',
  'definition.comment',
  'definition.jsdoc',
  'definition.public_api',
  'definition.error_handling',
  'definition.promise_method',
  // Additional captures
  'export',
  'default'
];

export const JS_BLOCK_NODE_TYPES = [
  'block', 'statement_block', 'class_body', 'object', 'array',
  'function_body', 'if_statement', 'for_statement', 'while_statement',
  'do_statement', 'switch_statement', 'try_statement', 'catch_clause',
  'arrow_function', 'function_declaration', 'function_expression'
];

export const JS_MODIFIERS = [
  'async',
  'export',
  'default',
  'static',
  'public',
  'private',
  'protected',
  'readonly',
  'abstract',
  'override',
  'get',
  'set'
];

export const JS_COMPLEXITY_KEYWORDS = [
  { keyword: 'async', pattern: 'async', weight: 1 },
  { keyword: 'await', pattern: 'await', weight: 1 },
  { keyword: 'extends', pattern: 'extends', weight: 1 },
  { keyword: 'JSX', pattern: 'JSX|jsx', weight: 1 },
  { keyword: 'Promise', pattern: 'Promise|promise', weight: 1 },
  { keyword: 'class', pattern: 'class', weight: 2 },
  { keyword: 'function', pattern: 'function', weight: 1 },
  { keyword: 'interface', pattern: 'interface', weight: 1 },
  { keyword: 'typescript', pattern: 'typescript|ts', weight: 1 },
  { keyword: 'decorator', pattern: 'decorator|@', weight: 1 },
  { keyword: 'generic', pattern: '<|>', weight: 1 },
  { keyword: 'implements', pattern: 'implements', weight: 1 },
  { keyword: 'data_flow', pattern: 'data-flow', weight: 2 },
  { keyword: 'semantic_relationship', pattern: 'semantic-relationship', weight: 3 },
  { keyword: 'lifecycle_relationship', pattern: 'lifecycle-relationship', weight: 3 },
  { keyword: 'concurrency_relationship', pattern: 'concurrency-relationship', weight: 3 }
];