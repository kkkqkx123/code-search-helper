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
    functionDeclaration: ['function_declaration', 'function_expression', 'arrow_function'],
    classDeclaration: ['class_declaration'],
    interfaceDeclaration: ['interface_declaration'],
    importDeclaration: ['import_statement'],
    exportDeclaration: ['export_statement'],
    memberExpression: ['member_expression'],
    propertyIdentifier: ['property_identifier'],
    variableDeclaration: ['variable_declarator', 'lexical_declaration'],
    methodDeclaration: ['method_definition'],
    enumDeclaration: ['enum_declaration'],
    decorator: ['decorator'],
    typeAnnotation: [],
    genericTypes: [],
    lambdaExpression: ['arrow_function'],
    structDeclaration: []
  },
  'typescript': {
    callExpression: ['call_expression'],
    functionDeclaration: ['function_declaration', 'function_expression', 'arrow_function'],
    classDeclaration: ['class_declaration', 'abstract_class_declaration'],
    interfaceDeclaration: ['interface_declaration'],
    importDeclaration: ['import_statement'],
    exportDeclaration: ['export_statement'],
    memberExpression: ['member_expression'],
    propertyIdentifier: ['property_identifier'],
    variableDeclaration: ['variable_declarator', 'lexical_declaration'],
    methodDeclaration: ['method_definition'],
    enumDeclaration: ['enum_declaration'],
    decorator: ['decorator'],
    typeAnnotation: ['type_annotation'],
    genericTypes: ['generic_type'],
    lambdaExpression: ['arrow_function'],
    structDeclaration: []
  },
  'python': {
    callExpression: ['call'],
    functionDeclaration: ['function_declaration', 'function_expression', 'arrow_function'],
    classDeclaration: ['class_definition'],
    interfaceDeclaration: [], // Python没有接口
    importDeclaration: ['import_statement', 'import_from_statement'],
    exportDeclaration: [], // Python没有显式导出
    memberExpression: ['attribute'],
    propertyIdentifier: ['identifier'],
    variableDeclaration: ['assignment'],
    methodDeclaration: ['method_definition'], // Python中方法也是函数定义
    enumDeclaration: [],
    decorator: ['decorator'],
    typeAnnotation: ['type', 'type_annotation'],
    genericTypes: ['generic_type'],
    lambdaExpression: ['lambda'],
    structDeclaration: []
  },
  'java': {
    callExpression: ['method_invocation'],
    functionDeclaration: ['method_declaration', 'constructor_declaration'],
    classDeclaration: ['class_declaration'],
    interfaceDeclaration: ['interface_declaration'],
    importDeclaration: ['import_declaration'],
    exportDeclaration: [], // Java没有显式导出
    memberExpression: ['field_access'],
    propertyIdentifier: ['identifier'],
    variableDeclaration: ['variable_declarator'],
    methodDeclaration: ['method_declaration'],
    enumDeclaration: ['enum_declaration'],
    decorator: ['annotation'],
    typeAnnotation: [],
    genericTypes: ['generic_type'],
    lambdaExpression: ['arrow_function'],
    structDeclaration: []
  },
  'go': {
    callExpression: ['call_expression'],
    functionDeclaration: ['function_declaration'],
    classDeclaration: ['struct_type'], // Go使用struct作为类的表示
    interfaceDeclaration: ['interface_type'],
    importDeclaration: ['import_spec'],
    exportDeclaration: [], // Go通过大小写控制导出
    memberExpression: ['selector_expression'],
    propertyIdentifier: ['identifier'],
    variableDeclaration: ['var_declaration', 'short_var_declaration'],
    methodDeclaration: ['method_declaration'],
    enumDeclaration: [],
    decorator: [],
    typeAnnotation: [],
    genericTypes: ['generic_type'],
    lambdaExpression: [],
    structDeclaration: ['struct_type']
  },
  'rust': {
    callExpression: ['call_expression'],
    functionDeclaration: ['function_item', 'function_signature_item'],
    classDeclaration: ['struct_item', 'unit_struct_item', 'tuple_struct_item'], // Rust使用struct_item作为类的表示
    interfaceDeclaration: ['trait_item'], // Rust使用trait_item作为接口的表示
    importDeclaration: ['use_declaration', 'extern_crate_declaration'],
    exportDeclaration: [], // Rust通过pub关键字控制导出
    memberExpression: ['field_expression'],
    propertyIdentifier: ['field_identifier'],
    variableDeclaration: ['let_declaration', 'const_item', 'static_item'],
    methodDeclaration: ['function_item'], // Rust中方法也是函数项
    enumDeclaration: ['enum_item'],
    decorator: ['attribute_item'],
    typeAnnotation: [],
    genericTypes: ['type_parameters', 'type_arguments'],
    lambdaExpression: ['closure_expression'],
    structDeclaration: ['struct_item', 'unit_struct_item', 'tuple_struct_item']
  },
  'cpp': {
    callExpression: ['call_expression'],
    functionDeclaration: ['function_declaration', 'function_expression', 'arrow_function'],
    classDeclaration: ['class_specifier', 'struct_specifier', 'union_specifier'], // C++使用class_specifier作为类的表示
    interfaceDeclaration: [], // C++没有显式接口，使用抽象类
    importDeclaration: ['preproc_include'],
    exportDeclaration: [], // C++通过头文件控制导出
    memberExpression: ['field_expression'],
    propertyIdentifier: ['field_identifier'],
    variableDeclaration: ['declaration', 'init_declarator'],
    methodDeclaration: ['method_definition'],
    enumDeclaration: ['enum_specifier'],
    decorator: ['attribute_specifier', 'attribute_declaration'],
    typeAnnotation: ['type_descriptor'],
    genericTypes: ['template_type', 'template_parameter_list'],
    lambdaExpression: ['arrow_function'],
    structDeclaration: ['struct_specifier', 'union_specifier']
  },
  'c': {
    callExpression: ['call_expression'],
    functionDeclaration: ['function_declaration', 'function_expression', 'arrow_function'],
    classDeclaration: ['struct_specifier'], // C使用struct_specifier作为类的表示
    interfaceDeclaration: [], // C没有接口概念
    importDeclaration: ['preproc_include'],
    exportDeclaration: [], // C通过头文件控制导出
    memberExpression: ['field_expression'],
    propertyIdentifier: ['field_identifier'],
    variableDeclaration: ['declaration', 'init_declarator'],
    methodDeclaration: ['method_definition'],
    enumDeclaration: ['enum_specifier'],
    decorator: ['attribute_specifier', 'attribute_declaration'],
    typeAnnotation: ['type_descriptor'],
    genericTypes: [], // C没有泛型
    lambdaExpression: [], // C没有Lambda表达式
    structDeclaration: ['struct_specifier', 'union_specifier']
  },
  'csharp': {
    callExpression: ['invocation_expression'],
    functionDeclaration: ['method_declaration'],
    classDeclaration: ['class_declaration'],
    interfaceDeclaration: ['interface_declaration'],
    importDeclaration: ['using_directive'],
    exportDeclaration: [], // C#通过public关键字控制导出
    memberExpression: ['member_access_expression'],
    propertyIdentifier: ['identifier'],
    variableDeclaration: ['variable_declaration', 'variable_declarator', 'local_declaration_statement'],
    methodDeclaration: ['method_declaration'],
    enumDeclaration: ['enum_declaration'],
    decorator: ['attribute_list'],
    typeAnnotation: [],
    genericTypes: ['type_parameter_list', 'generic_name'],
    lambdaExpression: ['arrow_function'],
    structDeclaration: []
  }
  // ... 其他语言
};