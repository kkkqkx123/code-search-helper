export interface LanguageNodeMapping {
  callExpression: string[];
  functionDeclaration: string[];
  classDeclaration: string[];
  interfaceDeclaration: string[];
  importDeclaration: string[];
  exportDeclaration: string[];
  memberExpression: string[];
  propertyIdentifier: string[];
  variableDeclaration: string[];
  methodDeclaration: string[];
  enumDeclaration: string[];
  decorator: string[];
  typeAnnotation: string[];
  genericTypes: string[];
  lambdaExpression: string[];
  structDeclaration: string[];
  // 新增的映射类别，用于更精细的节点关系管理
  controlFlow: string[];
  expression: string[];
  typeSystem: string[];
  pattern: string[];
  block: string[];
  modifier: string[];
  literal: string[];
  specialStatement: string[];
  comment: string[];
  jsx: string[];
  dataStructure: string[];
  comprehension: string[];
}

export const LANGUAGE_NODE_MAPPINGS: Record<string, LanguageNodeMapping> = {
  'javascript': {
    callExpression: ['call_expression', 'new_expression'],
    functionDeclaration: ['function_declaration', 'function_expression', 'generator_function', 'generator_function_declaration', 'async_function_declaration', 'async_function_expression', 'function'],
    classDeclaration: ['class_declaration', 'class_expression', 'class'],
    interfaceDeclaration: ['interface_declaration'],
    importDeclaration: ['import_statement'],
    exportDeclaration: ['export_statement'],
    memberExpression: ['member_expression', 'optional_chain'],
    propertyIdentifier: ['property_identifier', 'private_property_identifier', 'identifier', 'pair', 'jsx_attribute'],
    variableDeclaration: ['variable_declarator', 'lexical_declaration', 'variable_declaration', 'property_definition', 'public_field_definition', 'private_field_definition', 'object', 'array'],
    methodDeclaration: ['function_definition', 'field_declarator', 'method_definition'],
    enumDeclaration: ['enum_declaration'],
    decorator: ['decorator'],
    typeAnnotation: ['type_annotation', 'type_alias_declaration', 'namespace_declaration'],
    genericTypes: ['generic_type', 'type_parameters', 'type_arguments'],
    lambdaExpression: ['arrow_function', 'lambda_expression', 'anonymous_method_expression'],
    structDeclaration: [],  // JavaScript doesn't have struct, so empty
    controlFlow: ['if_statement', 'for_statement', 'while_statement', 'do_statement', 'switch_statement', 'switch_case', 'switch_default', 'try_statement', 'catch_clause', 'finally_clause', 'return_statement', 'break_statement', 'continue_statement', 'labeled_statement', 'with_statement', 'debugger_statement', 'throw_statement'],
    expression: ['expression_statement', 'binary_expression', 'unary_expression', 'update_expression', 'logical_expression', 'conditional_expression', 'assignment_expression', 'augmented_assignment_expression', 'sequence_expression', 'yield_expression', 'await_expression', 'jsx_expression'],
    typeSystem: [],
    pattern: ['array_pattern', 'object_pattern', 'assignment_pattern', 'spread_element', '_'],
    block: [],
    modifier: [],
    literal: ['string', 'template_string', 'regex', 'number', 'true', 'false', 'null'],
    specialStatement: [],
    comment: ['comment'],
    // JSX相关
    jsx: ['jsx_element', 'jsx_self_closing_element', 'jsx_fragment', 'jsx_attribute', 'jsx_expression'],
    dataStructure: [],
    comprehension: []
  },
  'typescript': {
    callExpression: ['call_expression', 'new_expression'],
    functionDeclaration: ['function_definition', 'function_declarator', 'function_expression', 'generator_function_declaration', 'async_function_declaration', 'async_function_expression', 'function_declaration'],
    classDeclaration: ['class_declaration', 'abstract_class_declaration'],
    interfaceDeclaration: ['interface_declaration'],
    importDeclaration: ['import_statement'],
    exportDeclaration: ['export_statement'],
    memberExpression: ['member_expression', 'optional_chain', 'subscript_expression'],
    propertyIdentifier: ['property_identifier', 'named_imports'],
    variableDeclaration: ['variable_declarator', 'lexical_declaration', 'variable_declaration', 'public_field_definition'],
    methodDeclaration: ['function_definition', 'field_declarator', 'method_signature', 'abstract_method_signature', 'method_definition'],
    enumDeclaration: ['enum_declaration'],
    decorator: ['decorator'],
    typeAnnotation: ['type_annotation', 'type_alias_declaration', 'namespace_declaration', 'internal_module'],
    genericTypes: ['generic_type', 'type_parameters', 'type_arguments'],
    lambdaExpression: ['arrow_function', 'lambda_expression', 'anonymous_method_expression'],
    structDeclaration: [],  // TypeScript doesn't have struct, so empty
    controlFlow: ['if_statement', 'for_statement', 'for_in_statement', 'for_of_statement', 'while_statement', 'do_statement', 'switch_statement', 'switch_case', 'switch_default', 'try_statement', 'catch_clause', 'finally_clause', 'return_statement', 'break_statement', 'continue_statement', 'labeled_statement', 'debugger_statement', 'throw_statement'],
    expression: ['yield_expression', 'await_expression', 'ternary_expression', 'type_assertion', 'as_expression', 'satisfies_expression', 'non_null_expression', 'binary_expression', 'unary_expression', 'update_expression', 'logical_expression', 'assignment_expression', 'augmented_assignment_expression', 'parenthesized_expression'],
    typeSystem: [],
    pattern: ['array_pattern', 'object_pattern', 'assignment_pattern', 'spread_element', '_'],
    block: ['class_static_block'],
    modifier: [],
    literal: ['string', 'template_string', 'regex', 'number', 'true', 'false', 'null'],
    specialStatement: [],
    comment: [],
    jsx: ['jsx_element', 'jsx_self_closing_element', 'jsx_fragment', 'jsx_attribute', 'jsx_expression'],
    dataStructure: [],
    comprehension: []
  },
  'python': {
    callExpression: ['call', 'argument_list'],
    functionDeclaration: ['function_definition', 'async_function_definition', 'decorated_definition'],
    classDeclaration: ['class_definition'],
    interfaceDeclaration: [], // Python 没有接口
    importDeclaration: ['import_statement', 'import_from_statement', 'relative_import'],
    exportDeclaration: [], // Python 在AST级别没有显式导出
    memberExpression: ['attribute', 'subscript'],
    propertyIdentifier: ['identifier', 'dotted_name'],
    variableDeclaration: ['assignment', 'annotated_assignment', 'augmented_assignment', 'named_expression'],
    methodDeclaration: ['function_definition', 'method_definition'], // Python methods are functions in class context
    enumDeclaration: ['enum_declaration'],
    decorator: ['decorator'],
    typeAnnotation: ['type', 'type_annotation', 'typed_parameter', 'default_parameter', 'typed_default_parameter', 'union_type'],
    genericTypes: ['generic_type'],
    lambdaExpression: ['lambda'],
    structDeclaration: [],  // Python doesn't have structs
    controlFlow: ['if_statement', 'for_statement', 'while_statement', 'try_statement', 'with_statement', 'break_statement', 'continue_statement', 'return_statement', 'raise_statement', 'assert_statement', 'expression_statement', 'type_alias_statement', 'global_statement', 'nonlocal_statement'],
    expression: ['binary_operator', 'yield', 'named_expression', 'parenthesized_expression', 'expression_list', 'slice'],
    typeSystem: [],
    pattern: ['tuple_pattern', 'list_pattern', 'dict_pattern', 'class_pattern'],
    block: ['block'],
    modifier: [],
    literal: ['string', 'integer', 'float', 'true', 'false', 'none', 'ellipsis'],
    specialStatement: [],
    comment: ['comment'],
    jsx: [],
    // 数据结构相关
    dataStructure: ['list', 'tuple', 'set', 'dictionary'],
    // 推导式相关
    comprehension: ['list_comprehension', 'dictionary_comprehension', 'set_comprehension', 'generator_expression']
  },
  'java': {
    callExpression: ['method_invocation'],
    functionDeclaration: ['method_declaration', 'constructor_declaration'],
    classDeclaration: ['class_declaration', 'record_declaration', 'module_declaration'],
    interfaceDeclaration: ['interface_declaration', 'annotation_type_declaration'],
    importDeclaration: ['import_declaration', 'package_declaration'],
    exportDeclaration: [], // Java 在AST级别没有显式导出
    memberExpression: ['field_access', 'scoped_identifier', 'scoped_type_identifier'],
    propertyIdentifier: ['identifier', 'enum_constant'],
    variableDeclaration: ['variable_declarator', 'field_declaration', 'local_variable_declaration', 'formal_parameter'],
    methodDeclaration: ['method_declaration'],
    enumDeclaration: ['enum_declaration'],
    decorator: ['annotation', 'marker_annotation'], // Java 注解
    typeAnnotation: ['type_annotation', 'type_identifier', 'generic_type', 'array_type', 'integral_type', 'floating_point_type', 'boolean_type', 'void_type'],
    genericTypes: ['generic_type', 'type_parameter', 'type_parameters', 'type_arguments'],
    lambdaExpression: ['lambda_expression'],
    structDeclaration: [],  // Java 不支持结构体（使用类/记录）
    // 控制流相关
    controlFlow: ['if_statement', 'for_statement', 'enhanced_for_statement', 'while_statement', 'do_statement', 'switch_statement', 'switch_expression', 'try_statement', 'catch_clause', 'finally_clause', 'return_statement', 'yield_statement', 'break_statement', 'continue_statement', 'throw_statement', 'assert_statement', 'synchronized_statement', 'labeled_statement'],
    // 表达式相关
    expression: ['assignment_expression', 'binary_expression', 'unary_expression', 'instanceof_expression', 'method_invocation', 'object_creation_expression', 'cast_expression', 'parenthesized_expression', 'update_expression'],
    // 类型系统相关
    typeSystem: ['superclass', 'super_interfaces', 'type_arguments', 'type_parameters', 'dimensions', 'formal_parameters', 'class_literal', 'this', 'super'],
    // 模式匹配相关
    pattern: ['record_pattern', 'type_pattern', 'underscore_pattern', 'guard', 'switch_rule', 'switch_label', 'switch_block_statement_group', 'record_pattern_component', 'catch_formal_parameter'],
    // 语句块相关
    block: ['class_body', 'interface_body', 'enum_body', 'annotation_type_body', 'switch_block', 'record_pattern_body', 'block', 'expression_statement'],
    // 修饰符相关
    modifier: ['modifiers'],
    // 字面量相关
    literal: ['string_literal', 'string_fragment', 'escape_sequence', 'character_literal', 'decimal_integer_literal', 'hex_integer_literal', 'octal_integer_literal', 'binary_integer_literal', 'decimal_floating_point_literal', 'hex_floating_point_literal', 'true', 'false', 'null_literal'],
    // 特殊语句相关
    specialStatement: ['try_with_resources_statement'],
    // 注释相关
    comment: ['line_comment', 'block_comment'],
    jsx: [],
    dataStructure: [],
    comprehension: []
  },
  'rust': {
    callExpression: ['call_expression'],
    functionDeclaration: ['function_item', 'function_signature_item', 'async_function'],
    classDeclaration: ['struct_item', 'unit_struct_item', 'tuple_struct_item', 'enum_item'], // Rust 结构体/枚举作为类的替代
    interfaceDeclaration: ['trait_item'], // Rust 特性作为接口
    importDeclaration: ['use_declaration', 'extern_crate_declaration'],
    exportDeclaration: [], // Rust 使用 pub 关键字，没有显式导出的AST节点
    memberExpression: ['field_expression'],
    propertyIdentifier: ['field_identifier'],
    variableDeclaration: ['let_declaration', 'const_item', 'static_item'],
    methodDeclaration: ['function_item'], // 方法是在 impl 块中的函数
    enumDeclaration: ['enum_item'],
    decorator: ['attribute_item'], // Rust 属性
    typeAnnotation: ['type_identifier'],
    genericTypes: ['type_parameter', 'type_arguments', 'type_parameters'],
    lambdaExpression: ['closure_expression'],
    structDeclaration: ['struct_item', 'unit_struct_item', 'tuple_struct_item'],
    controlFlow: [],
    expression: [],
    typeSystem: [],
    pattern: [],
    block: [],
    modifier: [],
    literal: [],
    specialStatement: [],
    comment: [],
    jsx: [],
    dataStructure: [],
    comprehension: []
  },
  'cpp': {
    callExpression: ['call_expression'],
    functionDeclaration: ['function_definition', 'function_declarator'],
    classDeclaration: ['class_specifier', 'struct_specifier', 'union_specifier'],
    interfaceDeclaration: ['class_specifier'], // C++ 使用抽象类作为接口
    importDeclaration: ['preproc_include'],
    exportDeclaration: [], // C++ 使用头文件进行导出
    memberExpression: ['field_expression', 'field_identifier'],
    propertyIdentifier: ['field_identifier', 'identifier'],
    variableDeclaration: ['declaration', 'init_declarator'],
    methodDeclaration: ['function_definition', 'field_declarator'],
    enumDeclaration: ['enum_specifier'],
    decorator: ['attribute_specifier', 'attribute_declaration'],
    typeAnnotation: ['type_identifier', 'primitive_type'],
    genericTypes: ['template_type', 'template_parameter_list', 'type_parameter'],
    lambdaExpression: ['lambda_expression'],
    structDeclaration: ['struct_specifier'],
    controlFlow: [],
    expression: [],
    typeSystem: [],
    pattern: [],
    block: [],
    modifier: [],
    literal: [],
    specialStatement: [],
    comment: [],
    jsx: [],
    dataStructure: [],
    comprehension: []
  },
  'c': {
    callExpression: ['call_expression'],
    functionDeclaration: ['function_definition', 'function_declarator'],
    classDeclaration: ['struct_specifier'], // C 使用结构体作为类的替代
    interfaceDeclaration: [], // C 没有接口
    importDeclaration: ['preproc_include'],
    exportDeclaration: [], // C 使用头文件进行导出
    memberExpression: ['field_expression'],
    propertyIdentifier: ['field_identifier'],
    variableDeclaration: ['declaration', 'init_declarator'],
    methodDeclaration: [], // C 没有方法
    enumDeclaration: ['enum_specifier'],
    decorator: ['attribute_specifier', 'attribute_declaration'],
    typeAnnotation: ['type_identifier', 'primitive_type'],
    genericTypes: [], // C 没有泛型
    lambdaExpression: [], // C 没有lambda表达式
    structDeclaration: ['struct_specifier'],
    controlFlow: [],
    expression: [],
    typeSystem: [],
    pattern: [],
    block: [],
    modifier: [],
    literal: [],
    specialStatement: [],
    comment: [],
    jsx: [],
    dataStructure: [],
    comprehension: []
  },
  'csharp': {
    callExpression: ['invocation_expression'],
    functionDeclaration: ['method_declaration', 'constructor_declaration', 'destructor_declaration'],
    classDeclaration: ['class_declaration', 'record_class_declaration', 'record_declaration'],
    interfaceDeclaration: ['interface_declaration'],
    importDeclaration: ['using_directive'],
    exportDeclaration: [], // C# 使用 public 关键字进行导出
    memberExpression: ['member_access_expression'],
    propertyIdentifier: ['identifier', 'property_identifier'],
    variableDeclaration: ['variable_declaration', 'variable_declarator', 'local_declaration_statement'],
    methodDeclaration: ['method_declaration'],
    enumDeclaration: ['enum_declaration'],
    decorator: ['attribute_list'], // C# attributes
    typeAnnotation: ['type'],
    genericTypes: ['type_parameter', 'generic_name', 'type_argument'],
    lambdaExpression: ['lambda_expression', 'anonymous_method_expression'],
    structDeclaration: ['struct_declaration', 'record_struct_declaration'],
    controlFlow: [],
    expression: [],
    typeSystem: [],
    pattern: [],
    block: [],
    modifier: [],
    literal: [],
    specialStatement: [],
    comment: [],
    jsx: [],
    dataStructure: [],
    comprehension: []
  },
  'kotlin': {
    callExpression: ['call_expression'],
    functionDeclaration: ['function_declaration', 'primary_constructor'],
    classDeclaration: ['class_declaration', 'object_declaration', 'companion_object'],
    interfaceDeclaration: ['class_declaration'], // Kotlin 接口是具有特定修饰符的类
    importDeclaration: ['import_header'],
    exportDeclaration: [], // Kotlin 没有像 JS/TS 那样的显式导出
    memberExpression: ['property_access_expression', 'safe_access_expression'],
    propertyIdentifier: ['simple_identifier', 'identifier'],
    variableDeclaration: ['property_declaration', 'variable_declaration'],
    methodDeclaration: ['function_declaration'],
    enumDeclaration: ['class_declaration'], // Kotlin enums are special classes
    decorator: ['annotation'], // Kotlin 注解
    typeAnnotation: ['user_type', 'type_identifier'],
    genericTypes: ['type_parameter', 'type_argument', 'type_parameters'],
    lambdaExpression: ['lambda_literal'],
    structDeclaration: [],  // Kotlin doesn't have structs (use data classes)
    controlFlow: [],
    expression: [],
    typeSystem: [],
    pattern: [],
    block: [],
    modifier: [],
    literal: [],
    specialStatement: [],
    comment: [],
    jsx: [],
    dataStructure: [],
    comprehension: []
  },
  'css': {
    callExpression: ['call_expression', 'function_name'],
    functionDeclaration: ['keyframes_statement', 'font_face_statement', 'media_statement', 'at_rule', 'supports_statement', 'namespace_statement'],
    classDeclaration: ['rule_set', 'class_selector', 'id_selector', 'tag_name', 'pseudo_class_selector', 'pseudo_element_selector', 'attribute_selector', 'universal_selector', 'child_selector', 'sibling_selector', 'adjacent_sibling_selector', 'descendant_selector', 'namespace_selector', 'nesting_selector'],
    interfaceDeclaration: [], // CSS doesn't have interfaces
    importDeclaration: ['import_statement'],
    exportDeclaration: [], // CSS doesn't have exports
    memberExpression: ['property_name'],
    propertyIdentifier: ['property_name'],
    variableDeclaration: ['declaration', 'custom_property', 'integer_value', 'float_value', 'color_value', 'string_value', 'plain_value', 'integer_value_with_unit', 'float_value_with_unit', 'comment'],
    methodDeclaration: [], // CSS doesn't have methods
    enumDeclaration: [], // CSS doesn't have enums
    decorator: [], // CSS doesn't have decorators
    typeAnnotation: ['type_identifier'],
    genericTypes: [], // CSS doesn't have generics
    lambdaExpression: [], // CSS doesn't have lambdas
    structDeclaration: [], // CSS doesn't have structs
    controlFlow: [],
    expression: [],
    typeSystem: [],
    pattern: [],
    block: [],
    modifier: [],
    literal: [],
    specialStatement: [],
    comment: [],
    jsx: [],
    dataStructure: [],
    comprehension: []
  },
  'html': {
    callExpression: [], // HTML doesn't have function calls
    functionDeclaration: [], // HTML doesn't have function declarations
    classDeclaration: ['element', 'start_tag', 'end_tag', 'self_closing_tag', 'document', 'script_element', 'style_element', 'doctype'],
    interfaceDeclaration: [], // HTML doesn't have interfaces
    importDeclaration: [], // HTML doesn't have imports
    exportDeclaration: [], // HTML doesn't have exports
    memberExpression: ['attribute'],
    propertyIdentifier: ['attribute_name', 'tag_name'],
    variableDeclaration: ['attribute_value', 'quoted_attribute_value', 'text', 'raw_text', 'comment', 'entity'],
    methodDeclaration: [], // HTML doesn't have methods
    enumDeclaration: [], // HTML doesn't have enums
    decorator: [], // HTML doesn't have decorators
    typeAnnotation: [], // HTML doesn't have type annotations
    genericTypes: [], // HTML doesn't have generics
    lambdaExpression: [], // HTML doesn't have lambdas
    structDeclaration: [], // HTML doesn't have structs
    controlFlow: [],
    expression: [],
    typeSystem: [],
    pattern: [],
    block: [],
    modifier: [],
    literal: [],
    specialStatement: [],
    comment: [],
    jsx: [],
    dataStructure: [],
    comprehension: []
  },
  'vue': {
    callExpression: [], // Vue doesn't have direct function calls in template
    functionDeclaration: ['function', 'method_definition', 'lifecycle_hook'],
    classDeclaration: ['class_declaration', 'component_tag', 'template_element', 'script_element', 'style_element', 'element', 'slot_element'],
    interfaceDeclaration: [], // Vue doesn't have interfaces
    importDeclaration: ['import_statement'],
    exportDeclaration: ['export_statement'],
    memberExpression: ['attribute'],
    propertyIdentifier: ['property_identifier', 'tag_name', 'attribute_name'],
    variableDeclaration: ['variable_declaration', 'interpolation', 'comment', 'attribute_value'],
    methodDeclaration: ['method_definition', 'lifecycle_hook'],
    enumDeclaration: [], // Vue doesn't have enums
    decorator: [], // Vue doesn't have decorators
    typeAnnotation: [], // Vue doesn't have type annotations
    genericTypes: [], // Vue doesn't have generics
    lambdaExpression: [], // Vue doesn't have lambdas
    structDeclaration: [], // Vue doesn't have structs
    controlFlow: [],
    expression: [],
    typeSystem: [],
    pattern: [],
    block: [],
    modifier: [],
    literal: [],
    specialStatement: [],
    comment: [],
    jsx: [],
    dataStructure: [],
    comprehension: []
  },
  'go': {
    callExpression: ['call_expression', 'selector_expression'],
    functionDeclaration: ['function_declaration', 'method_declaration', 'func_literal'],
    classDeclaration: ['type_declaration', 'struct_type', 'interface_type'],
    interfaceDeclaration: ['interface_type'],
    importDeclaration: ['import_declaration', 'import_spec', 'package_clause', 'dot'],
    exportDeclaration: [], // Go doesn't have explicit exports
    memberExpression: ['field_declaration', 'field_identifier'],
    propertyIdentifier: ['identifier', 'type_identifier', 'field_identifier', 'package_identifier'],
    variableDeclaration: ['var_declaration', 'var_spec', 'const_declaration', 'const_spec', 'assignment_statement', 'short_var_declaration', 'parameter_declaration', 'variadic_parameter_declaration', 'blank_identifier', 'iota', 'type_assertion_expression', 'type_conversion_expression', 'composite_literal', 'slice_expression', 'index_expression', 'send_statement', 'if_statement', 'for_statement', 'range_clause', 'select_statement', 'expression_case', 'default_case', 'type_case', 'type_switch_statement', 'return_statement', 'defer_statement', 'go_statement', 'binary_expression', 'unary_expression', 'inc_statement', 'dec_statement', 'int_literal', 'float_literal', 'interpreted_string_literal', 'raw_string_literal', 'rune_literal', 'comment', 'labeled_statement', 'break_statement', 'continue_statement', 'fallthrough_statement', 'block', 'expression_statement', 'parenthesized_expression', 'variadic_argument', 'argument_list', 'expression_list', 'literal_value', 'keyed_element', 'literal_element', 'escape_sequence'],
    methodDeclaration: ['method_declaration'],
    enumDeclaration: [], // Go doesn't have enums
    decorator: [], // Go doesn't have decorators
    typeAnnotation: ['type_alias', 'qualified_type', 'array_type', 'slice_type', 'map_type', 'pointer_type', 'channel_type', 'function_type', 'type_parameter_list'],
    genericTypes: ['type_parameter_list'],
    lambdaExpression: ['func_literal'],
    structDeclaration: ['struct_type'],
    controlFlow: [],
    expression: [],
    typeSystem: [],
    pattern: [],
    block: [],
    modifier: [],
    literal: [],
    specialStatement: [],
    comment: [],
    jsx: [],
    dataStructure: [],
    comprehension: []
  },
};