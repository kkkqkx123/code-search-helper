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
}

export const LANGUAGE_NODE_MAPPINGS: Record<string, LanguageNodeMapping> = {
  'javascript': {
    callExpression: ['call_expression'],
    functionDeclaration: ['function_definition', 'function_declarator'],
    classDeclaration: ['class_declaration'],
    interfaceDeclaration: ['interface_declaration'],
    importDeclaration: ['import_statement'],
    exportDeclaration: ['export_statement'],
    memberExpression: ['member_expression'],
    propertyIdentifier: ['property_identifier'],
    variableDeclaration: ['variable_declarator', 'lexical_declaration'],
    methodDeclaration: ['function_definition', 'field_declarator'],
    enumDeclaration: ['enum_declaration'],
    decorator: ['decorator'],
    typeAnnotation: ['type_annotation'],
    genericTypes: ['generic_type'],
    lambdaExpression: ['arrow_function', 'lambda_expression', 'anonymous_method_expression'],
    structDeclaration: []  // JavaScript doesn't have struct, so empty
  },
  'typescript': {
    callExpression: ['call_expression'],
    functionDeclaration: ['function_definition', 'function_declarator'],
    classDeclaration: ['class_declaration', 'abstract_class_declaration'],
    interfaceDeclaration: ['interface_declaration'],
    importDeclaration: ['import_statement'],
    exportDeclaration: ['export_statement'],
    memberExpression: ['member_expression'],
    propertyIdentifier: ['property_identifier'],
    variableDeclaration: ['variable_declarator', 'lexical_declaration'],
    methodDeclaration: ['function_definition', 'field_declarator'],
    enumDeclaration: ['enum_declaration'],
    decorator: ['decorator'],
    typeAnnotation: ['type_annotation'],
    genericTypes: ['generic_type'],
    lambdaExpression: ['arrow_function', 'lambda_expression', 'anonymous_method_expression'],
    structDeclaration: []  // TypeScript doesn't have struct, so empty
  },
  'python': {
    callExpression: ['call'],
    functionDeclaration: ['function_definition', 'async_function_definition', 'decorated_definition'],
    classDeclaration: ['class_definition'],
    interfaceDeclaration: [], // Python 没有接口
    importDeclaration: ['import_statement', 'import_from_statement', 'relative_import'],
    exportDeclaration: [], // Python 在AST级别没有显式导出
    memberExpression: ['attribute'],
    propertyIdentifier: ['identifier'],
    variableDeclaration: ['assignment', 'annotated_assignment', 'augmented_assignment'],
    methodDeclaration: ['function_definition', 'method_definition'], // Python methods are functions in class context
    enumDeclaration: ['enum_declaration'],
    decorator: ['decorator'],
    typeAnnotation: ['type', 'type_annotation', 'typed_parameter'],
    genericTypes: ['generic_type'],
    lambdaExpression: ['lambda'],
    structDeclaration: []  // Python doesn't have structs
  },
  'java': {
    callExpression: ['method_invocation'],
    functionDeclaration: ['method_declaration', 'constructor_declaration'],
    classDeclaration: ['class_declaration'],
    interfaceDeclaration: ['interface_declaration'],
    importDeclaration: ['import_declaration'],
    exportDeclaration: [], // Java 在AST级别没有显式导出
    memberExpression: ['field_access'],
    propertyIdentifier: ['identifier'],
    variableDeclaration: ['variable_declarator', 'field_declaration', 'local_variable_declaration'],
    methodDeclaration: ['method_declaration'],
    enumDeclaration: ['enum_declaration'],
    decorator: ['annotation'], // Java 注解
    typeAnnotation: ['type_annotation', 'type_identifier'],
    genericTypes: ['generic_type', 'type_parameter'],
    lambdaExpression: ['lambda_expression'],
    structDeclaration: []  // Java 不支持结构体（使用类/记录）
  },
  'go': {
    callExpression: ['call_expression'],
    functionDeclaration: ['function_declaration', 'method_declaration'],
    classDeclaration: ['type_declaration', 'struct_type'], // Go 结构体作为类的替代
    interfaceDeclaration: ['interface_type'], // Go 接口
    importDeclaration: ['import_declaration', 'import_spec', 'package_clause'],
    exportDeclaration: [], // Go 使用大写名称导出
    memberExpression: ['selector_expression'], // 字段/方法访问
    propertyIdentifier: ['field_identifier', 'identifier'],
    variableDeclaration: ['var_declaration', 'var_spec', 'const_declaration', 'const_spec', 'short_var_declaration'],
    methodDeclaration: ['method_declaration'], // Go 方法
    enumDeclaration: [], // Go 没有枚举，使用常量组
    decorator: [], // Go 没有装饰器
    typeAnnotation: ['type_identifier'],
    genericTypes: ['type_parameter_list', 'type_identifier'], // Go 泛型 (1.18+)
    lambdaExpression: ['func_literal'], // Go 匿名函数
    structDeclaration: ['struct_type']
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
    structDeclaration: ['struct_item', 'unit_struct_item', 'tuple_struct_item']
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
    structDeclaration: ['struct_specifier']
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
    structDeclaration: ['struct_specifier']
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
    structDeclaration: ['struct_declaration', 'record_struct_declaration']
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
    structDeclaration: []  // Kotlin doesn't have structs (use data classes)
  }
  // Removed 'go' as no adapter exists for it
};