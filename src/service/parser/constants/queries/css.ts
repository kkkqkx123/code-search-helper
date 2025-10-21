/*
CSS Tree-Sitter Query Patterns
*/
const cssQuery = String.raw`
; CSS rulesets and selectors
(rule_set
  (selectors
    (class_selector
      (class_name) @name.definition.ruleset)) @definition.ruleset)

; Class selectors
(class_selector
  (class_name) @name.definition.class) @definition.class_selector

; ID selectors
(id_selector
  (id_name) @name.definition.id) @definition.id_selector

; Tag selectors
(tag_name) @name.definition.tag

; Pseudo class selectors
(pseudo_class_selector
  (class_name) @name.definition.pseudo_class) @definition.pseudo_class

; Pseudo element selectors
(pseudo_element_selector
  (tag_name) @name.definition.pseudo_element) @definition.pseudo_element

; Attribute selectors
(attribute_selector
  (attribute_name) @name.definition.attribute) @definition.attribute_selector

; Universal selector
(universal_selector) @definition.universal_selector

; Declarations and properties
(declaration
  (property_name) @name.definition.property) @definition.declaration

; Values in declarations
(declaration
  (integer_value) @definition.integer_value)
(declaration
  (float_value) @definition.float_value)
(declaration
  (color_value) @definition.color_value)
(declaration
  (string_value) @definition.string_value)
(declaration
  (unit) @definition.unit)

; Function calls in values
(call_expression
  (function_name) @name.definition.function) @definition.function_call

; Media queries
(media_statement
  (keyword_query) @name.definition.media_type) @definition.media

; Keyframe animations
(keyframes_statement
  (keyframes_name) @name.definition.keyframe) @definition.keyframe

; Import statements
(import_statement) @definition.import

; Font face rules
(at_rule
  (at_keyword) @_at_keyword
  (#eq? @_at_keyword "@font-face")) @definition.font_face

; Supports statements
(supports_statement) @definition.supports

; Nested rulesets (CSS nesting)
(rule_set
  (selectors
    (nesting_selector)) @definition.nested_ruleset)

; CSS variables (custom properties)
(declaration
  (property_name) @_prop
  (#match? @_prop "^--")) @definition.css_variable

; Comments
(comment) @definition.comment

; Child selectors
(child_selector) @definition.child_selector

; Sibling selectors
(sibling_selector) @definition.sibling_selector
(adjacent_sibling_selector) @definition.adjacent_sibling_selector

; Descendant selectors
(descendant_selector) @definition.descendant_selector

; Namespace selectors
(namespace_selector) @definition.namespace_selector

; Important declarations
(declaration
  (important) @definition.important)

; Ruleset with multiple selectors
(rule_set
  (selectors
    (_) @name.definition.multiple_selector)) @definition.multiple_selector_ruleset

; At-rules
(at_rule
  (at_keyword) @name.definition.at_rule) @definition.at_rule
`

export default cssQuery
