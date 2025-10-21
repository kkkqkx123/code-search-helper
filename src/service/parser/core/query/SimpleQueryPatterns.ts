/**
 * 简化的Tree-sitter查询模式
 * 不包含复杂的谓词和指令，确保基本功能正常工作
 */

export const SIMPLE_JAVASCRIPT_QUERIES = {
  functions: `
(function_declaration) @function
(method_definition) @function
`,

  classes: `
(class_declaration) @class
`,

  exports: `
(export_statement) @export
(export_default_declaration) @export
(export_named_declaration) @export
(export_all_declaration) @export
`,

  imports: `
(import_statement) @import
`,

  methods: `
(method_definition) @method
`
};

export const SIMPLE_TYPESCRIPT_QUERIES = {
  functions: `
(method_definition) @function
(method_signature) @function
`,

  classes: `
(class_declaration) @class
(interface_declaration) @interface
`,

  exports: `
(export_statement) @export
(export_default_declaration) @export
(export_named_declaration) @export
(export_all_declaration) @export
`,

  imports: `
(import_statement) @import
(import_declaration) @import
`,

  methods: `
(method_definition) @method
(method_signature) @method
`,

  interfaces: `
(interface_declaration) @interface
`,

  types: `
(type_alias_declaration) @type
`
};

export const SIMPLE_PYTHON_QUERIES = {
  functions: `
(function_definition) @function
(decorated_definition
  definition: (function_definition)) @function
`,

  classes: `
(class_definition) @class
(decorated_definition
  definition: (class_definition)) @class
`,

  imports: `
(import_statement) @import
(import_from_statement) @import
`,

  methods: `
(function_definition) @method
`,

  decorators: `
(decorated_definition) @decorator
`
};

export const SIMPLE_JAVA_QUERIES = {
  functions: `
(method_declaration) @function
(constructor_declaration) @function
`,

  classes: `
(class_declaration) @class
(interface_declaration) @interface
(enum_declaration) @enum
`,

  imports: `
(import_declaration) @import
`,

  methods: `
(method_declaration) @method
`,

  interfaces: `
(interface_declaration) @interface
`
};

export const SIMPLE_GO_QUERIES = {
  functions: `
(function_declaration) @function
(method_declaration) @function
`,

  classes: `
(type_spec
  name: (type_identifier) @name) @struct
`,

  imports: `
(import_spec) @import
`,

  methods: `
(method_declaration) @method
`,

  interfaces: `
(interface_type) @interface
`
};

export const SIMPLE_RUST_QUERIES = {
  functions: `
(function_item) @function
`,

  classes: `
(struct_item) @struct
(enum_item) @enum
`,

  imports: `
(use_declaration) @import
`,

  methods: `
(function_item) @method
`,

  traits: `
(trait_item) @trait
`
};

export const SIMPLE_CPP_QUERIES = {
  functions: `
(function_definition) @function
`,

  classes: `
(class_definition) @class
(struct_specifier) @struct
`,

  imports: `
(include_directive) @import
`,

  methods: `
(function_definition) @method
`,

  structs: `
(struct_specifier) @struct
`
};

export const SIMPLE_C_QUERIES = {
  functions: `
(function_definition) @function
`,

  structs: `
(struct_specifier) @struct
`
};

export const SIMPLE_CSHARP_QUERIES = {
  functions: `
(method_declaration) @function
(constructor_declaration) @function
`,

  classes: `
(class_declaration) @class
(interface_declaration) @interface
(struct_declaration) @struct
`,

  imports: `
(using_directive) @import
`,

  methods: `
(method_declaration) @method
`,

  interfaces: `
(interface_declaration) @interface
`
};

export const SIMPLE_SWIFT_QUERIES = {
  functions: `
(function_declaration) @function
`,

  classes: `
(class_declaration) @class
(struct_declaration) @struct
`,

  imports: `
(import_declaration) @import
`,

  methods: `
(function_declaration) @method
`,

  structs: `
(struct_declaration) @struct
`,

  protocols: `
(protocol_declaration) @protocol
`
};

export const SIMPLE_KOTLIN_QUERIES = {
  functions: `
(function_declaration) @function
`,

  classes: `
(class_declaration) @class
(interface_declaration) @interface
(object_declaration) @object
`,

  imports: `
(import_header) @import
`,

  methods: `
(function_declaration) @method
`,

  interfaces: `
(interface_declaration) @interface
`
};

export const SIMPLE_RUBY_QUERIES = {
  functions: `
(method) @function
(singleton_method) @function
`,

  classes: `
(class) @class
(module) @module
`,

  methods: `
(method) @method
`,

  modules: `
(module) @module
`
};

export const SIMPLE_PHP_QUERIES = {
  functions: `
(function_definition) @function
(method_declaration) @function
`,

  classes: `
(class_declaration) @class
(interface_declaration) @interface
`,

  imports: `
(use_statement) @import
`,

  methods: `
(method_declaration) @method
`,

  interfaces: `
(interface_declaration) @interface
`
};

export const SIMPLE_SCALA_QUERIES = {
  functions: `
(function_definition) @function
`,

  classes: `
(class_definition) @class
(trait_definition) @trait
(object_definition) @object
`,

  imports: `
(import_statement) @import
`,

  methods: `
(function_definition) @method
`,

  objects: `
(object_definition) @object
`,

  traits: `
(trait_definition) @trait
`
};