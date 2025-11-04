/*
C++ Concurrency Relationships-specific Tree-Sitter Query Patterns
用于识别同步、锁、通信、竞态条件等并发关系
*/
export default `
; 线程创建
(call_expression
  function: (qualified_identifier
    scope: (identifier) @std.scope
    name: (identifier) @thread.constructor)
  arguments: (argument_list
    (identifier) @thread.function
    (identifier) @thread.args))
  (#match? @std.scope "std") @concurrency.relationship.thread.creation

; 线程加入
(call_expression
  function: (field_expression
    object: (identifier) @thread.object
    field: (field_identifier) @thread.method))
  (#match? @thread.method "join") @concurrency.relationship.thread.join

; 线程分离
(call_expression
  function: (field_expression
    object: (identifier) @thread.object
    field: (field_identifier) @thread.method))
  (#match? @thread.method "detach") @concurrency.relationship.thread.detach

; 互斥锁锁定
(call_expression
  function: (field_expression
    object: (identifier) @mutex.object
    field: (field_identifier) @mutex.method))
  (#match? @mutex.method "lock") @concurrency.relationship.mutex.lock

; 互斥锁解锁
(call_expression
  function: (field_expression
    object: (identifier) @mutex.object
    field: (field_identifier) @mutex.method))
  (#match? @mutex.method "unlock") @concurrency.relationship.mutex.unlock

; 互斥锁尝试锁定
(call_expression
  function: (field_expression
    object: (identifier) @mutex.object
    field: (field_identifier) @mutex.method))
  (#match? @mutex.method "try_lock") @concurrency.relationship.mutex.try_lock

; 锁守卫（RAII锁）
(declaration
  type: (qualified_identifier
    scope: (identifier) @std.scope
    name: (type_identifier) @lock.guard.type)
  declarator: (init_declarator
    declarator: (identifier) @lock.guard.variable
    value: (call_expression
      function: (identifier) @locked.mutex)))
  (#match? @lock.guard.type "^(lock_guard|unique_lock|shared_lock)$") @concurrency.relationship.lock.guard

; 条件变量等待
(call_expression
  function: (field_expression
    object: (identifier) @condition.variable
    field: (field_identifier) @condition.method)
  arguments: (argument_list
    (identifier) @locked.mutex))
  (#match? @condition.method "wait") @concurrency.relationship.condition.wait

; 条件变量通知
(call_expression
  function: (field_expression
    object: (identifier) @condition.variable
    field: (field_identifier) @condition.method))
  (#match? @condition.method "^(notify_one|notify_all)$") @concurrency.relationship.condition.notify

; 原子操作
(call_expression
  function: (field_expression
    object: (identifier) @atomic.variable
    field: (field_identifier) @atomic.method))
  (#match? @atomic.method "^(store|load|exchange|fetch_add|fetch_sub|fetch_and|fetch_or|fetch_xor)$") @concurrency.relationship.atomic.operation

; 原子比较交换
(call_expression
  function: (field_expression
    object: (identifier) @atomic.variable
    field: (field_identifier) @atomic.method)
  arguments: (argument_list
    (identifier) @expected.value
    (identifier) @desired.value))
  (#match? @atomic.method "compare_exchange") @concurrency.relationship.atomic.compare_exchange

; 原子标志
(call_expression
  function: (field_expression
    object: (identifier) @atomic.flag
    field: (field_identifier) @flag.method))
  (#match? @flag.method "^(test_and_set|clear)$") @concurrency.relationship.atomic.flag

; 信号量获取（C++20）
(call_expression
  function: (field_expression
    object: (identifier) @semaphore.object
    field: (field_identifier) @semaphore.method))
  (#match? @semaphore.method "acquire") @concurrency.relationship.semaphore.acquire

; 信号量释放（C++20）
(call_expression
  function: (field_expression
    object: (identifier) @semaphore.object
    field: (field_identifier) @semaphore.method)
  arguments: (argument_list))
  (#match? @semaphore.method "release") @concurrency.relationship.semaphore.release

; 闩器等待（C++20）
(call_expression
  function: (field_expression
    object: (identifier) @latch.object
    field: (field_identifier) @latch.method)
  arguments: (argument_list))
  (#match? @latch.method "wait") @concurrency.relationship.latch.wait

; 闩器倒计时（C++20）
(call_expression
  function: (field_expression
    object: (identifier) @latch.object
    field: (field_identifier) @latch.method)
  arguments: (argument_list))
  (#match? @latch.method "count_down") @concurrency.relationship.latch.count_down

; 屏障同步（C++20）
(call_expression
  function: (field_expression
    object: (identifier) @barrier.object
    field: (field_identifier) @barrier.method)
  arguments: (argument_list))
  (#match? @barrier.method "arrive_and_wait") @concurrency.relationship.barrier.sync

; 共享互斥锁（读写锁）
(call_expression
  function: (field_expression
    object: (identifier) @shared.mutex
    field: (field_identifier) @shared.method))
  (#match? @shared.method "^(lock_shared|unlock_shared)$") @concurrency.relationship.shared.mutex

; 异步任务创建
(call_expression
  function: (qualified_identifier
    scope: (identifier) @std.scope
    name: (identifier) @async.function)
  arguments: (argument_list
    (identifier) @async.task))
  (#match? @async.function "async") @concurrency.relationship.async.task

; 异步任务等待
(call_expression
  function: (field_expression
    object: (identifier) @future.object
    field: (field_identifier) @future.method))
  (#match? @future.method "wait") @concurrency.relationship.future.wait

; 异步任务获取结果
(call_expression
  function: (field_expression
    object: (identifier) @future.object
    field: (field_identifier) @future.method))
  (#match? @future.method "get") @concurrency.relationship.future.get

; 共享异步任务获取结果
(call_expression
  function: (field_expression
    object: (identifier) @shared.future.object
    field: (field_identifier) @shared.future.method))
  (#match? @shared.future.method "get") @concurrency.relationship.shared.future.get

; 承诺设置值
(call_expression
  function: (field_expression
    object: (identifier) @promise.object
    field: (field_identifier) @promise.method)
  arguments: (argument_list
    (identifier) @promise.value))
  (#match? @promise.method "set_value") @concurrency.relationship.promise.set_value

; 打包任务
(call_expression
  function: (qualified_identifier
    scope: (identifier) @std.scope
    name: (identifier) @packaged.task)
  arguments: (argument_list
    (identifier) @task.function))
  (#match? @packaged.task "packaged_task") @concurrency.relationship.packaged.task

; 线程本地存储
(declaration
  (storage_class_specifier) @thread.local.specifier
  declarator: (init_declarator
    declarator: (identifier) @thread.local.variable))
  (#match? @thread.local.specifier "thread_local") @concurrency.relationship.thread.local

; 内存屏障
(call_expression
  function: (qualified_identifier
    scope: (identifier) @std.scope
    name: (identifier) @atomic.function)
  arguments: (argument_list
    (identifier) @memory.order))
  (#match? @atomic.function "atomic_thread_fence") @concurrency.relationship.memory.fence

; 竞态条件检测
(assignment_expression
  left: (field_expression
    object: (identifier) @shared.variable
    field: (field_identifier) @shared.field)
  right: (binary_expression
    left: (field_expression
      object: (identifier) @shared.variable
      field: (field_identifier) @shared.field)
    operator: (identifier) @operator
    right: (identifier) @increment.value)) @concurrency.relationship.race.condition

; 死锁模式（多个锁获取）
(call_expression
  function: (field_expression
    object: (identifier) @first.lock
    field: (field_identifier) @lock.method)
  arguments: (argument_list))
  (#match? @lock.method "lock") @concurrency.relationship.deadlock.pattern

; 生产者-消费者模式
(class_specifier
  name: (type_identifier) @producer.consumer.class
  body: (field_declaration_list
    (field_declaration
      declarator: (field_declarator
        declarator: (field_identifier) @queue.field))
    (field_declaration
      declarator: (field_declarator
        declarator: (field_identifier) @mutex.field))
    (field_declaration
      declarator: (field_declarator
        declarator: (field_identifier) @condition.field)))) @concurrency.relationship.producer.consumer

; 读写锁模式
(class_specifier
  name: (type_identifier) @read.write.lock.class
  body: (field_declaration_list
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @read.lock.method))
    (function_definition
      declarator: (function_declarator
        declarator: (field_identifier) @write.lock.method)))) @concurrency.relationship.read.write.lock

; 线程池模式
(class_specifier
  name: (type_identifier) @thread.pool.class
  body: (field_declaration_list
    (field_declaration
      declarator: (field_declarator
        declarator: (field_identifier) @workers.field))
    (field_declaration
      declarator: (field_declarator
        declarator: (field_identifier) @tasks.field))
    (field_declaration
      declarator: (field_declarator
        declarator: (field_identifier) @queue.mutex)))) @concurrency.relationship.thread.pool

; 并行算法
(call_expression
  function: (qualified_identifier
    scope: (identifier) @std.scope
    name: (identifier) @parallel.algorithm)
  arguments: (argument_list
    (identifier) @execution.policy
    (identifier) @algorithm.args))
  (#match? @parallel.algorithm "^(for_each|sort|transform|reduce)$") @concurrency.relationship.parallel.algorithm

; 执行策略
(call_expression
  function: (qualified_identifier
    scope: (identifier) @execution.scope
    name: (identifier) @execution.policy))
  (#match? @execution.policy "^(par|par_unseq|seq|unseq)$") @concurrency.relationship.execution.policy

; 协程创建（C++20）
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @coroutine.function)
  return_type: (type_identifier) @coroutine.return.type)
  (#match? @coroutine.return.type "^(task|generator|lazy)$") @concurrency.relationship.coroutine

; 协程等待（C++20）
(await_expression
  (call_expression) @awaited.call) @concurrency.relationship.coroutine.await

; 协程让出（C++20）
(yield_statement
  (identifier) @yielded.value) @concurrency.relationship.coroutine.yield

; 无锁数据结构
(class_specifier
  name: (type_identifier) @lockfree.class
  body: (field_declaration_list
    (field_declaration
      type: (qualified_identifier
        scope: (identifier) @std.scope
        name: (type_identifier) @atomic.type)
      declarator: (field_declarator
        declarator: (field_identifier) @atomic.field)))) @concurrency.relationship.lockfree.structure

; 内存顺序指定
(call_expression
  function: (field_expression
    object: (identifier) @atomic.variable
    field: (field_identifier) @atomic.method)
  arguments: (argument_list
    (identifier) @memory.order))
  (#match? @memory.order "^(memory_order_relaxed|memory_order_acquire|memory_order_release|memory_order_acq_rel|memory_order_seq_cst)$") @concurrency.relationship.memory.order

; 事务内存（C++事务内存扩展）
(call_expression
  function: (qualified_identifier
    scope: (identifier) @transaction.scope
    name: (identifier) @transaction.function))
  (#match? @transaction.function "^(atomic|atomic_noexcept|atomic_cancel|atomic_commit)$") @concurrency.relationship.transactional.memory
`;