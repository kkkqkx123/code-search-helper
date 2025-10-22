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
(type_alias) @name.definition.type_alias

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
        name: (identifier) @name.definition.property
        (#match? @name.definition.property "^(property|.*property.*)$")))) @definition.property

; Static methods
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @name.definition.static_method
        (#match? @name.definition.static_method "^(staticmethod|.*static.*)$")))) @definition.static_method

; Class methods
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @name.definition.class_method
        (#match? @name.definition.class_method "^(classmethod|.*class.*)$")))) @definition.class_method

; Test functions
(function_definition
  name: (identifier) @name.definition.test
  (#match? @name.definition.test "^test_.*$"))

; Dunder methods (magic methods)
(function_definition
  name: (identifier) @name.definition.dunder_method
  (#match? @name.definition.dunder_method "^__.*__$"))

; Private methods (name mangling)
(function_definition
  name: (identifier) @name.definition.private_method
  (#match? @name.definition.private_method "^_.*$"))

; Comments for documentation
(comment) @name.definition.comment

; String literals that might be docstrings
(expression_statement
  (string) @name.definition.docstring
  (#match? @name.definition.docstring "^[\"']{3}.*[\"']{3}$"))
`;