/*
Python Class-specific Tree-Sitter Query Patterns
*/
export default `
; Class definitions
(class_definition
  name: (identifier) @name.definition.class) @definition.class

; Decorated class definitions
(decorated_definition
  definition: (class_definition
    name: (identifier) @name.definition.class)) @definition.class

; Method definitions within classes
(class_definition
  body: (block
    (function_definition
      name: (identifier) @name.definition.method))) @definition.method

; Decorated method definitions
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @name.definition.method)))) @definition.method

; Async method definitions
(class_definition
  body: (block
    (function_definition
      "async"
      name: (identifier) @name.definition.async_method))) @definition.async_method

; Class inheritance
(class_definition
  name: (identifier) @name.definition.class
  superclasses: (argument_list
    (identifier) @name.superclass)) @definition.class

; Property decorators
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @name.definition.property)))) @definition.property
`;