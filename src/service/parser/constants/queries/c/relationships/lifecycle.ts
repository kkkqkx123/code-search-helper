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

; 内存分配变量绑定
(declaration
  type: (primitive_type)
  declarator: (init_declarator
    declarator: (pointer_declarator declarator: (identifier) @pointer.variable)
    value: (cast_expression
      value: (call_expression
        function: (identifier) @allocation.function
        (#match? @allocation.function "^(malloc|calloc|realloc|alloca)$"))))
  (#set! "operation" "allocate")) @lifecycle.relationship.memory.variable.binding

; 文件关闭生命周期
(call_expression
  function: (identifier) @file.close.function
  (#match? @file.close.function "^(fclose|close)$")
  arguments: (argument_list
    (identifier) @file.handle)
  (#set! "operation" "close")) @lifecycle.relationship.file.close

; 文件读取生命周期
(call_expression
  function: (identifier) @file.read.function
  (#match? @file.read.function "^(fread|read|fgets|getline)$")
  arguments: (argument_list
    (identifier) @file.handle)
  (#set! "operation" "read")) @lifecycle.relationship.file.read

; 文件写入生命周期
(call_expression
  function: (identifier) @file.write.function
  (#match? @file.write.function "^(fwrite|write|fputs|fprintf)$")
  arguments: (argument_list
    (identifier) @file.handle)
  (#set! "operation" "write")) @lifecycle.relationship.file.write

; 文件句柄变量绑定
(declaration
  type: [(type_identifier) (primitive_type)] @file.handle.type
  declarator: (init_declarator
    declarator: [(identifier) (pointer_declarator declarator: (identifier))] @file.handle.variable
    value: (call_expression
      function: (identifier) @file.open.function
      (#match? @file.open.function "^(fopen|open)$")))
  (#set! "operation" "open")) @lifecycle.relationship.file.handle.binding

; 线程加入生命周期
(call_expression
  function: (identifier) @thread.join.function
  (#match? @thread.join.function "^(pthread_join|WaitForSingleObject)$")
  arguments: (argument_list
    (identifier) @thread.handle
    (unary_expression argument: (identifier) @thread.return.value)?)
  (#set! "operation" "join")) @lifecycle.relationship.thread.join

; 线程分离生命周期
(call_expression
  function: (identifier) @thread.detach.function
  (#match? @thread.detach.function "^(pthread_detach)$")
  arguments: (argument_list
    (identifier) @thread.handle)
  (#set! "operation" "detach")) @lifecycle.relationship.thread.detach

; 互斥锁操作生命周期 - 使用交替查询优化
[
  (call_expression
    function: (identifier) @mutex.destroy.function
    (#match? @mutex.destroy.function "^(pthread_mutex_destroy|DeleteCriticalSection)$")
    arguments: (argument_list
      (pointer_expression argument: (identifier) @mutex.handle))
    (#set! "operation" "destroy")) @lifecycle.relationship.mutex.destroy
  (call_expression
    function: (identifier) @mutex.lock.function
    (#match? @mutex.lock.function "^(pthread_mutex_lock|EnterCriticalSection)$")
    arguments: (argument_list
      (pointer_expression argument: (identifier) @mutex.handle))
    (#set! "operation" "lock")) @lifecycle.relationship.mutex.lock
  (call_expression
    function: (identifier) @mutex.unlock.function
    (#match? @mutex.unlock.function "^(pthread_mutex_unlock|LeaveCriticalSection)$")
    arguments: (argument_list
      (pointer_expression argument: (identifier) @mutex.handle))
    (#set! "operation" "unlock")) @lifecycle.relationship.mutex.unlock
] @lifecycle.relationship.mutex.operations

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
  (#set! "operation" "destruct")) @lifecycle.relationship.resource.destructor

; 资源初始化函数模式
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @resource.init.function
    parameters: (parameter_list
      (parameter_declaration
        type: (type_identifier)
        declarator: (pointer_declarator declarator: (identifier)) @resource.pointer)))
  body: (compound_statement)
  (#set! "operation" "init")) @lifecycle.relationship.resource.init

; 资源清理函数模式
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @resource.cleanup.function
    parameters: (parameter_list
      (parameter_declaration
        type: (type_identifier)
        declarator: (pointer_declarator declarator: (identifier)) @resource.pointer)))
  body: (compound_statement)
  (#set! "operation" "cleanup")) @lifecycle.relationship.resource.cleanup

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