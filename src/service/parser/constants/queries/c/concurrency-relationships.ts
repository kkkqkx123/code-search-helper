/*
C Concurrency Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的并发模式
*/
export default `
; 线程创建并发关系
(call_expression) @concurrency.relationship.thread.creation
  function: (identifier) @thread.create.function
  (#match? @thread.create.function "^(pthread_create|CreateThread|_beginthreadex)$")
  arguments: (argument_list
    (identifier) @thread.handle
    (identifier) @thread.attributes
    (identifier) @thread.start.function
    (identifier) @thread.argument)

; 线程等待并发关系
(call_expression) @concurrency.relationship.thread.wait
  function: (identifier) @thread.wait.function
  (#match? @thread.wait.function "^(pthread_join)$")
  arguments: (argument_list
    (identifier) @thread.handle
    (identifier)? @thread.return.value)

; 线程分离并发关系
(call_expression) @concurrency.relationship.thread.detach
  function: (identifier) @thread.detach.function
  (#match? @thread.detach.function "^(pthread_detach)$")
  arguments: (argument_list
    (identifier) @thread.handle)

; 线程退出并发关系
(call_expression) @concurrency.relationship.thread.exit
  function: (identifier) @thread.exit.function
  (#match? @thread.exit.function "^(pthread_exit)$")
  arguments: (argument_list
    (identifier)? @thread.exit.value)

; 获取线程ID并发关系
(call_expression) @concurrency.relationship.thread.id
  function: (identifier) @thread.id.function
  (#match? @thread.id.function "^(pthread_self)$")
  arguments: (argument_list)

; 互斥锁相关的同步关系 - 合并为单一查询 to improve efficiency
(call_expression) @concurrency.relationship.mutex.operation
  function: (identifier) @mutex.operation.function
  (#match? @mutex.operation.function "^(pthread_mutex_init|pthread_mutex_lock|pthread_mutex_trylock|pthread_mutex_unlock|pthread_mutex_destroy)$")
  [
    (argument_list
      (pointer_expression argument: (identifier) @mutex.handle)
      (identifier)? @mutex.attributes)
    (argument_list
      (pointer_expression argument: (identifier) @mutex.handle))
  ]

; 条件变量相关的同步关系 - 合并为单一查询 to improve efficiency
(call_expression) @concurrency.relationship.condition.operation
  function: (identifier) @cond.operation.function
  (#match? @cond.operation.function "^(pthread_cond_init|pthread_cond_wait|pthread_cond_timedwait|pthread_cond_signal|pthread_cond_broadcast|pthread_cond_destroy)$")
  [
    (argument_list
      (pointer_expression argument: (identifier) @cond.handle)
      (identifier)? @cond.attributes)
    (argument_list
      (pointer_expression argument: (identifier) @cond.handle)
      (pointer_expression argument: (identifier) @mutex.handle))
    (argument_list
      (pointer_expression argument: (identifier) @cond.handle))
  ]

; 读写锁相关的同步关系 - 合并为单一查询 to improve efficiency
(call_expression) @concurrency.relationship.rwlock.operation
  function: (identifier) @rwlock.operation.function
  (#match? @rwlock.operation.function "^(pthread_rwlock_init|pthread_rwlock_rdlock|pthread_rwlock_wrlock|pthread_rwlock_unlock|pthread_rwlock_destroy)$")
  [
    (argument_list
      (pointer_expression argument: (identifier) @rwlock.handle)
      (identifier)? @rwlock.attributes)
    (argument_list
      (pointer_expression argument: (identifier) @rwlock.handle))
  ]

; 信号量相关的同步关系 - 合并为单一查询 to improve efficiency
(call_expression) @concurrency.relationship.semaphore.operation
  function: (identifier) @semaphore.operation.function
  (#match? @semaphore.operation.function "^(sem_init|sem_wait|sem_trywait|sem_post|sem_destroy)$")
  [
    (argument_list
      (pointer_expression argument: (identifier) @semaphore.handle)
      (identifier) @semaphore.pshared
      (identifier) @semaphore.value)
    (argument_list
      (pointer_expression argument: (identifier) @semaphore.handle))
  ]

; 内存和编译器屏障并发关系 - 合并为单一查询 to improve efficiency
(call_expression) @concurrency.relationship.barrier.operation
  function: (identifier) @barrier.operation.function
  (#match? @barrier.operation.function "^(atomic_thread_fence|__atomic_thread_fence|__sync_synchronize)$")
  arguments: (argument_list
    (identifier)? @memory.order)

; 线程本地变量声明
(declaration
  (storage_class_specifier) @thread.local.specifier
  (#match? @thread.local.specifier "^(__thread|_Thread_local)$")
  type: (primitive_type) @thread.local.type
  declarator: (identifier) @thread.local.variable) @concurrency.relationship.thread.local
`;