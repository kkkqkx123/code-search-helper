export const vueQuery = `
; Top-level structure
(component) @definition.component

; Template section
(template_element) @definition.template
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

; Component tags
(element
  (start_tag
    (tag_name) @_tag
    (#match? @_tag "^[A-Z]")) @definition.component_tag)

; Script section
(script_element) @definition.script
(script_element
  (raw_text) @definition.script.content)

; Style section
(style_element) @definition.style
(style_element
  (raw_text) @definition.style.content)

; Slots
(slot_element) @definition.slot
(slot_element
  (start_tag
    (attribute
      (attribute_name) @_attr
      (#eq? @_attr "name"))
    (attribute_value) @name.definition.slot))

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

; Template expressions
(interpolation) @definition.interpolation
(interpolation
  (mustache_brace) @definition.mustache)

; Directives
(directive_attribute
  (directive_name) @name.definition.directive)
(directive_attribute
  (directive_argument) @name.definition.directive_argument)

; Component name (from script export)
(script_element
  (raw_text
    (comment) @_comment
    (#match? @_comment "name\\|@|component")))

; Comments in Vue file
(comment) @definition.comment
`
