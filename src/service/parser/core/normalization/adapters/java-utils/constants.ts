/**
 * Java语言适配器常量定义
 * 包含节点类型映射、查询类型映射等常量
 */

export const JAVA_NODE_TYPE_MAPPING: Record<string, string> = {
  // 类和接口相关
  'class_declaration': 'class',
  'interface_declaration': 'interface',
  'enum_declaration': 'enum',
  'record_declaration': 'class',
  'annotation_type_declaration': 'interface',
  'module_declaration': 'class',
  'package_declaration': 'import',
  
  // 方法和构造函数
  'method_declaration': 'method',
  'constructor_declaration': 'function',
  'lambda_expression': 'lambda',
  
  // 变量和字段
  'field_declaration': 'variable',
  'local_variable_declaration': 'variable',
  'variable_declarator': 'variable',
  'formal_parameter': 'variable',
  
  // 导入
  'import_declaration': 'import',
  
  // 控制流
  'if_statement': 'control-flow',
  'for_statement': 'control-flow',
  'enhanced_for_statement': 'control-flow',
  'while_statement': 'control-flow',
  'do_statement': 'control-flow',
  'switch_statement': 'control-flow',
  'switch_expression': 'control-flow',
  'try_statement': 'control-flow',
  'catch_clause': 'control-flow',
  'finally_clause': 'control-flow',
  'return_statement': 'control-flow',
  'yield_statement': 'control-flow',
  'break_statement': 'control-flow',
  'continue_statement': 'control-flow',
  'throw_statement': 'control-flow',
  'assert_statement': 'control-flow',
  'synchronized_statement': 'control-flow',
  'labeled_statement': 'control-flow',
  
  // 表达式
  'assignment_expression': 'expression',
  'binary_expression': 'expression',
  'unary_expression': 'expression',
  'instanceof_expression': 'expression',
  'method_invocation': 'call',
  'object_creation_expression': 'expression',
  'update_expression': 'expression',
  
  // 类型
  'type_identifier': 'type',
  'generic_type': 'type',
  'array_type': 'type',
  'integral_type': 'type',
  'floating_point_type': 'type',
  'boolean_type': 'type',
  'void_type': 'type',
  
  // 注解
  'annotation': 'annotation',
  'marker_annotation': 'annotation',
  
  // 修饰符
  'modifiers': 'modifier',
  
  // 类型系统
  'superclass': 'type-system',
  'super_interfaces': 'type-system',
  'type_arguments': 'type-system',
  'type_parameters': 'type-system',
  'dimensions': 'type-system',
  'formal_parameters': 'type-system',
  'class_literal': 'type-system',
  'this': 'type-system',
  'super': 'type-system',
  
  // 模式匹配
  'record_pattern': 'pattern',
  'type_pattern': 'pattern',
  'underscore_pattern': 'pattern',
  'guard': 'pattern',
  'switch_rule': 'pattern',
  'switch_label': 'pattern',
  'switch_block_statement_group': 'pattern',
  'record_pattern_component': 'pattern',
  'catch_formal_parameter': 'pattern',
  
  // 块
  'class_body': 'block',
  'interface_body': 'block',
  'enum_body': 'block',
  'annotation_type_body': 'block',
  'switch_block': 'block',
  'record_pattern_body': 'block',
  'block': 'block',
  'expression_statement': 'block',
  
  // 字面量
  'string_literal': 'literal',
  'string_fragment': 'literal',
  'escape_sequence': 'literal',
  'character_literal': 'literal',
  'decimal_integer_literal': 'literal',
  'hex_integer_literal': 'literal',
  'octal_integer_literal': 'literal',
  'binary_integer_literal': 'literal',
  'decimal_floating_point_literal': 'literal',
  'hex_floating_point_literal': 'literal',
  'true': 'literal',
  'false': 'literal',
  'null_literal': 'literal',
  
  // 特殊语句
  'try_with_resources_statement': 'special-statement',
  
  // 注释
  'line_comment': 'comment',
  'block_comment': 'comment',
  
  // 成员表达式
  'field_access': 'member-expression',
  'scoped_identifier': 'member-expression',
  'scoped_type_identifier': 'member-expression',
  
  // 属性标识符
  'identifier': 'identifier',
  'enum_constant': 'identifier'
};

