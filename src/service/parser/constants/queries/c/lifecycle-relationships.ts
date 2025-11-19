/*
C Lifecycle Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的生命周期管理模式
*/
export default `
; 内存操作生命周期 - 使用交替查询优化
[
  (call_expression
    function: (identifier) @allocation.function
    (#match? @allocation.function "^(malloc|calloc|realloc|alloca)$")
    arguments: (argument_list
      (identifier) @allocation.size)
    (#set! "operation" "allocate")) @lifecycle.relationship.memory.allocation
  (call_expression
    function: (identifier) @deallocation.function
    (#match? @deallocation.function "^(free)$")
    arguments: (argument_list
      (identifier) @deallocated.pointer)
    (#set! "operation" "deallocate")) @lifecycle.relationship.memory.deallocation
  (call_expression
    function: (identifier) @reallocation.function
    (#match? @reallocation.function "^(realloc)$")
    arguments: (argument_list
      (identifier) @original.pointer
      (binary_expression) @new.size)
    (#set! "operation" "reallocate")) @lifecycle.relationship.memory.reallocation
] @lifecycle.relationship.memory.operations

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

; 文件操作生命周期 - 使用交替查询优化
[
  (call_expression
    function: (identifier) @file.open.function
    (#match? @file.open.function "^(fopen|open|fopen_s|open_s)$")
    arguments: (argument_list
      (string_literal) @file.path
      (string_literal) @file.mode)
    (#set! "operation" "open")) @lifecycle.relationship.file.open
  (call_expression
    function: (identifier) @file.close.function
    (#match? @file.close.function "^(fclose|close)$")
    arguments: (argument_list
      (identifier) @file.handle)
    (#set! "operation" "close")) @lifecycle.relationship.file.close
  (call_expression
    function: (identifier) @file.read.function
    (#match? @file.read.function "^(fread|read|fgets|getline)$")
    arguments: (argument_list
      (identifier) @file.handle)
    (#set! "operation" "read")) @lifecycle.relationship.file.read
  (call_expression
    function: (identifier) @file.write.function
    (#match? @file.write.function "^(fwrite|write|fputs|fprintf)$")
    arguments: (argument_list
      (identifier) @file.handle)
    (#set! "operation" "write")) @lifecycle.relationship.file.write
] @lifecycle.relationship.file.operations

; 文件句柄变量绑定
(declaration
  type: [(type_identifier) (primitive_type)] @file.handle.type
  declarator: (init_declarator
    declarator: [(identifier) (pointer_declarator declarator: (identifier))] @file.handle.variable
    value: (call_expression
      function: (identifier) @file.open.function
      (#match? @file.open.function "^(fopen|open)$")))
  (#set! "operation" "open")) @lifecycle.relationship.file.handle.binding

; 线程操作生命周期 - 使用交替查询优化
[
  (call_expression
    function: (identifier) @thread.create.function
    (#match? @thread.create.function "^(pthread_create|CreateThread|_beginthread)$")
    arguments: (argument_list
      (pointer_expression argument: (identifier) @thread.handle)
      (pointer_expression argument: (identifier) @thread.attributes)
      (identifier) @thread.function
      (null) @thread.argument)
    (#set! "operation" "create")) @lifecycle.relationship.thread.create
  (call_expression
    function: (identifier) @thread.join.function
    (#match? @thread.join.function "^(pthread_join|WaitForSingleObject)$")
    arguments: (argument_list
      (identifier) @thread.handle
      (unary_expression argument: (identifier) @thread.return.value)?)
    (#set! "operation" "join")) @lifecycle.relationship.thread.join
  (call_expression
    function: (identifier) @thread.detach.function
    (#match? @thread.detach.function "^(pthread_detach)$")
    arguments: (argument_list
      (identifier) @thread.handle)
    (#set! "operation" "detach")) @lifecycle.relationship.thread.detach
] @lifecycle.relationship.thread.operations

; 互斥锁操作生命周期 - 使用交替查询优化
[
  (call_expression
    function: (identifier) @mutex.init.function
    (#match? @mutex.init.function "^(pthread_mutex_init|InitializeCriticalSection)$")
    arguments: (argument_list
      (pointer_expression argument: (identifier) @mutex.handle)
      (null)? @mutex.attributes)
    (#set! "operation" "init")) @lifecycle.relationship.mutex.init
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

; 套接字操作生命周期 - 使用交替查询优化
[
  (call_expression
    function: (identifier) @socket.create.function
    (#match? @socket.create.function "^(socket|socket|WSASocket)$")
    arguments: (argument_list
      (identifier) @socket.domain
      (identifier) @socket.type
      (identifier) @socket.protocol)
    (#set! "operation" "create")) @lifecycle.relationship.socket.create
  (call_expression
    function: (identifier) @socket.bind.function
    (#match? @socket.bind.function "^(bind)$")
    arguments: (argument_list
      (identifier) @socket.handle
      [(unary_expression argument: (identifier) @socket.address)
       (cast_expression value: (pointer_expression argument: (identifier) @socket.address))
       (cast_expression value: (pointer_expression argument: (unary_expression argument: (identifier) @socket.address)))]))
    (#set! "operation" "bind")) @lifecycle.relationship.socket.bind
  (call_expression
    function: (identifier) @socket.listen.function
    (#match? @socket.listen.function "^(listen)$")
    arguments: (argument_list
      (identifier) @socket.handle
      (number_literal) @socket.backlog)
    (#set! "operation" "listen")) @lifecycle.relationship.socket.listen
  (call_expression
    function: (identifier) @socket.accept.function
    (#match? @socket.accept.function "^(accept|WSAAccept)$")
    arguments: (argument_list
      (identifier) @socket.handle
      (null)? @socket.address
      (null)? @socket.address_len
      (null)? @socket.condition
      (number_literal)? @socket.dwFlags)
    (#set! "operation" "accept")) @lifecycle.relationship.socket.accept
  (call_expression
    function: (identifier) @socket.close.function
    (#match? @socket.close.function "^(close|closesocket|shutdown)$")
    arguments: (argument_list
      (identifier) @socket.handle
      [(number_literal) @socket.how
       (identifier) @socket.how])
    (#set! "operation" "close")) @lifecycle.relationship.socket.close
] @lifecycle.relationship.socket.operations

; 资源构造函数模式
(function_definition
  body: (compound_statement
    (declaration
      (init_declarator
        value: (cast_expression
          value: (call_expression
            function: (identifier) @resource.allocation.function)))))
  (#match? @resource.allocation.function "^(malloc|calloc|realloc)$")
  (#set! "operation" "construct")) @lifecycle.relationship.resource.constructor

; 资源函数模式 - 使用交替查询优化
[
  (function_definition
    body: (compound_statement
      (declaration
        (init_declarator
          value: (cast_expression
            value: (call_expression
              function: (identifier) @resource.allocation.function)))))
    (#match? @resource.allocation.function "^(malloc|calloc|realloc)$")
    (#set! "operation" "construct")) @lifecycle.relationship.resource.constructor
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
  (function_definition
    declarator: (function_declarator
      declarator: (identifier) @resource.init.function
      parameters: (parameter_list
        (parameter_declaration
          type: (type_identifier)
          declarator: (pointer_declarator declarator: (identifier)) @resource.pointer)))
    body: (compound_statement)
    (#set! "operation" "init")) @lifecycle.relationship.resource.init
  (function_definition
    declarator: (function_declarator
      declarator: (identifier) @resource.cleanup.function
      parameters: (parameter_list
        (parameter_declaration
          type: (type_identifier)
          declarator: (pointer_declarator declarator: (identifier)) @resource.pointer)))
    body: (compound_statement)
    (#set! "operation" "cleanup")) @lifecycle.relationship.resource.cleanup
] @lifecycle.relationship.resource.operations

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