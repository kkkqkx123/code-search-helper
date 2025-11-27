/*
C Concurrency Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的并发模式
优先级3
*/
export default `
; 统一的线程操作并发关系（合并了creation.ts和lifecycle.ts中的重复查询）
[
  ; 线程创建
  (call_expression
    function: (identifier) @thread.create.function
    (#match? @thread.create.function "^(pthread_create|CreateThread|_beginthread)$")
    arguments: (argument_list
      (identifier) @thread.handle
      (_) @thread.attributes
      (identifier) @thread.function
      (_) @thread.argument)) @concurrency.relationship.thread.create
  ; 线程等待
  (call_expression
    function: (identifier) @thread.wait.function
    (#match? @thread.wait.function "^(pthread_join|WaitForSingleObject)$")
    arguments: (argument_list
      (identifier) @thread.handle
      (identifier)? @thread.return.value)) @concurrency.relationship.thread.wait
  ; 线程分离
  (call_expression
    function: (identifier) @thread.detach.function
    (#match? @thread.detach.function "^(pthread_detach)$")
    arguments: (argument_list
      (identifier) @thread.handle)) @concurrency.relationship.thread.detach
] @concurrency.relationship.thread.operations


; 线程退出并发关系
(call_expression
  function: (identifier) @thread.exit.function
  (#match? @thread.exit.function "^(pthread_exit)$")
  arguments: (argument_list
    (identifier)? @thread.exit.value)) @concurrency.relationship.thread.exit

; 获取线程ID并发关系
(call_expression
  function: (identifier) @thread.id.function
  (#match? @thread.id.function "^(pthread_self)$")
  arguments: (argument_list)) @concurrency.relationship.thread.id

; 统一的互斥锁相关的同步关系（合并了creation.ts和lifecycle.ts中的重复查询）
[
  ; 互斥锁创建
  (call_expression
    function: (identifier) @mutex.create.function
    (#match? @mutex.create.function "^(pthread_mutex_init|InitializeCriticalSection)$")
    arguments: (argument_list
      (pointer_expression
        argument: (identifier) @mutex.handle)
      (_) @mutex.attributes)) @concurrency.relationship.mutex.create
  ; 互斥锁操作
  (call_expression
    function: (identifier) @mutex.operation.function
    (#match? @mutex.operation.function "^(pthread_mutex_lock|pthread_mutex_trylock|pthread_mutex_unlock|pthread_mutex_destroy|EnterCriticalSection|LeaveCriticalSection|DeleteCriticalSection)$")
    [
      (argument_list
        (pointer_expression argument: (identifier) @mutex.handle)
        (identifier)? @mutex.attributes)
      (argument_list
        (pointer_expression argument: (identifier) @mutex.handle))
    ]) @concurrency.relationship.mutex.operation
] @concurrency.relationship.mutex.operations

; 条件变量相关的同步关系 - 合并为单一查询 to improve efficiency
(call_expression
  function: (identifier) @cond.operation.function
  (#match? @cond.operation.function "^(pthread_cond_wait|pthread_cond_timedwait|pthread_cond_signal|pthread_cond_broadcast|pthread_cond_destroy)$")
  [
    (argument_list
      (pointer_expression argument: (identifier) @cond.handle)
      (identifier)? @cond.attributes)
    (argument_list
      (pointer_expression argument: (identifier) @cond.handle)
      (pointer_expression argument: (identifier) @mutex.handle))
    (argument_list
      (pointer_expression argument: (identifier) @cond.handle))
  ])@concurrency.relationship.condition.operation

; 读写锁相关的同步关系 - 合并为单一查询 to improve efficiency
(call_expression
  function: (identifier) @rwlock.operation.function
  (#match? @rwlock.operation.function "^(pthread_rwlock_rdlock|pthread_rwlock_wrlock|pthread_rwlock_unlock|pthread_rwlock_destroy)$")
  [
    (argument_list
      (pointer_expression argument: (identifier) @rwlock.handle)
      (identifier)? @rwlock.attributes)
    (argument_list
      (pointer_expression argument: (identifier) @rwlock.handle))
  ]) @concurrency.relationship.rwlock.operation

; 信号量相关的同步关系 - 合并为单一查询 to improve efficiency
(call_expression
  function: (identifier) @semaphore.operation.function
  (#match? @semaphore.operation.function "^(sem_wait|sem_trywait|sem_post|sem_destroy)$")
  [
    (argument_list
      (pointer_expression argument: (identifier) @semaphore.handle)
      (identifier) @semaphore.pshared
      (identifier) @semaphore.value)
    (argument_list
      (pointer_expression argument: (identifier) @semaphore.handle))
  ]) @concurrency.relationship.semaphore.operation

`;