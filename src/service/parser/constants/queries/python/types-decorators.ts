/*
Python Type and Decorator-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Type annotations
(typed_parameter
  type: (type)) @name.definition.type_annotation

; Type hints and annotations
(type) @name.definition.type_hint

; Type alias statements (Python 3.12+)
(type_alias_statement) @name.definition.type_alias

; Parameter declarations
(parameters) @name.definition.parameters
(default_parameter) @name.definition.default_parameter
(typed_parameter) @name.definition.typed_parameter
(typed_default_parameter) @name.definition.typed_default_parameter

; Decorators
(decorator) @name.definition.decorator

; Property definitions
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @name.definition.property)))) @definition.property

; Static methods
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @name.definition.static_method)))) @definition.static_method

; Class methods
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @name.definition.class_method)))) @definition.class_method

; Test functions
(function_definition
  name: (identifier) @name.definition.test) @definition.test_function

; Dunder methods (magic methods)
(function_definition
  name: (identifier) @name.definition.dunder_method) @definition.dunder_method

; Private methods (name mangling)
(function_definition
  name: (identifier) @name.definition.private_method) @definition.private_method

; Comments for documentation
(comment) @name.definition.comment

; String literals that might be docstrings
(expression_statement
  (string) @name.definition.docstring) @definition.docstring

; Generic types
(generic_type
  (identifier) @name.definition.generic_type_name) @definition.generic_type

; Union types
(union_type) @name.definition.union_type
`;