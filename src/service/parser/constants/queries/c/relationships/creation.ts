/*
C Creation Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的对象创建关系
合并了lifecycle.ts和semantic.ts中的重复内存分配查询
*/
export default `
; 统一的内存分配创建关系（合并了lifecycle.ts和semantic.ts中的重复查询）
(init_declarator
  declarator: (pointer_declarator
    declarator: (identifier) @creation.variable)
  value: (call_expression
    function: (identifier) @allocation.function
    (#match? @allocation.function "^(malloc|calloc|realloc|alloca)$")
    arguments: (argument_list
      (_) @allocation.size))) @creation.relationship.allocation

; 统一的文件操作关系（合并了lifecycle.ts中的重复查询）
[
  ; 文件创建/打开
  (init_declarator
    declarator: (identifier) @creation.file.handle
    value: (call_expression
      function: (identifier) @file.open.function
      (#match? @file.open.function "^(fopen|open|create)$")
      arguments: (argument_list
        (string_literal) @file.path
        (_) @file.mode))) @creation.relationship.file
  ; 文件关闭
  (call_expression
    function: (identifier) @file.close.function
    (#match? @file.close.function "^(fclose|close)$")
    arguments: (argument_list
      (identifier) @file.handle)) @creation.relationship.file.close
  ; 文件读取
  (call_expression
    function: (identifier) @file.read.function
    (#match? @file.read.function "^(fread|read|fgets|getline)$")
    arguments: (argument_list
      (identifier) @file.handle)) @creation.relationship.file.read
  ; 文件写入
  (call_expression
    function: (identifier) @file.write.function
    (#match? @file.write.function "^(fwrite|write|fputs|fprintf)$")
    arguments: (argument_list
      (identifier) @file.handle)) @creation.relationship.file.write
] @creation.relationship.file.operations


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