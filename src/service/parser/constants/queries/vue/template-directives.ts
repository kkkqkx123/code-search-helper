/*
Vue Template and Directive-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Template section with elements and attributes
(template_element
  (element
    (start_tag
      (tag_name) @name.definition.tag))
  (element
    (start_tag
      (attribute
        (attribute_name) @name.definition.attribute)))
  (element
    (start_tag
      (directive_attribute
        (directive_name) @name.definition.directive))))

; Directives
(directive_attribute
  (directive_name) @name.definition.directive)
(directive_attribute
  (directive_argument) @name.definition.directive_argument)

; Component properties (props)
(script_element
  (raw_text
    (comment) @_comment
    (#match? @_comment "prop\\|@|props")))

; Component methods
(script_element
  (raw_text
    (comment) @_comment
    (#match? @_comment "method\\|@|methods")))

; Component name (from script export)
(script_element
  (raw_text
    (comment) @_comment
    (#match? @_comment "name\\|@|component")))
`;