/*
Rust Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import { RUST_QUERIES } from './rust/index';

export default RUST_QUERIES;

// Rust-specific query type mappings for normalization
export const rustQueryTypeMappings = {
  functions: [
    'function_item',
    'function_signature_item',
    'async_function',
    'closure_expression'
  ],
  classes: [  // In Rust context: struct, enum, union
    'struct_item',
    'unit_struct_item',
    'tuple_struct_item',
    'enum_item',
    'union_item'
  ],
  interfaces: [  // Rust traits
    'trait_item'
  ],
  methods: [  // functions inside impl blocks
    'impl_item'
  ],
  imports: [
    'mod_item',
    'use_declaration',
    'extern_crate_declaration',
    'foreign_item_fn',
    'foreign_static_item'
  ],
  variables: [
    'const_item',
    'static_item',
    'let_declaration',
    'assignment_expression'
  ],
  'control-flow': [
    'match_expression',
    'if_expression',
    'loop_expression',
    'while_expression',
    'for_expression',
    'unsafe_block'
  ],
  types: [
    'type_item',
    'type_parameter',
    'associated_type',
    'associated_constant',
    'attribute_item'
  ],
  expressions: [
    'call_expression',
    'field_expression',
    'binary_expression',
    'unary_expression',
    'array_expression',
    'tuple_expression',
    'cast_expression',
    'index_expression',
    'range_expression',
    'await_expression',
    'return_expression',
    'continue_expression',
    'break_expression',
    'try_expression',
    'reference_expression',
    'literal',
    'integer_literal',
    'float_literal',
    'string_literal',
    'char_literal',
    'boolean_literal',
    'unit_expression'
  ],
  macros: [
    'macro_definition',
    'macro_invocation'
  ],
  modules: [
    'mod_item'
  ]
};