export const JAVA_QUERY_TYPE_MAPPING: Record<string, string> = {
  'classes-interfaces': 'class',
  'methods-variables': 'method',
  'control-flow-patterns': 'control-flow',
  'data-flow': 'data-flow',
  'semantic-relationships': 'semantic',
  'lifecycle-relationships': 'lifecycle',
  'concurrency-relationships': 'concurrency',
  'control-flow-relationships': 'control-flow'
};

export const JAVA_SUPPORTED_QUERY_TYPES = [
  // Entity types
  'classes-interfaces',
  'methods-variables',
  'control-flow-patterns',
  // Relationship types
  'data-flow',
  'semantic-relationships',
  'lifecycle-relationships',
  // Advanced relationship types
  'concurrency-relationships',
  'control-flow-relationships'
];

export const JAVA_NAME_CAPTURES = [
  'name.definition.class',
  'name.definition.interface',
  'name.definition.enum',
  'name.definition.record',
  'name.definition.annotation',
  'name.definition.method',
  'name.definition.constructor',
  'name.definition.field',
  'name.definition.local_variable',
  'name.definition.parameter',
  'name.definition.import',
  'name.definition.static_import',
  'name.definition.package',
  'name.definition.module',
  'name.definition.lambda_parameter',
  'name.definition.enum_constant',
  'name.definition.type_parameter',
  'name.definition.annotation_name',
  'name.definition.marker_annotation',
  'name.definition.method_call',
  'name.definition.constructor_call',
  'name.definition.generic_type',
  'name.definition.array_type',
  'name.definition.type_identifier',
  'name.definition.scoped_identifier',
  'name.definition.superclass',
  'name.definition.super_interface',
  'name.definition.exception_variable',
  'name.definition.for_variable',
  'name.definition.pattern_variable',
  'name.definition.record_pattern_component',
  'name.definition.variable_declarator',
  'name.definition.identifier',
  // 新增的捕获名称
  'name.definition.annotation_body',
  'name.definition.assert_statement',
  'name.definition.assignment_expression',
  'name.definition.assignment_target',
  'name.definition.binary_expression',
  'name.definition.binary_integer_literal',
  'name.definition.block',
  'name.definition.block_comment',
  'name.definition.boolean_type',
  'name.definition.break_statement',
  'name.definition.cast_expression',
  'name.definition.cast_value',
  'name.definition.catch_clause',
  'name.definition.catch_parameter',
  'name.definition.character_literal',
  'name.definition.class_body',
  'name.definition.class_literal',
  'name.definition.continue_statement',
  'name.definition.decimal_floating_point_literal',
  'name.definition.decimal_integer_literal',
  'name.definition.dimensions',
  'name.definition.do_statement',
  'name.definition.enhanced_for_statement',
  'name.definition.enhanced_for_variable',
  'name.definition.enhanced_for_with_iterable',
  'name.definition.enum_body',
  'name.definition.escape_sequence',
  'name.definition.expression_statement',
  'name.definition.false_literal',
  'name.definition.floating_point_type',
  'name.definition.for_iterable',
  'name.definition.for_statement',
  'name.definition.formal_parameters',
  'name.definition.guard',
  'name.definition.hex_floating_point_literal',
  'name.definition.hex_integer_literal',
  'name.definition.if_condition',
  'name.definition.if_statement',
  'name.definition.if_with_condition',
  'name.definition.instanceof_expression',
  'name.definition.instanceof_with_pattern',
  'name.definition.integral_type',
  'name.definition.interface_body',
  'name.definition.labeled_statement',
  'name.definition.lambda',
  'name.definition.lambda_body',
  'name.definition.lambda_with_body',
  'name.definition.lambda_with_params',
  'name.definition.line_comment',
  'name.definition.method_invocation',
  'name.definition.modifiers',
  'name.definition.null_literal',
  'name.definition.object_creation',
  'name.definition.octal_integer_literal',
  'name.definition.parenthesized_expression',
  'name.definition.record_body',
  'name.definition.record_pattern',
  'name.definition.record_pattern_body',
  'name.definition.record_with_body',
  'name.definition.return_statement',
  'name.definition.scoped_type_identifier',
  'name.definition.string_fragment',
  'name.definition.string_literal',
  'name.definition.super_expression',
  'name.definition.super_interfaces',
  'name.definition.switch_block',
  'name.definition.switch_block_statement_group',
  'name.definition.switch_expression',
  'name.definition.switch_label',
  'name.definition.switch_rule',
  'name.definition.synchronized_statement',
  'name.definition.this_expression',
  'name.definition.throw_statement',
  'name.definition.true_literal',
  'name.definition.try_block',
  'name.definition.try_statement',
  'name.definition.try_with_block',
  'name.definition.try_with_resources',
  'name.definition.type_argument',
  'name.definition.type_pattern',
  'name.definition.type_pattern_with_variable',
  'name.definition.unary_expression',
  'name.definition.underscore_pattern',
  'name.definition.update_expression',
  'name.definition.void_type',
  'name.definition.while_statement',
  'name.definition.yield_statement'
];

