/*
C# Method-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Method declarations (including async, static, generic) - primary code structure
(method_declaration
  name: (identifier) @name.definition.method) @definition.method

; Operator declarations - important for operator overloading
(operator_declaration
  name: (identifier) @name.definition.operator) @definition.operator

; Conversion operator declarations - important for type conversion
(conversion_operator_declaration
  name: (identifier) @name.definition.conversion_operator) @definition.conversion_operator

; Lambda expressions - important for functional programming
(lambda_expression) @definition.lambda
(anonymous_method_expression) @definition.anonymous_method

; Accessor declarations - important for property access
(accessor_declaration
  name: (identifier) @name.definition.accessor) @definition.accessor
(get_accessor_declaration) @definition.get_accessor
(set_accessor_declaration) @definition.set_accessor
(init_accessor_declaration) @definition.init_accessor
(add_accessor_declaration) @definition.add_accessor
(remove_accessor_declaration) @definition.remove_accessor

; Invocation expressions - important for method calls
(invocation_expression) @definition.invocation
`;