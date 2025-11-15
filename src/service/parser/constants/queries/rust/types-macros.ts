/*
Rust Type and Macro-specific Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
export default `
; 类型别名查询
(type_item
  name: (type_identifier) @type.alias.name
  type: (_) @type.alias.type) @definition.type.alias

; 宏定义查询 - 使用参数化模式
(macro_definition
  name: (identifier) @macro.name
  (macro_rule
    (macro_matcher) @macro.matcher
    (transformation) @macro.transformation)*) @definition.macro

; 属性查询 - 使用量词操作符
(attribute_item
  (attribute
    name: (identifier) @attribute.name
    arguments: (token_tree
      (identifier) @attribute.arg)*))*) @definition.attribute

; 生命周期查询 - 使用锚点确保精确匹配
(lifetime
  "'" @lifetime.punctuation
  (identifier) @lifetime.name) @definition.lifetime

; Where子句查询 - 使用量词操作符
(where_clause
  (where_predicate
    left: (_) @where.left
    bounds: (trait_bounds
      (type_identifier) @where.bound)*)*) @definition.where_clause

; 泛型类型参数查询 - 使用量词操作符
(type_parameter
  name: (type_identifier) @type.param.name
  bounds: (trait_bounds
    (type_identifier) @type.bound)*) @definition.type.parameter

; 关联类型查询
(associated_type
  name: (type_identifier) @associated.type.name
  type: (_) @associated.type.type) @definition.associated.type

; 关联常量查询
(associated_constant
  name: (identifier) @associated.constant.name
  type: (_) @associated.constant.type
  value: (_) @associated.constant.value) @definition.associated.constant

; 可见性修饰符查询
(visibility_modifier) @definition.visibility

; 模式匹配查询 - 使用交替模式
[
  (match_pattern) @pattern.match
  (or_pattern) @pattern.or
  (tuple_pattern) @pattern.tuple
  (struct_pattern) @pattern.struct
  (tuple_struct_pattern) @pattern.tuple_struct
  (slice_pattern) @pattern.slice
  (captured_pattern) @pattern.captured
  (range_pattern) @pattern.range
  (reference_pattern) @pattern.reference
  (wildcard_pattern) @pattern.wildcard
] @definition.pattern

; 条件编译属性查询 - 使用谓词过滤
(attribute_item
  (attribute
    name: (identifier) @cfg.name
    arguments: (token_tree
      (identifier) @cfg.condition)*)
  (#match? @cfg.name "^cfg$")) @definition.conditional.compilation

; 循环标签查询
(loop_label
  (lifetime
    (identifier) @loop.label.name)) @definition.loop.label

; 内联汇编查询
(asm_expression
  template: (string_literal) @asm.template
  operands: (asm_operand_list
    (asm_operand) @asm.operand)*
  clobber_abis: (asm_clobber_abi_list
    (string_literal) @asm.clobber)*) @definition.asm.expression

; Const块查询
(const_block
  (statement) @const.statement*) @definition.const.block

; 高级trait边界查询
(higher_ranked_trait_bound) @definition.hrtb

; 移除的trait边界查询
(removed_trait_bound) @definition.removed.trait.bound

; 外部函数接口查询 - 使用交替模式
[
  (foreign_item_fn
    name: (identifier) @foreign.function.name
    parameters: (parameters
      (parameter
        name: (identifier) @foreign.param
        type: (_) @foreign.type)*)*
    return_type: (_) @foreign.return?)
  (foreign_static_item
    name: (identifier) @foreign.static.name
    type: (_) @foreign.static.type
    mutability: (mut)? @foreign.mutability)
] @definition.foreign.item

; 泛型类型查询 - 使用量词操作符
(generic_type
  type_arguments: (type_arguments
    (type_identifier) @generic.arg)+) @definition.generic.type

; 函数类型查询
(function_type
  parameters: (parameters
    (parameter
      type: (_) @func.param.type)*)*
  return_type: (_) @func.return.type?) @definition.function.type

; 指针类型查询
(pointer_type
  mutability: (mut)? @pointer.mutability
  type: (_) @pointer.type) @definition.pointer.type

; 引用类型查询
(reference_type
  mutability: (mut)? @reference.mutability
  lifetime: (lifetime)? @reference.lifetime
  type: (_) @reference.type) @definition.reference.type

; 切片类型查询
(slice_type
  type: (_) @slice.element) @definition.slice.type

; 数组类型查询
(array_type
  length: (_) @array.length
  type: (_) @array.element) @definition.array.type

; 元组类型查询
(tuple_type
  (type) @tuple.element+) @definition.tuple.type

; 单位类型查询
(unit_type) @definition.unit.type

; 从不类型查询
(never_type) @definition.never.type
`;