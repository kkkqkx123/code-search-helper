/*
JavaScript Class-specific Tree-Sitter Query Patterns
*/
export default `
; 统一的类声明查询 - 使用交替模式合并重复查询
[
  (class
    name: (_) @class.name)
  (class_declaration
    name: (_) @class.declaration.name)
  (class_expression
    name: (identifier) @class.expression.name)
] @definition.class

; 带文档注释的类声明查询
(
  (comment)* @doc
  .
  [
    (class
      name: (_) @class.name)
    (class_declaration
      name: (_) @class.declaration.name)
  ] @definition.class
  (#strip! @doc "^[\\s\\*/]+|^[\\s\\*/]$")
  (#select-adjacent! @doc @definition.class)
)

; Constructor - important class entry point
(method_definition
  name: (property_identifier) @constructor.name
  (#eq? @constructor.name "constructor")) @definition.constructor

; Getter/Setter Methods - important for property access
(method_definition
  name: (property_identifier) @accessor.name
  (#match? @accessor.name "^(get|set).*")) @definition.accessor

; Static methods - important for class structure
(method_definition
  name: (property_identifier) @static.name
  (#match? @static.name "^static")) @definition.static

; Private class fields - important for encapsulation
(private_property_identifier) @name.definition.private_field

; 带继承的类查询 - 使用锚点操作符
(class_declaration
  name: (identifier) @class.name
  heritage: .
    (identifier) @base.class
  body: (class_body) @class.body) @definition.class.with_inheritance

; 类成员查询 - 提供更多上下文信息
(class_declaration
  name: (identifier) @class.name
  body: (class_body
    (field_definition
      property: (property_identifier) @field.name)*
    (method_definition
      name: (property_identifier) @method.name
      parameters: (formal_parameters)? @method.params)*)) @definition.class.with_members
`;