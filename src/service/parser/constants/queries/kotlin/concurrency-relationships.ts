/*
Kotlin Concurrency Relationships-specific Tree-Sitter Query Patterns
用于识别同步、锁、通信、竞态条件等并发关系
*/
export default `
; 协程创建（launch）
(call_expression
  left: (simple_identifier) @coroutine.method
  (#match? @coroutine.method "^launch$")
  right: (value_arguments
    (lambda_literal) @coroutine.handler)) @concurrency.relationship.coroutine.launch

; 协程异步创建
(call_expression
  left: (simple_identifier) @coroutine.method
  (#match? @coroutine.method "^async$")
  right: (value_arguments
    (lambda_literal) @coroutine.handler)) @concurrency.relationship.coroutine.async

; 协程作用域
(call_expression
  left: (simple_identifier) @coroutine.scope
  (#match? @coroutine.scope "^(runBlocking|coroutineScope|supervisorScope)$")
  right: (value_arguments
    (lambda_literal) @coroutine.handler)) @concurrency.relationship.coroutine.scope

; 协程取消
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @coroutine.job
    right: (simple_identifier) @cancel.method)
  (#match? @cancel.method "^cancel$")) @concurrency.relationship.coroutine.cancel

; 协程等待
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @coroutine.deferred
    right: (simple_identifier) @await.method)
  (#match? @await.method "^await$")) @concurrency.relationship.coroutine.await

; 协程连接
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @coroutine.job
    right: (simple_identifier) @join.method)
  (#match? @join.method "^join$")) @concurrency.relationship.coroutine.join

; 通道创建
(call_expression
  left: (simple_identifier) @channel.constructor
  (#match? @channel.constructor "^Channel$")
  right: (value_arguments
    (simple_identifier) @channel.capacity)) @concurrency.relationship.channel.creation

; 通道发送
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @channel.sender
    right: (simple_identifier) @send.method)
  (#match? @send.method "^send$")
  right: (value_arguments
    (simple_identifier) @message.data)) @concurrency.relationship.channel.send

; 通道接收
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @channel.receiver
    right: (simple_identifier) @receive.method)
  (#match? @receive.method "^receive$")) @concurrency.relationship.channel.receive

; 通道关闭
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @channel.object
    right: (simple_identifier) @close.method)
  (#match? @close.method "^close$")) @concurrency.relationship.channel.close

; 互斥锁
(call_expression
  left: (simple_identifier) @mutex.constructor
  (#match? @mutex.constructor "^Mutex$")
  right: (value_arguments
    (simple_identifier) @mutex.data)) @concurrency.relationship.mutex.creation

; 互斥锁锁定
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @mutex.object
    right: (simple_identifier) @lock.method)
  (#match? @lock.method "^lock$")
  right: (value_arguments
    (lambda_literal) @lock.handler)) @concurrency.relationship.mutex.lock

; 读写锁
(call_expression
  left: (simple_identifier) @rwlock.constructor
  (#match? @rwlock.constructor "^ReentrantReadWriteLock$")
  right: (value_arguments)) @concurrency.relationship.rwlock.creation

; 读锁
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @rwlock.object
    right: (simple_identifier) @readlock.method)
  (#match? @readlock.method "^readLock$")
  right: (value_arguments
    (lambda_literal) @read.handler)) @concurrency.relationship.rwlock.read

; 写锁
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @rwlock.object
    right: (simple_identifier) @writelock.method)
  (#match? @writelock.method "^writeLock$")
  right: (value_arguments
    (lambda_literal) @write.handler)) @concurrency.relationship.rwlock.write

; 原子操作
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @atomic.class
    right: (simple_identifier) @atomic.method)
  (#match? @atomic.method "^(AtomicInt|AtomicBoolean|AtomicLong|compareAndSet|getAndSet|incrementAndGet)$")
  right: (value_arguments
    (simple_identifier) @atomic.value)) @concurrency.relationship.atomic.operation

; 线程池
(call_expression
  left: (simple_identifier) @threadpool.constructor
  (#match? @threadpool.constructor "^(Executors|ThreadPoolExecutor)$")
  right: (value_arguments
    (simple_identifier) @threadpool.parameter)) @concurrency.relationship.threadpool.creation

; 线程池执行
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @threadpool.object
    right: (simple_identifier) @execute.method)
  (#match? @execute.method "^(execute|submit|invokeAll|invokeAny)$")
  right: (value_arguments
    (lambda_literal) @task.handler)) @concurrency.relationship.threadpool.execute

; 选择表达式（select）
(call_expression
  left: (simple_identifier) @select.method
  (#match? @select.method "^select$")
  right: (value_arguments
    (lambda_literal) @select.handler)) @concurrency.relationship.select.expression

; 流操作
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @flow.object
    right: (simple_identifier) @flow.method)
  (#match? @flow.method "^(flow|channelFlow|callbackFlow)$")
  right: (value_arguments
    (lambda_literal) @flow.handler)) @concurrency.relationship.flow.creation

; 流收集
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @flow.collector
    right: (simple_identifier) @collect.method)
  (#match? @collect.method "^collect$")
  right: (value_arguments
    (lambda_literal) @collect.handler)) @concurrency.relationship.flow.collect

; 并发集合
(call_expression
  left: (simple_identifier) @concurrent.constructor
  (#match? @concurrent.constructor "^(ConcurrentHashMap|ConcurrentLinkedQueue|CopyOnWriteArrayList)$")
  right: (value_arguments)) @concurrency.relationship.concurrent.collection

; 并发集合操作
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @concurrent.collection
    right: (simple_identifier) @concurrent.method)
  (#match? @concurrent.method "^(put|get|remove|add|offer|poll)$")
  right: (value_arguments
    (simple_identifier) @concurrent.parameter)) @concurrency.relationship.concurrent.operation

; 同步块
(synchronized_statement
  body: (block) @sync.block) @concurrency.relationship.synchronized.block

; 同步方法
(function_declaration
  (modifiers
    (simple_identifier) @sync.modifier
    (#match? @sync.modifier "^synchronized$"))
  name: (simple_identifier) @sync.method
  body: (block) @sync.body) @concurrency.relationship.synchronized.method

; 竞态条件检测 - 共享变量写操作
(assignment
  left: (navigation_expression
    left: (simple_identifier) @shared.variable
    right: (simple_identifier) @shared.field)
  right: (binary_expression
    left: (navigation_expression
      left: (simple_identifier) @shared.variable
      right: (simple_identifier) @shared.field)
    right: (simple_identifier) @increment.value)) @concurrency.relationship.race.condition

; 线程本地变量
(property_declaration
  name: (simple_identifier) @threadlocal.variable
  (modifiers
    (annotation
      name: (simple_identifier) @threadlocal.annotation
      (#match? @threadlocal.annotation "^ThreadLocal$")))) @concurrency.relationship.thread.local

; 屏障同步
(call_expression
  left: (simple_identifier) @barrier.constructor
  (#match? @barrier.constructor "^CyclicBarrier$")
  right: (value_arguments
    (simple_identifier) @barrier.count
    (lambda_literal) @barrier.action))) @concurrency.relationship.barrier.creation

; 屏障等待
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @barrier.object
    right: (simple_identifier) @barrier.method)
  (#match? @barrier.method "^await$")) @concurrency.relationship.barrier.await

; 倒计时门闩
(call_expression
  left: (simple_identifier) @countdown.constructor
  (#match? @countdown.constructor "^CountDownLatch$")
  right: (value_arguments
    (simple_identifier) @countdown.count)) @concurrency.relationship.countdown.creation

; 倒计时
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @countdown.object
    right: (simple_identifier) @countdown.method)
  (#match? @countdown.method "^countDown$")) @concurrency.relationship.countdown.count

; 信号量
(call_expression
  left: (simple_identifier) @semaphore.constructor
  (#match? @semaphore.constructor "^Semaphore$")
  right: (value_arguments
    (simple_identifier) @semaphore.permits)) @concurrency.relationship.semaphore.creation

; 信号量获取
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @semaphore.object
    right: (simple_identifier) @semaphore.method)
  (#match? @semaphore.method "^(acquire|release|tryAcquire)$")) @concurrency.relationship.semaphore.operation

; 完成服务
(call_expression
  left: (simple_identifier) @completion.constructor
  (#match? @completion.constructor "^CompletionService$")
  right: (value_arguments
    (simple_identifier) @completion.executor)) @concurrency.relationship.completion.creation

; 异步任务提交
(call_expression
  left: (navigation_expression
    left: (simple_identifier) @completion.service
    right: (simple_identifier) @submit.method)
  (#match? @submit.method "^submit$")
  right: (value_arguments
    (lambda_literal) @task.handler)) @concurrency.relationship.completion.submit
`;