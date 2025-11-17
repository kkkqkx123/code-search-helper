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

; 互斥锁初始化同步关系
(call_expression) @concurrency.relationship.mutex.init
  function: (identifier) @mutex.init.function
  (#match? @mutex.init.function "^(pthread_mutex_init)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @mutex.handle)
    (identifier)? @mutex.attributes)

; 互斥锁加锁同步关系
(call_expression) @concurrency.relationship.mutex.lock
  function: (identifier) @mutex.lock.function
  (#match? @mutex.lock.function "^(pthread_mutex_lock)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @mutex.handle))

; 互斥锁尝试加锁同步关系
(call_expression) @concurrency.relationship.mutex.trylock
  function: (identifier) @mutex.trylock.function
  (#match? @mutex.trylock.function "^(pthread_mutex_trylock)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @mutex.handle))

; 互斥锁解锁同步关系
(call_expression) @concurrency.relationship.mutex.unlock
  function: (identifier) @mutex.unlock.function
  (#match? @mutex.unlock.function "^(pthread_mutex_unlock)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @mutex.handle))

; 互斥锁销毁同步关系
(call_expression) @concurrency.relationship.mutex.destroy
  function: (identifier) @mutex.destroy.function
  (#match? @mutex.destroy.function "^(pthread_mutex_destroy)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @mutex.handle))

; 条件变量初始化同步关系
(call_expression) @concurrency.relationship.condition.init
  function: (identifier) @cond.init.function
  (#match? @cond.init.function "^(pthread_cond_init)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @cond.handle)
    (identifier)? @cond.attributes)

; 条件变量等待同步关系
(call_expression) @concurrency.relationship.condition.wait
  function: (identifier) @cond.wait.function
  (#match? @cond.wait.function "^(pthread_cond_wait|pthread_cond_timedwait)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @cond.handle)
    (pointer_expression argument: (identifier) @mutex.handle))

; 条件变量信号同步关系
(call_expression) @concurrency.relationship.condition.signal
  function: (identifier) @cond.signal.function
  (#match? @cond.signal.function "^(pthread_cond_signal)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @cond.handle))

; 条件变量广播同步关系
(call_expression) @concurrency.relationship.condition.broadcast
  function: (identifier) @cond.broadcast.function
  (#match? @cond.broadcast.function "^(pthread_cond_broadcast)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @cond.handle))

; 条件变量销毁同步关系
(call_expression) @concurrency.relationship.condition.destroy
  function: (identifier) @cond.destroy.function
  (#match? @cond.destroy.function "^(pthread_cond_destroy)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @cond.handle))

; 读写锁初始化同步关系
(call_expression) @concurrency.relationship.rwlock.init
  function: (identifier) @rwlock.init.function
  (#match? @rwlock.init.function "^(pthread_rwlock_init)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @rwlock.handle)
    (identifier)? @rwlock.attributes)

; 读写锁读锁同步关系
(call_expression) @concurrency.relationship.rwlock.readlock
  function: (identifier) @rwlock.readlock.function
  (#match? @rwlock.readlock.function "^(pthread_rwlock_rdlock)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @rwlock.handle))

; 读写锁写锁同步关系
(call_expression) @concurrency.relationship.rwlock.writelock
  function: (identifier) @rwlock.writelock.function
  (#match? @rwlock.writelock.function "^(pthread_rwlock_wrlock)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @rwlock.handle))

; 读写锁解锁同步关系
(call_expression) @concurrency.relationship.rwlock.unlock
  function: (identifier) @rwlock.unlock.function
  (#match? @rwlock.unlock.function "^(pthread_rwlock_unlock)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @rwlock.handle))

; 读写锁销毁同步关系
(call_expression) @concurrency.relationship.rwlock.destroy
  function: (identifier) @rwlock.destroy.function
  (#match? @rwlock.destroy.function "^(pthread_rwlock_destroy)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @rwlock.handle))

; 信号量初始化同步关系
(call_expression) @concurrency.relationship.semaphore.init
  function: (identifier) @semaphore.init.function
  (#match? @semaphore.init.function "^(sem_init)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @semaphore.handle)
    (identifier) @semaphore.pshared
    (identifier) @semaphore.value)

; 信号量等待同步关系
(call_expression) @concurrency.relationship.semaphore.wait
  function: (identifier) @semaphore.wait.function
  (#match? @semaphore.wait.function "^(sem_wait)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @semaphore.handle))

; 信号量尝试等待同步关系
(call_expression) @concurrency.relationship.semaphore.trywait
  function: (identifier) @semaphore.trywait.function
  (#match? @semaphore.trywait.function "^(sem_trywait)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @semaphore.handle))

; 信号量信号同步关系
(call_expression) @concurrency.relationship.semaphore.post
  function: (identifier) @semaphore.post.function
  (#match? @semaphore.post.function "^(sem_post)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @semaphore.handle))

; 信号量销毁同步关系
(call_expression) @concurrency.relationship.semaphore.destroy
  function: (identifier) @semaphore.destroy.function
  (#match? @semaphore.destroy.function "^(sem_destroy)$")
  arguments: (argument_list
    (pointer_expression argument: (identifier) @semaphore.handle))

; 内存屏障并发关系
(call_expression) @concurrency.relationship.memory.barrier
  function: (identifier) @memory.barrier.function
  (#match? @memory.barrier.function "^(atomic_thread_fence|__atomic_thread_fence)$")
  arguments: (argument_list
    (identifier)? @memory.order)

; 编译器屏障并发关系
(call_expression) @concurrency.relationship.compiler.barrier
  function: (identifier) @compiler.barrier.function
  (#match? @compiler.barrier.function "^(__sync_synchronize)$")
  arguments: (argument_list)

; 线程本地变量声明
(declaration
  (storage_class_specifier) @thread.local.specifier
  (#match? @thread.local.specifier "^(__thread|_Thread_local)$")
  type: (primitive_type) @thread.local.type
  declarator: (identifier) @thread.local.variable) @concurrency.relationship.thread.local
`;