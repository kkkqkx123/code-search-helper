/*
Go Function and Type-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; 统一的函数和方法查询 - 使用交替模式
[
  (function_declaration
    name: (identifier) @function.name)
  (method_declaration
    name: (field_identifier) @method.name)
] @definition.function

; 带参数的函数查询 - 使用量词操作符
(function_declaration
  name: (identifier) @function.name
  parameters: (parameter_list
    (parameter_declaration
      name: (identifier) @param.name)*)
  body: (block) @function.body) @definition.function.with_params

; 类型声明查询 - 使用交替模式
[
  (type_declaration
    (type_spec
      name: (type_identifier) @type.name))
  (type_alias
    name: (type_identifier) @alias.name)
] @definition.type

; 接口和结构体查询 - 使用交替模式
[
  (type_declaration
    (type_spec
      name: (type_identifier) @interface.name
      type: (interface_type)))
  (type_declaration
    (type_spec
      name: (type_identifier) @struct.name
      type: (struct_type)))
] @definition.composite_type

; 泛型类型查询 - 使用谓词过滤
(type_declaration
  (type_spec
    name: (type_identifier) @generic.name
    type_parameters: (type_parameter_list
      (type_parameter
        name: (identifier) @type.param))))
  (#match? @generic.name "^[A-Z][a-zA-Z0-9]*$") @definition.generic_type

; 函数字面量查询
(func_literal
  body: (block) @lambda.body) @definition.lambda

; 测试函数查询 - 使用谓词过滤
(function_declaration
  name: (identifier) @test.name
  (#match? @test.name "^(Test|Benchmark|Example)"))
  body: (block) @test.body) @definition.test_function

; 字段声明查询 - 使用量词操作符
(field_declaration
  name: (field_identifier) @field.name
  type: (_) @field.type) @definition.field

; 变量声明查询 - 使用交替模式
[
  (var_declaration
    (var_spec
      name: (identifier) @var.name
      type: (_) @var.type))
  (short_var_declaration
    left: (expression_list
      (identifier) @short_var.name))
] @definition.variable

; 包声明查询
(package_clause
  name: (package_identifier) @package.name) @definition.package

; 导入声明查询
(import_declaration
  (import_spec
    path: (interpreted_string_literal) @import.path)) @definition.import
`;