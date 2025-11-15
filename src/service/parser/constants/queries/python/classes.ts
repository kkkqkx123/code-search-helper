/*
Python Class-specific Tree-Sitter Query Patterns
*/
export default `
; Unified class definitions - using alternation to reduce redundancy
[
  (class_definition
    name: (identifier) @class.name)
  (decorated_definition
    definition: (class_definition
      name: (identifier) @class.name))
] @definition.class

; Class inheritance with anchor operator for precise matching
(class_definition
  name: (identifier) @class.name
  superclasses: .
    (argument_list
      (identifier) @base.class)) @definition.class.with_inheritance

; Methods within classes - using alternation to combine similar patterns
(class_definition
  body: (block
    [
      (function_definition
        name: (identifier) @method.name)
      (decorated_definition
        definition: (function_definition
          name: (identifier) @method.name))
      (function_definition
        "async"
        name: (identifier) @async.method.name)
    ])) @definition.method

; Property decorators with predicate filtering
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @property.name)
      (decorator
        (identifier) @property.decorator
        (#match? @property.decorator "^(property|setter|getter)$"))))) @definition.property

; Constructor and destructor methods with precise matching
(class_definition
  body: (block
    (function_definition
      name: (identifier) @constructor.name
      (#match? @constructor.name "^__init__$")))) @definition.constructor

(class_definition
  body: (block
    (function_definition
      name: (identifier) @destructor.name
      (#match? @destructor.name "^__del__$")))) @definition.destructor
`;