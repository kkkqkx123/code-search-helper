/*
C Creation Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的对象创建关系
*/
export default `
; 变量声明创建关系
(declaration
  type: (type_identifier) @creation.type
  declarator: (identifier) @creation.variable) @creation.relationship.variable

; 结构体实例化关系
(declaration
  type: (struct_specifier
    name: (type_identifier) @creation.struct.type)
  declarator: (identifier) @creation.struct.instance) @creation.relationship.struct

; 数组创建关系
(declaration
  type: (array_declarator
    type: (_) @creation.array.type
    size: (_) @creation.array.size)
  declarator: (identifier) @creation.array.name) @creation.relationship.array

; 指针创建关系
(declaration
  type: (pointer_declarator
    type: (_) @creation.pointer.type)
  declarator: (identifier) @creation.pointer.name) @creation.relationship.pointer

; 内存分配创建关系
(init_declarator
  declarator: (pointer_declarator
    declarator: (identifier) @creation.variable)
  value: (call_expression
    function: (identifier) @allocation.function
    (#match? @allocation.function "^(malloc|calloc|realloc)$")
    arguments: (argument_list
      (_) @allocation.size))) @creation.relationship.allocation

; 文件创建关系
(init_declarator
  declarator: (identifier) @creation.file.handle
  value: (call_expression
    function: (identifier) @file.open.function
    (#match? @file.open.function "^(fopen|open|create)$")
    arguments: (argument_list
      (string_literal) @file.path
      (_) @file.mode))) @creation.relationship.file

; 线程创建关系
(call_expression
  function: (identifier) @thread.create.function
  (#match? @thread.create.function "^(pthread_create|CreateThread|_beginthread)$")
  arguments: (argument_list
    (identifier) @thread.handle
    (_) @thread.attributes
    (identifier) @thread.function
    (_) @thread.argument)) @creation.relationship.thread

; 互斥锁创建关系
(call_expression
  function: (identifier) @mutex.create.function
  (#match? @mutex.create.function "^(pthread_mutex_init|InitializeCriticalSection)$")
  arguments: (argument_list
    (pointer_expression
      argument: (identifier) @mutex.handle)
    (_) @mutex.attributes)) @creation.relationship.mutex

; 条件变量创建关系
(call_expression
  function: (identifier) @condition.create.function
  (#match? @condition.create.function "^(pthread_cond_init)$")
  arguments: (argument_list
    (pointer_expression
      argument: (identifier) @condition.handle)
    (_) @condition.attributes)) @creation.relationship.condition

; 信号量创建关系
(call_expression
  function: (identifier) @semaphore.create.function
  (#match? @semaphore.create.function "^(sem_init|sem_open)$")
  arguments: (argument_list
    (pointer_expression
      argument: (identifier) @semaphore.handle)
    (_) @semaphore.pshared
    (_) @semaphore.value)) @creation.relationship.semaphore

; 套接字创建关系
(call_expression
  function: (identifier) @socket.create.function
  (#match? @socket.create.function "^(socket|WSASocket)$")
  arguments: (argument_list
    (_) @socket.domain
    (_) @socket.type
    (_) @socket.protocol)) @creation.relationship.socket
`;