/*
 C# Tree-Sitter Query Patterns
 */
 export default `
 ; Using directives
 (using_directive) @definition.using
 (using_statement) @definition.using
  
 ; Namespace declarations (including file-scoped)
 ; Support both simple names (TestNamespace) and qualified names (My.Company.Module)
 (namespace_declaration
   name: (qualified_name) @name) @definition.namespace
 (namespace_declaration
   name: (identifier) @name) @definition.namespace
 (file_scoped_namespace_declaration
   name: (qualified_name) @name) @definition.namespace
 (file_scoped_namespace_declaration
   name: (identifier) @name) @definition.namespace
  
 ; Class declarations (including generic, static, abstract, partial, nested)
 (class_declaration
   name: (identifier) @name) @definition.class
 (record_class_declaration
   name: (identifier) @name) @definition.record_class
 (record_struct_declaration
   name: (identifier) @name) @definition.record_struct
  
 ; Interface declarations
 (interface_declaration
   name: (identifier) @name) @definition.interface
  
 ; Struct declarations
 (struct_declaration
   name: (identifier) @name) @definition.struct
  
 ; Enum declarations
 (enum_declaration
   name: (identifier) @name) @definition.enum
  
 ; Record declarations
 (record_declaration
   name: (identifier) @name) @definition.record
  
 ; Method declarations (including async, static, generic)
 (method_declaration
   name: (identifier) @name) @definition.method
 (constructor_declaration
   name: (identifier) @name) @definition.constructor
 (destructor_declaration
   name: (identifier) @name) @definition.destructor
 (operator_declaration
   name: (identifier) @name) @definition.operator
 (conversion_operator_declaration
   name: (identifier) @name) @definition.conversion_operator
  
 ; Property declarations
 (property_declaration
   name: (identifier) @name) @definition.property
 (indexer_declaration
   name: (identifier) @name) @definition.indexer
  
 ; Field declarations
 (field_declaration
   (variable_declarator
     name: (identifier) @name)) @definition.field
 (event_field_declaration
   (variable_declaration
     (variable_declarator
       name: (identifier) @name))) @definition.event_field
  
 ; Event declarations
 (event_declaration
   name: (identifier) @name) @definition.event
  
 ; Delegate declarations
 (delegate_declaration
   name: (identifier) @name) @definition.delegate
  
 ; Attribute declarations
 (attribute
   name: (identifier) @name) @definition.attribute
 (attribute_list) @definition.attribute_list
  
 ; Generic type parameters
 (type_parameter
   name: (identifier) @name) @definition.type_parameter
  
 ; Variable declarations
 (local_declaration_statement
   (variable_declaration
     (variable_declarator
       name: (identifier) @name))) @definition.local_variable
 (for_each_statement
   left: (identifier) @name) @definition.loop_variable
 (catch_declaration
   name: (identifier) @name) @definition.catch_variable
  
 ; Lambda expressions
 (lambda_expression) @definition.lambda
 (anonymous_method_expression) @definition.anonymous_method
  
 ; LINQ expressions
 (query_expression) @definition.linq_expression
 (from_clause
   name: (identifier) @name) @definition.linq_from
 (where_clause) @definition.linq_where
 (select_clause
   (identifier) @name) @definition.linq_select
 (group_clause
   (identifier) @name) @definition.linq_group
 (order_by_clause) @definition.linq_order
 (join_clause
   left: (identifier) @name
   right: (identifier) @name) @definition.linq_join
 (let_clause
   name: (identifier) @name) @definition.linq_let
  
 ; Pattern matching
 (is_pattern_expression) @definition.pattern_is
 (switch_expression) @definition.switch_expression
 (switch_expression_arm) @definition.switch_arm
 (constant_pattern) @definition.constant_pattern
 (relational_pattern) @definition.relational_pattern
 (var_pattern
   name: (identifier) @name) @definition.var_pattern
 (discard_pattern) @definition.discard_pattern
 (binary_pattern) @definition.binary_pattern
 (unary_pattern) @definition.unary_pattern
 (parenthesized_pattern) @definition.parenthesized_pattern
 (list_pattern) @definition.list_pattern
 (slice_pattern) @definition.slice_pattern
 (recursive_pattern) @definition.recursive_pattern
 (positional_pattern) @definition.positional_pattern
 (property_pattern_clause) @definition.property_pattern
 (subpattern) @definition.subpattern
 (declaration_expression
   name: (identifier) @name) @definition.declaration_expression
  
 ; Switch statements and expressions
 (switch_statement) @definition.switch_statement
 (switch_section) @definition.switch_section
 (case_switch_label) @definition.case_label
 (default_switch_label) @definition.default_label
 (case_pattern_switch_label) @definition.pattern_label
  
 ; Accessor declarations
 (accessor_declaration
   name: (identifier) @name) @definition.accessor
 (get_accessor_declaration) @definition.get_accessor
 (set_accessor_declaration) @definition.set_accessor
 (init_accessor_declaration) @definition.init_accessor
 (add_accessor_declaration) @definition.add_accessor
 (remove_accessor_declaration) @definition.remove_accessor
  
 ; Type aliases
 (extern_alias_directive) @definition.extern_alias
 (type_parameter_constraints_clause) @definition.type_constraint
  
 ; Conditional expressions
 (conditional_expression) @definition.conditional
 (conditional_access_expression) @definition.conditional_access
 (member_binding_expression) @definition.member_binding
 (element_binding_expression) @definition.element_binding
  
 ; Assignment and operators
 (assignment_expression) @definition.assignment
 (binary_expression) @definition.binary_operation
 (unary_expression) @definition.unary_operation
 (update_expression) @definition.update_operation
 (cast_expression) @definition.cast
 (as_expression) @definition.as_expression
 (null_coalescing_expression) @definition.null_coalescing
 (throw_expression) @definition.throw_expression
 (await_expression) @definition.await_expression
 (sizeof_expression) @definition.sizeof_expression
 (typeof_expression) @definition.typeof_expression
 (nameof_expression) @definition.nameof_expression
 (default_expression) @definition.default_expression
 (interpolated_string_expression) @definition.interpolated_string
 (interpolated_verbatim_string_expression) @definition.interpolated_verbatim_string
 (interpolated_string_text) @definition.interpolated_text
 (interpolation) @definition.interpolation
 (with_expression) @definition.with_expression
 (member_access_expression) @definition.member_access
 (element_access_expression) @definition.element_access
 (invocation_expression) @definition.invocation
 (object_creation_expression) @definition.object_creation
 (anonymous_object_creation_expression) @definition.anonymous_object_creation
 (array_creation_expression) @definition.array_creation
 (implicit_array_creation_expression) @definition.implicit_array_creation
 (stack_alloc_array_creation_expression) @definition.stackalloc_array_creation
 (array_type) @definition.array_type
 (pointer_type) @definition.pointer_type
 (nullable_type) @definition.nullable_type
 (tuple_type) @definition.tuple_type
 (tuple_element) @definition.tuple_element
 (tuple_expression) @definition.tuple
 (parenthesized_expression) @definition.parenthesized
 (identifier) @definition.identifier
 (this_expression) @definition.this
 (base_expression) @definition.base
 (literal) @definition.literal
 (string_literal) @definition.string_literal
 (character_literal) @definition.character_literal
 (numeric_literal) @definition.numeric_literal
 (boolean_literal) @definition.boolean_literal
 (null_literal) @definition.null_literal
 `
