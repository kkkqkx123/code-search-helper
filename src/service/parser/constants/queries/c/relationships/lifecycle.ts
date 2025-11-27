/*
C Lifecycle Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的生命周期管理模式
从 ref/lifecycle-relationships.ts 迁移而来，排除已在 creation.ts 中的功能
*/
export default `
; 内存释放生命周期
(call_expression
  function: (identifier) @deallocation.function
  (#match? @deallocation.function "^(free)$")
  arguments: (argument_list
    (identifier) @deallocated.pointer)
  (#set! "operation" "deallocate")) @lifecycle.relationship.memory.deallocation

; 内存重新分配生命周期
(call_expression
  function: (identifier) @reallocation.function
  (#match? @reallocation.function "^(realloc)$")
  arguments: (argument_list
    (identifier) @original.pointer
    (binary_expression) @new.size)
  (#set! "operation" "reallocate")) @lifecycle.relationship.memory.reallocation

; 内存分配变量绑定 - 已移至creation.ts以避免重复
; 参考 creation.ts 中的统一内存分配查询

; 文件操作生命周期 - 已移至creation.ts以避免重复
; 参考 creation.ts 中的统一文件操作查询

; 线程操作生命周期 - 已移至concurrency.ts以避免重复
; 参考 concurrency.ts 中的统一线程操作查询

; 互斥锁操作生命周期 - 已移至concurrency.ts以避免重复
; 参考 concurrency.ts 中的统一互斥锁操作查询

; 资源管理函数模式 - 注意：这些是实体查询而非关系查询
; 建议移至专门的实体查询文件中，避免与关系查询混淆
; 资源析构函数模式
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @resource.destructor
    parameters: (parameter_list
      (parameter_declaration
        type: (type_identifier)
        declarator: (pointer_declarator declarator: (identifier)) @resource.pointer)))
  body: (compound_statement)
  (#eq? @resource.destructor "destroy_resource")
  (#set! "operation" "destruct")) @lifecycle.entity.resource.destructor

; 资源初始化函数模式
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @resource.init.function
    parameters: (parameter_list
      (parameter_declaration
        type: (type_identifier)
        declarator: (pointer_declarator declarator: (identifier)) @resource.pointer)))
  body: (compound_statement)
  (#set! "operation" "init")) @lifecycle.entity.resource.init

; 资源清理函数模式
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @resource.cleanup.function
    parameters: (parameter_list
      (parameter_declaration
        type: (type_identifier)
        declarator: (pointer_declarator declarator: (identifier)) @resource.pointer)))
  body: (compound_statement)
  (#set! "operation" "cleanup")) @lifecycle.entity.resource.cleanup

; 局部变量作用域开始
(compound_statement
  (declaration
    type: (primitive_type) @local.variable.type
    declarator: (init_declarator
      declarator: (identifier) @local.variable.name))
  (#set! "operation" "scope.begin")) @lifecycle.relationship.scope.local.begin

; 局部变量作用域结束
(compound_statement
  (declaration
    type: (primitive_type) @local.variable.type
    declarator: (init_declarator
      declarator: (identifier) @local.variable.name))
  .
  (#set! "operation" "scope.end")) @lifecycle.relationship.scope.local.end

; 全局变量生命周期
(declaration
  type: (primitive_type) @global.variable.type
  declarator: (init_declarator
    declarator: (identifier) @global.variable.name)) @lifecycle.relationship.scope.global

; 静态变量生命周期
(declaration
  (storage_class_specifier) @static.specifier
  type: (primitive_type) @static.variable.type
  declarator: (init_declarator
    declarator: (identifier) @static.variable.name)) @lifecycle.relationship.scope.static

; 函数参数生命周期
(function_definition
  declarator: (function_declarator
    parameters: (parameter_list
      (parameter_declaration
        type: (primitive_type) @parameter.type
        declarator: (identifier) @parameter.name)))
  body: (compound_statement)) @lifecycle.relationship.scope.parameter
`;