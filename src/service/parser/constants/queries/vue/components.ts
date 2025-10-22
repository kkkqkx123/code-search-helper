/*
Vue Component-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; Top-level structure
(component) @definition.component

; Template section
(template_element) @definition.template

; Component tags
(element
  (start_tag
    (tag_name) @_tag
    (#match? @_tag "^[A-Z]")) @definition.component_tag

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

; Template expressions
(interpolation) @definition.interpolation
(interpolation
  (mustache_brace) @definition.mustache)

; Comments in Vue file
(comment) @definition.comment
`;