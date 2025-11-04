/*
C Concurrency Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的并发模式
*/
export default `
; 线程创建并发关系
(call_expression
  function: (identifier) @thread.create.function
  (#match? @thread.create.function "^(pthread_create|CreateThread|_beginthread|_beginthreadex)$")
  arguments: (argument_list
    (identifier) @thread.handle
    (identifier) @thread.attributes
    (identifier) @thread.start.function
    (identifier) @thread.argument)) @concurrency.relationship.thread.creation

; 线程等待并发关系
(call_expression
  function: (identifier) @thread.wait.function
  (#match? @thread.wait.function "^(pthread_join|WaitForSingleObject|WaitForMultipleObjects)$")
  arguments: (argument_list
    (identifier) @thread.handle
    (identifier)? @thread.return.value)) @concurrency.relationship.thread.wait

; 线程分离并发关系
(call_expression
  function: (identifier) @thread.detach.function
  (#match? @thread.detach.function "^(pthread_detach)$")
  arguments: (argument_list
    (identifier) @thread.handle)) @concurrency.relationship.thread.detach

; 线程退出并发关系
(call_expression
  function: (identifier) @thread.exit.function
  (#match? @thread.exit.function "^(pthread_exit|_endthread|_endthreadex|ExitThread)$")
  arguments: (argument_list
    (identifier)? @thread.exit.value)) @concurrency.relationship.thread.exit

; 线程ID获取并发关系
(call_expression
  function: (identifier) @thread.id.function
  (#match? @thread.id.function "^(pthread_self|GetCurrentThreadId)$")
  arguments: (argument_list)) @concurrency.relationship.thread.id

; 互斥锁初始化同步关系
(call_expression
  function: (identifier) @mutex.init.function
  (#match? @mutex.init.function "^(pthread_mutex_init|InitializeCriticalSection|CreateMutex)$")
  arguments: (argument_list
    (identifier) @mutex.handle
    (identifier)? @mutex.attributes)) @concurrency.relationship.mutex.init

; 互斥锁销毁同步关系
(call_expression
  function: (identifier) @mutex.destroy.function
  (#match? @mutex.destroy.function "^(pthread_mutex_destroy|DeleteCriticalSection|CloseHandle)$")
  arguments: (argument_list
    (identifier) @mutex.handle)) @concurrency.relationship.mutex.destroy

; 互斥锁加锁同步关系
(call_expression
  function: (identifier) @mutex.lock.function
  (#match? @mutex.lock.function "^(pthread_mutex_lock|EnterCriticalSection|WaitForSingleObject)$")
  arguments: (argument_list
    (identifier) @mutex.handle)) @concurrency.relationship.mutex.lock

; 互斥锁解锁同步关系
(call_expression
  function: (identifier) @mutex.unlock.function
  (#match? @mutex.unlock.function "^(pthread_mutex_unlock|LeaveCriticalSection|ReleaseMutex)$")
  arguments: (argument_list
    (identifier) @mutex.handle)) @concurrency.relationship.mutex.unlock

; 互斥锁尝试加锁同步关系
(call_expression
  function: (identifier) @mutex.trylock.function
  (#match? @mutex.trylock.function "^(pthread_mutex_trylock|TryEnterCriticalSection)$")
  arguments: (argument_list
    (identifier) @mutex.handle)) @concurrency.relationship.mutex.trylock

; 条件变量初始化同步关系
(call_expression
  function: (identifier) @cond.init.function
  (#match? @cond.init.function "^(pthread_cond_init)$")
  arguments: (argument_list
    (identifier) @cond.handle
    (identifier)? @cond.attributes)) @concurrency.relationship.condition.init

; 条件变量销毁同步关系
(call_expression
  function: (identifier) @cond.destroy.function
  (#match? @cond.destroy.function "^(pthread_cond_destroy)$")
  arguments: (argument_list
    (identifier) @cond.handle)) @concurrency.relationship.condition.destroy

; 条件变量等待同步关系
(call_expression
  function: (identifier) @cond.wait.function
  (#match? @cond.wait.function "^(pthread_cond_wait|pthread_cond_timedwait)$")
  arguments: (argument_list
    (identifier) @cond.handle
    (identifier) @mutex.handle)) @concurrency.relationship.condition.wait

; 条件变量信号同步关系
(call_expression
  function: (identifier) @cond.signal.function
  (#match? @cond.signal.function "^(pthread_cond_signal)$")
  arguments: (argument_list
    (identifier) @cond.handle)) @concurrency.relationship.condition.signal

; 条件变量广播同步关系
(call_expression
  function: (identifier) @cond.broadcast.function
  (#match? @cond.broadcast.function "^(pthread_cond_broadcast)$")
  arguments: (argument_list
    (identifier) @cond.handle)) @concurrency.relationship.condition.broadcast

; 读写锁初始化同步关系
(call_expression
  function: (identifier) @rwlock.init.function
  (#match? @rwlock.init.function "^(pthread_rwlock_init)$")
  arguments: (argument_list
    (identifier) @rwlock.handle
    (identifier)? @rwlock.attributes)) @concurrency.relationship.rwlock.init

; 读写锁销毁同步关系
(call_expression
  function: (identifier) @rwlock.destroy.function
  (#match? @rwlock.destroy.function "^(pthread_rwlock_destroy)$")
  arguments: (argument_list
    (identifier) @rwlock.handle)) @concurrency.relationship.rwlock.destroy

; 读写锁读锁同步关系
(call_expression
  function: (identifier) @rwlock.readlock.function
  (#match? @rwlock.readlock.function "^(pthread_rwlock_rdlock)$")
  arguments: (argument_list
    (identifier) @rwlock.handle)) @concurrency.relationship.rwlock.readlock

; 读写锁写锁同步关系
(call_expression
  function: (identifier) @rwlock.writelock.function
  (#match? @rwlock.writelock.function "^(pthread_rwlock_wrlock)$")
  arguments: (argument_list
    (identifier) @rwlock.handle)) @concurrency.relationship.rwlock.writelock

; 读写锁解锁同步关系
(call_expression
  function: (identifier) @rwlock.unlock.function
  (#match? @rwlock.unlock.function "^(pthread_rwlock_unlock)$")
  arguments: (argument_list
    (identifier) @rwlock.handle)) @concurrency.relationship.rwlock.unlock

; 信号量初始化同步关系
(call_expression
  function: (identifier) @semaphore.init.function
  (#match? @semaphore.init.function "^(sem_init|CreateSemaphore)$")
  arguments: (argument_list
    (identifier) @semaphore.handle
    (identifier) @semaphore.shared
    (identifier) @semaphore.initial.value)) @concurrency.relationship.semaphore.init

; 信号量销毁同步关系
(call_expression
  function: (identifier) @semaphore.destroy.function
  (#match? @semaphore.destroy.function "^(sem_destroy|CloseHandle)$")
  arguments: (argument_list
    (identifier) @semaphore.handle)) @concurrency.relationship.semaphore.destroy

; 信号量等待同步关系
(call_expression
  function: (identifier) @semaphore.wait.function
  (#match? @semaphore.wait.function "^(sem_wait|WaitForSingleObject)$")
  arguments: (argument_list
    (identifier) @semaphore.handle)) @concurrency.relationship.semaphore.wait

; 信号量尝试等待同步关系
(call_expression
  function: (identifier) @semaphore.trywait.function
  (#match? @semaphore.trywait.function "^(sem_trywait)$")
  arguments: (argument_list
    (identifier) @semaphore.handle)) @concurrency.relationship.semaphore.trywait

; 信号量信号同步关系
(call_expression
  function: (identifier) @semaphore.post.function
  (#match? @semaphore.post.function "^(sem_post|ReleaseSemaphore)$")
  arguments: (argument_list
    (identifier) @semaphore.handle)) @concurrency.relationship.semaphore.post

; 原子加载操作
(call_expression
  function: (identifier) @atomic.load.function
  (#match? @atomic.load.function "^(atomic_load|__atomic_load_n|InterlockedExchange)$")
  arguments: (argument_list
    (identifier) @atomic.variable
    (identifier)? @atomic.memory.order)) @concurrency.relationship.atomic.load

; 原子存储操作
(call_expression
  function: (identifier) @atomic.store.function
  (#match? @atomic.store.function "^(atomic_store|__atomic_store_n|InterlockedExchange)$")
  arguments: (argument_list
    (identifier) @atomic.variable
    (identifier) @atomic.value
    (identifier)? @atomic.memory.order)) @concurrency.relationship.atomic.store

; 原子交换操作
(call_expression
  function: (identifier) @atomic.exchange.function
  (#match? @atomic.exchange.function "^(atomic_exchange|__atomic_exchange_n|InterlockedExchange)$")
  arguments: (argument_list
    (identifier) @atomic.variable
    (identifier) @atomic.value
    (identifier)? @atomic.memory.order)) @concurrency.relationship.atomic.exchange

; 原子比较交换操作
(call_expression
  function: (identifier) @atomic.compare.function
  (#match? @atomic.compare.function "^(atomic_compare_exchange|__atomic_compare_exchange_n|InterlockedCompareExchange)$")
  arguments: (argument_list
    (identifier) @atomic.variable
    (identifier) @atomic.expected
    (identifier) @atomic.desired
    (identifier)? @atomic.memory.order)) @concurrency.relationship.atomic.compare

; 原子获取并增加操作
(call_expression
  function: (identifier) @atomic.fetch.add.function
  (#match? @atomic.fetch.add.function "^(atomic_fetch_add|__atomic_fetch_add_n|InterlockedExchangeAdd)$")
  arguments: (argument_list
    (identifier) @atomic.variable
    (identifier) @atomic.value
    (identifier)? @atomic.memory.order)) @concurrency.relationship.atomic.fetch.add

; 原子获取并减少操作
(call_expression
  function: (identifier) @atomic.fetch.sub.function
  (#match? @atomic.fetch.sub.function "^(atomic_fetch_sub|__atomic_fetch_sub_n)$")
  arguments: (argument_list
    (identifier) @atomic.variable
    (identifier) @atomic.value
    (identifier)? @atomic.memory.order)) @concurrency.relationship.atomic.fetch.sub

; 内存屏障操作
(call_expression
  function: (identifier) @memory.barrier.function
  (#match? @memory.barrier.function "^(atomic_thread_fence|__atomic_thread_fence|MemoryBarrier|ReadWriteBarrier)$")
  arguments: (argument_list
    (identifier) @memory.order)) @concurrency.relationship.memory.barrier

; 编译器屏障操作
(call_expression
  function: (identifier) @compiler.barrier.function
  (#match? @compiler.barrier.function "^(__builtin_ia32_mfence|__sync_synchronize)$")
  arguments: (argument_list)) @concurrency.relationship.compiler.barrier

; 数据依赖屏障
(call_expression
  function: (identifier) @data.dependency.function
  (#match? @data.dependency.function "^(atomic_signal_fence|__atomic_signal_fence)$")
  arguments: (argument_list
    (identifier) @memory.order)) @concurrency.relationship.data.dependency

; 线程本地变量声明
(declaration
  storage_class_specifier: (storage_class_specifier) @thread.local.specifier
  (#match? @thread.local.specifier "^(__thread|_Thread_local)$")
  type: (type_identifier) @thread.local.type
  declarator: (identifier) @thread.local.variable) @concurrency.relationship.thread.local

; 线程特定数据键创建
(call_expression
  function: (identifier) @tls.key.create.function
  (#match? @tls.key.create.function "^(pthread_key_create)$")
  arguments: (argument_list
    (identifier) @tls.key
    (identifier) @tls.destructor)) @concurrency.relationship.tls.key.create

; 线程特定数据设置
(call_expression
  function: (identifier) @tls.set.function
  (#match? @tls.set.function "^(pthread_setspecific)$")
  arguments: (argument_list
    (identifier) @tls.key
    (identifier) @tls.value)) @concurrency.relationship.tls.set

; 线程特定数据获取
(call_expression
  function: (identifier) @tls.get.function
  (#match? @tls.get.function "^(pthread_getspecific)$")
  arguments: (argument_list
    (identifier) @tls.key)) @concurrency.relationship.tls.get

; 线程特定数据键删除
(call_expression
  function: (identifier) @tls.key.delete.function
  (#match? @tls.key.delete.function "^(pthread_key_delete)$")
  arguments: (argument_list
    (identifier) @tls.key)) @concurrency.relationship.tls.key.delete
`;