export const JAVA_BLOCK_NODE_TYPES = [
  'block', 'class_body', 'interface_body', 'enum_body', 'annotation_type_body',
  'method_declaration', 'constructor_declaration', 'for_statement', 'enhanced_for_statement',
  'while_statement', 'do_statement', 'if_statement', 'switch_statement', 'switch_expression',
  'try_statement', 'catch_clause', 'finally_clause', 'synchronized_statement'
];

export const JAVA_MODIFIERS = [
  'public',
  'private',
  'protected',
  'static',
  'final',
  'abstract',
  'synchronized',
  'volatile',
  'transient',
  'native',
  'strictfp',
  'default',
  'override',
  'deprecated',
  'suppress-warnings',
  'functional-interface'
];

export const JAVA_COMPLEXITY_KEYWORDS = [
  { keyword: 'class', pattern: 'class|interface|enum', weight: 2 },
  { keyword: 'method', pattern: 'method|constructor', weight: 1 },
  { keyword: 'lambda', pattern: 'lambda|->', weight: 1 },
  { keyword: 'generic', pattern: '<.*>', weight: 1 },
  { keyword: 'override', pattern: '@Override', weight: 1 },
  { keyword: 'abstract', pattern: 'abstract', weight: 1 },
  { keyword: 'synchronized', pattern: 'synchronized', weight: 1 },
  { keyword: 'native', pattern: 'native', weight: 1 },
  { keyword: 'volatile', pattern: 'volatile', weight: 1 },
  { keyword: 'transient', pattern: 'transient', weight: 1 },
  { keyword: 'final', pattern: 'final', weight: 0.5 },
  { keyword: 'static', pattern: 'static', weight: 0.5 },
  { keyword: 'throws', pattern: 'throws', weight: 1 },
  { keyword: 'exception', pattern: 'try|catch|finally', weight: 1 },
  { keyword: 'stream', pattern: 'stream|Stream', weight: 1 },
  { keyword: 'data_flow', pattern: 'data-flow', weight: 2 },
  { keyword: 'semantic_relationship', pattern: 'semantic-relationship', weight: 3 },
  { keyword: 'lifecycle_relationship', pattern: 'lifecycle-relationship', weight: 3 },
  { keyword: 'concurrency_relationship', pattern: 'concurrency-relationship', weight: 3 }
];