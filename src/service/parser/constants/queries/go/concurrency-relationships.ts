/*
Go Concurrency Relationships-specific Tree-Sitter Query Patterns
用于识别同步、锁、通信、竞态条件等并发关系
*/
export default `
; Goroutine创建并发关系
(go_statement
  (call_expression
    function: (identifier) @goroutine.function
    arguments: (argument_list
      (identifier) @goroutine.parameter))) @concurrency.relationship.goroutine.creation

; 通道发送并发关系
(send_statement
  channel: (identifier) @target.channel
  value: (identifier) @source.value) @concurrency.relationship.channel.send

; 通道接收并发关系
(unary_expression
  ["<-"] @receive.operator
  operand: (identifier) @source.channel) @concurrency.relationship.channel.receive

; Select语句并发关系
(select_statement
  body: (block
    (comm_case
      (send_statement
        channel: (identifier) @target.channel
        value: (identifier) @source.value)
      (block) @target.case.block))) @concurrency.relationship.select.send

; Select接收并发关系
(select_statement
  body: (block
    (comm_case
      (expression_statement
        (unary_expression
          ["<-"] @receive.operator
          operand: (identifier) @source.channel))
      (block) @target.case.block))) @concurrency.relationship.select.receive

; Mutex锁并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @mutex.object
    field: (field_identifier) @lock.function)
  (#match? @lock.function "Lock")
  arguments: (argument_list)) @concurrency.relationship.mutex.lock

; Mutex解锁并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @mutex.object
    field: (field_identifier) @unlock.function)
  (#match? @unlock.function "Unlock")
  arguments: (argument_list)) @concurrency.relationship.mutex.unlock

; RWMutex读锁并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @rwmutex.object
    field: (field_identifier) @read.lock.function)
  (#match? @read.lock.function "RLock")
  arguments: (argument_list)) @concurrency.relationship.rwmutex.read.lock

; RWMutex读解锁并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @rwmutex.object
    field: (field_identifier) @read.unlock.function)
  (#match? @read.unlock.function "RUnlock")
  arguments: (argument_list)) @concurrency.relationship.rwmutex.read.unlock

; RWMutex写锁并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @rwmutex.object
    field: (field_identifier) @write.lock.function)
  (#match? @write.lock.function "Lock")
  arguments: (argument_list)) @concurrency.relationship.rwmutex.write.lock

; RWMutex写解锁并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @rwmutex.object
    field: (field_identifier) @write.unlock.function)
  (#match? @write.unlock.function "Unlock")
  arguments: (argument_list)) @concurrency.relationship.rwmutex.write.unlock

; WaitGroup添加并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @waitgroup.object
    field: (field_identifier) @add.function)
  (#match? @add.function "Add")
  arguments: (argument_list
    (identifier) @counter.value)) @concurrency.relationship.waitgroup.add

; WaitGroup完成并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @waitgroup.object
    field: (field_identifier) @done.function)
  (#match? @done.function "Done")
  arguments: (argument_list)) @concurrency.relationship.waitgroup.done

; WaitGroup等待并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @waitgroup.object
    field: (field_identifier) @wait.function)
  (#match? @wait.function "Wait")
  arguments: (argument_list)) @concurrency.relationship.waitgroup.wait

; Once执行并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @once.object
    field: (field_identifier) @do.function)
  (#match? @do.function "Do")
  arguments: (argument_list
    (identifier) @once.function)) @concurrency.relationship.once.execution

; Cond等待并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @cond.object
    field: (field_identifier) @wait.function)
  (#match? @wait.function "Wait")
  arguments: (argument_list)) @concurrency.relationship.cond.wait

; Cond通知并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @cond.object
    field: (field_identifier) @signal.function)
  (#match? @signal.function "Signal|Broadcast")
  arguments: (argument_list)) @concurrency.relationship.cond.signal

; Pool获取并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @pool.object
    field: (field_identifier) @get.function)
  (#match? @get.function "Get")
  arguments: (argument_list)) @concurrency.relationship.pool.get

; Pool放回并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @pool.object
    field: (field_identifier) @put.function)
  (#match? @put.function "Put")
  arguments: (argument_list
    (identifier) @pool.object)) @concurrency.relationship.pool.put

; Channel创建并发关系
(call_expression
  function: (identifier) @make.function
  (#match? @make.function "make")
  arguments: (argument_list
    (channel_type) @channel.type)) @concurrency.relationship.channel.creation

; Channel关闭并发关系
(call_expression
  function: (identifier) @close.function
  (#match? @close.function "close")
  arguments: (argument_list
    (identifier) @channel.object)) @concurrency.relationship.channel.close

; Timer创建并发关系
(call_expression
  function: (identifier) @timer.function
  (#match? @timer.function "NewTimer|AfterFunc")
  arguments: (argument_list
    (identifier) @timer.duration)) @concurrency.relationship.timer.creation

; Timer停止并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @timer.object
    field: (field_identifier) @stop.function)
  (#match? @stop.function "Stop")
  arguments: (argument_list)) @concurrency.relationship.timer.stop

; Ticker创建并发关系
(call_expression
  function: (identifier) @ticker.function
  (#match? @ticker.function "NewTicker")
  arguments: (argument_list
    (identifier) @ticker.duration)) @concurrency.relationship.ticker.creation

; Ticker停止并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @ticker.object
    field: (field_identifier) @stop.function)
  (#match? @stop.function "Stop")
  arguments: (argument_list)) @concurrency.relationship.ticker.stop

; Context创建并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @context.package
    field: (field_identifier) @context.function)
  (#match? @context.function "WithCancel|WithTimeout|WithDeadline")
  arguments: (argument_list
    (identifier) @parent.context)) @concurrency.relationship.context.creation

; Context取消并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @cancel.function
    field: (field_identifier) @cancel.method)
  (#match? @cancel.method "Cancel")
  arguments: (argument_list)) @concurrency.relationship.context.cancel

; Atomic操作加载并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @atomic.package
    field: (field_identifier) @load.function)
  (#match? @load.function "Load")
  arguments: (argument_list
    (identifier) @atomic.value)) @concurrency.relationship.atomic.load

; Atomic操作存储并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @atomic.package
    field: (field_identifier) @store.function)
  (#match? @store.function "Store")
  arguments: (argument_list
    (identifier) @atomic.value
    (identifier) @store.value)) @concurrency.relationship.atomic.store

; Atomic操作交换并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @atomic.package
    field: (field_identifier) @swap.function)
  (#match? @swap.function "Swap")
  arguments: (argument_list
    (identifier) @atomic.value
    (identifier) @swap.value)) @concurrency.relationship.atomic.swap

; Atomic操作比较并交换并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @atomic.package
    field: (field_identifier) @compare.swap.function)
  (#match? @compare.swap.function "CompareAndSwap")
  arguments: (argument_list
    (identifier) @atomic.value
    (identifier) @expected.value
    (identifier) @new.value)) @concurrency.relationship.atomic.compare.and.swap

; Atomic操作增加并发关系
(call_expression
  function: (selector_expression
    operand: (identifier) @atomic.package
    field: (field_identifier) @add.function)
  (#match? @add.function "Add")
  arguments: (argument_list
    (identifier) @atomic.value
    (identifier) @delta.value)) @concurrency.relationship.atomic.add

; 竞态条件检测（共享变量修改）
(assignment_statement
  left: (expression_list
    (selector_expression
      operand: (identifier) @shared.object
      field: (field_identifier) @shared.field))
  right: (expression_list
    (binary_expression
      left: (selector_expression
        operand: (identifier) @shared.object
        field: (field_identifier) @shared.field)
      right: (identifier) @increment.value))) @concurrency.relationship.race.condition

; 竞态条件检测（数组元素修改）
(assignment_statement
  left: (expression_list
    (index_expression
      operand: (identifier) @shared.array
      index: (identifier) @shared.index))
  right: (expression_list
    (binary_expression
      left: (index_expression
        operand: (identifier) @shared.array
        index: (identifier) @shared.index)
      right: (identifier) @increment.value))) @concurrency.relationship.race.condition.array

; 死锁模式检测（多个锁获取）
(call_expression
  function: (selector_expression
    operand: (identifier) @first.lock
    field: (field_identifier) @lock.function)
  (#match? @lock.function "Lock")
  arguments: (argument_list))
(call_expression
  function: (selector_expression
    operand: (identifier) @second.lock
    field: (field_identifier) @lock.function)
  (#match? @lock.function "Lock")
  arguments: (argument_list)) @concurrency.relationship.deadlock.pattern

; 生产者-消费者模式并发关系
(type_declaration
  (type_spec
    name: (type_identifier) @producer.consumer.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @channel.field)
        (field_declaration
          (type_identifier) @data.field))))) @concurrency.relationship.producer.consumer.pattern

; 工作池模式并发关系
(type_declaration
  (type_spec
    name: (type_identifier) @worker.pool.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @jobs.channel)
        (field_declaration
          (type_identifier) @results.channel))))) @concurrency.relationship.worker.pool.pattern

; 信号量模式并发关系
(type_declaration
  (type_spec
    name: (type_identifier) @semaphore.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @channel.field))))) @concurrency.relationship.semaphore.pattern

; 互斥信号量模式并发关系
(type_declaration
  (type_spec
    name: (type_identifier) @mutex.semaphore.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @mutex.field))))) @concurrency.relationship.mutex.semaphore.pattern

; 读写锁模式并发关系
(type_declaration
  (type_spec
    name: (type_identifier) @read.write.lock.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @rwmutex.field))))) @concurrency.relationship.read.write.lock.pattern

; 条件变量模式并发关系
(type_declaration
  (type_spec
    name: (type_identifier) @condition.variable.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @cond.field)
        (field_declaration
          (type_identifier) @mutex.field))))) @concurrency.relationship.condition.variable.pattern

; 屏障模式并发关系
(type_declaration
  (type_spec
    name: (type_identifier) @barrier.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @counter.field)
        (field_declaration
          (type_identifier) @cond.field))))) @concurrency.relationship.barrier.pattern

; 一次性初始化模式并发关系
(type_declaration
  (type_spec
    name: (type_identifier) @once.initialization.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @once.field)
        (field_declaration
          (type_identifier) @value.field))))) @concurrency.relationship.once.initialization.pattern

; 等待组模式并发关系
(type_declaration
  (type_spec
    name: (type_identifier) @wait.group.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @waitgroup.field))))) @concurrency.relationship.wait.group.pattern

; 对象池模式并发关系
(type_declaration
  (type_spec
    name: (type_identifier) @object.pool.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @pool.field))))) @concurrency.relationship.object.pool.pattern

; 定时器模式并发关系
(type_declaration
  (type_spec
    name: (type_identifier) @timer.pattern.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @timer.field))))) @concurrency.relationship.timer.pattern

; Ticker模式并发关系
(type_declaration
  (type_spec
    name: (type_identifier) @ticker.pattern.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @ticker.field))))) @concurrency.relationship.ticker.pattern

; 上下文模式并发关系
(type_declaration
  (type_spec
    name: (type_identifier) @context.pattern.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @context.field))))) @concurrency.relationship.context.pattern

; 原子操作模式并发关系
(type_declaration
  (type_spec
    name: (type_identifier) @atomic.pattern.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          (type_identifier) @atomic.field))))) @concurrency.relationship.atomic.pattern
`;