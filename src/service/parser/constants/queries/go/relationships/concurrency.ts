/*
Go Concurrency Relationships-specific Tree-Sitter Query Patterns
用于识别同步、锁、通信、竞态条件等并发关系
*/
export default `
; 协程创建关系 - 使用谓词过滤
(go_statement
  (call_expression
    function: (identifier) @goroutine.function
    arguments: (argument_list
      (identifier) @goroutine.param)*)) @concurrency.goroutine.creation

; 通道操作关系 - 使用交替模式和谓词过滤
[
  (send_statement
    channel: (identifier) @channel.send
    value: (identifier) @channel.value)
  (unary_expression
    ["<-"] @receive.op
    operand: (identifier) @channel.receive))
  (call_expression
    function: (identifier) @channel.function
    arguments: (argument_list
      (channel_type) @channel.type))
    (#match? @channel.function "^(make|close)$")
] @concurrency.channel.operation

; Select语句并发关系 - 使用锚点确保精确匹配
(select_statement
  body: (block
    (comm_case
      [
        (send_statement
          channel: (identifier) @case.channel
          value: (identifier) @case.value)
        (expression_statement
          (unary_expression
            ["<-"] @receive.op
            operand: (identifier) @case.channel))
      ]
      (block) @case.body)*)) @concurrency.select.operation

; Mutex锁操作关系 - 使用谓词过滤
(call_expression
  function: (selector_expression
    operand: (identifier) @mutex.object
    field: (field_identifier) @mutex.method)
  arguments: (argument_list
    (identifier) @mutex.param)*)
  (#match? @mutex.method "^(Lock|Unlock|TryLock)$")) @concurrency.mutex.operation

; RWMutex操作关系 - 使用谓词过滤
(call_expression
  function: (selector_expression
    operand: (identifier) @rwmutex.object
    field: (field_identifier) @rwmutex.method)
  arguments: (argument_list
    (identifier) @rwmutex.param)*)
  (#match? @rwmutex.method "^(RLock|RUnlock|Lock|Unlock|TryRLock|TryLock)$")) @concurrency.rwmutex.operation

; WaitGroup操作关系 - 使用谓词过滤
(call_expression
  function: (selector_expression
    operand: (identifier) @waitgroup.object
    field: (field_identifier) @waitgroup.method)
  arguments: (argument_list
    (identifier) @waitgroup.param)*)
  (#match? @waitgroup.method "^(Add|Done|Wait)$")) @concurrency.waitgroup.operation

; Once操作关系 - 使用谓词过滤
(call_expression
  function: (selector_expression
    operand: (identifier) @once.object
    field: (field_identifier) @once.method)
  arguments: (argument_list
    (identifier) @once.param)*)
  (#match? @once.method "^(Do)$")) @concurrency.once.operation

; Cond操作关系 - 使用谓词过滤
(call_expression
  function: (selector_expression
    operand: (identifier) @cond.object
    field: (field_identifier) @cond.method)
  arguments: (argument_list
    (identifier) @cond.param)*)
  (#match? @cond.method "^(Wait|Signal|Broadcast)$")) @concurrency.cond.operation

; Pool操作关系 - 使用谓词过滤
(call_expression
  function: (selector_expression
    operand: (identifier) @pool.object
    field: (field_identifier) @pool.method)
  arguments: (argument_list
    (identifier) @pool.param)*)
  (#match? @pool.method "^(Get|Put|New)$")) @concurrency.pool.operation

; Timer操作关系 - 使用谓词过滤
(call_expression
  function: [
    (identifier) @timer.function
    (selector_expression
      operand: (identifier) @timer.object
      field: (field_identifier) @timer.method)
  ]
  arguments: (argument_list
    (identifier) @timer.param)*)
  (#match? @timer.function "^(NewTimer|AfterFunc|NewTicker|Stop|Reset)$")) @concurrency.timer.operation

; Context操作关系 - 使用谓词过滤
(call_expression
  function: (selector_expression
    operand: (identifier) @context.object
    field: (field_identifier) @context.method)
  arguments: (argument_list
    (identifier) @context.param)*)
  (#match? @context.method "^(WithCancel|WithTimeout|WithDeadline|Cancel|Deadline|Done)$")) @concurrency.context.operation

; 原子操作关系 - 使用谓词过滤
(call_expression
  function: (selector_expression
    operand: (identifier) @atomic.object
    field: (field_identifier) @atomic.method)
  arguments: (argument_list
    (identifier) @atomic.param)*)
  (#match? @atomic.method "^(Load|Store|Swap|CompareAndSwap|Add|Sub)$")) @concurrency.atomic.operation

; 竞态条件检测 - 使用锚点确保精确匹配
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
      operator: (_) @race.operator
      right: (identifier) @race.value)))) @concurrency.race.condition

; 死锁模式检测 - 使用量词操作符
(call_expression
  function: (selector_expression
    operand: (identifier) @first.lock
    field: (field_identifier) @lock.method)
  (#match? @lock.method "^(Lock|RLock)$"))
(call_expression
  function: (selector_expression
    operand: (identifier) @second.lock
    field: (field_identifier) @lock.method)
  (#match? @lock.method "^(Lock|RLock)$")) @concurrency.deadlock.pattern

; 并发模式关系 - 使用参数化查询
(type_declaration
  (type_spec
    name: (type_identifier) @pattern.type
    type: (struct_type
      (field_declaration_list
        (field_declaration
          name: (field_identifier) @pattern.field
          type: (type_identifier) @pattern.type)*))))
  (#match? @pattern.type "^(.*Pool|.*Worker|.*Producer|.*Consumer|.*Semaphore|.*Barrier)$")) @concurrency.pattern.relationship

; 同步原语操作 - 使用谓词过滤
(call_expression
  function: (selector_expression
    operand: (identifier) @sync.object
    field: (field_identifier) @sync.method)
  arguments: (argument_list
    (identifier) @sync.param)*)
  (#match? @sync.method "^(New|Lock|Unlock|Wait|Signal|Broadcast)$")) @concurrency.sync.primitive
`;