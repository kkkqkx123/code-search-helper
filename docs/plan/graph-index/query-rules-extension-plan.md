
# 查询规则扩展计划

## 概述

本文档基于AST适配器的修改方案，详细说明了需要补充的Tree-sitter查询规则内容，以支持高级图映射规则中的数据流、控制流、语义关系、生命周期和并发关系分析。

## 当前查询规则结构分析

### 现有查询规则组织方式

当前查询规则按语言和功能模块组织：
- **JavaScript**: functions, classes, control-flow, expressions, imports, exports, interfaces, methods, properties, types, variables
- **Python**: functions, classes, control-flow, data-structures, imports, types-decorators, variables
- **Java**: classes-interfaces, control-flow-patterns, methods-variables

### 现有查询规则特点

1. **基础结构识别**: 主要关注语法结构的识别和命名
2. **文档关联**: 通过 `@doc` 捕获和 `#select-adjacent!` 关联注释
3. **模式匹配**: 使用 `#match?` 进行特定模式识别（如测试函数、组件函数）
4. **类型注解**: 支持类型注解和泛型参数识别

## 需要补充的查询规则

### 1. 数据流关系查询规则

#### 1.1 JavaScript数据流查询规则

**新文件**: `src/service/parser/constants/queries/javascript/data-flow.ts`

```typescript
/*
JavaScript Data Flow-specific Tree-Sitter Query Patterns
用于追踪变量间的数据传递关系
*/
export default `
; 变量赋值数据流
(assignment_expression
  left: (identifier) @source.variable
  right: (identifier) @target.variable) @data.flow.assignment

; 对象属性赋值数据流
(assignment_expression
  left: (member_expression
    object: (identifier) @source.object
    property: (property_identifier) @source.property)
  right: (identifier) @target.variable) @data.flow.property.assignment

; 数组元素赋值数据流
(assignment_expression
  left: (subscript_expression
    object: (identifier) @source.array
    index: (identifier) @source.index)
  right: (identifier) @target.variable) @data.flow.array.assignment

; 函数参数传递数据流
(call_expression
  function: (identifier) @target.function
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.parameter

; 方法调用参数传递数据流
(call_expression
  function: (member_expression
    object: (identifier) @target.object
    property: (property_identifier) @target.method)
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.method.parameter

; 返回值数据流
(return_statement
  (identifier) @source.variable) @data.flow.return

; 对象属性返回数据流
(return_statement
  (member_expression
    object: (identifier) @source.object
    property: (property_identifier) @source.property)) @data.flow.property.return

; 函数表达式赋值数据流
(assignment_expression
  left: (identifier) @source.variable
  right: (function_expression) @target.function) @data.flow.function.assignment

; 箭头函数赋值数据流
(assignment_expression
  left: (identifier) @source.variable
  right: (arrow_function) @target.function) @data.flow.arrow.assignment

; 对象解构赋值数据流
(assignment_expression
  left: (object_pattern
    (pair
      key: (property_identifier) @source.property
      value: (identifier) @target.variable))) @data.flow.destructuring.object

; 数组解构赋值数据流
(assignment_expression
  left: (array_pattern
    (identifier) @target.variable)) @data.flow.destructuring.array

; 链式调用数据流
(call_expression
  function: (member_expression
    object: (call_expression) @source.call
    property: (property_identifier) @target.method)) @data.flow.chained.call
`;
```

#### 1.2 Python数据流查询规则

**新文件**: `src/service/parser/constants/queries/python/data-flow.ts`

```typescript
/*
Python Data Flow-specific Tree-Sitter Query Patterns
用于追踪变量间的数据传递关系
*/
export default `
; 变量赋值数据流
(assignment
  left: (identifier) @source.variable
  right: (identifier) @target.variable) @data.flow.assignment

; 类型注解赋值数据流
(annotated_assignment
  left: (identifier) @source.variable
  right: (identifier) @target.variable) @data.flow.annotated.assignment

; 增强赋值数据流
(augmented_assignment
  left: (identifier) @source.variable
  right: (identifier) @target.variable) @data.flow.augmented.assignment

; 属性赋值数据流
(assignment
  left: (attribute
    object: (identifier) @source.object
    attribute: (identifier) @source.property)
  right: (identifier) @target.variable) @data.flow.property.assignment

; 下标赋值数据流
(assignment
  left: (subscript
    object: (identifier) @source.object
    index: (identifier) @source.index)
  right: (identifier) @target.variable) @data.flow.subscript.assignment

; 函数调用参数传递数据流
(call
  function: (identifier) @target.function
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.parameter

; 方法调用参数传递数据流
(call
  function: (attribute
    object: (identifier) @target.object
    attribute: (identifier) @target.method)
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.method.parameter

; 返回值数据流
(return_statement
  (identifier) @source.variable) @data.flow.return

; 属性返回数据流
(return_statement
  (attribute
    object: (identifier) @source.object
    attribute: (identifier) @source.property)) @data.flow.property.return

; Lambda赋值数据流
(assignment
  left: (identifier) @source.variable
  right: (lambda) @target.lambda) @data.flow.lambda.assignment

; 列表推导式数据流
(assignment
  left: (identifier) @target.variable
  right: (list_comprehension
    (identifier) @source.variable)) @data.flow.list.comprehension

; 字典推导式数据流
(assignment
  left: (identifier) @target.variable
  right: (dictionary_comprehension
    (identifier) @source.variable)) @data.flow.dict.comprehension

; 生成器表达式数据流
(assignment
  left: (identifier) @target.variable
  right: (generator_expression
    (identifier) @source.variable)) @data.flow.generator.expression

; 多重赋值数据流
(assignment
  left: (pattern_list
    (identifier) @target.variable1)
  left: (pattern_list
    (identifier) @target.variable2)
  right: (identifier) @source.variable) @data.flow.multiple.assignment

; 解包赋值数据流
(assignment
  left: (pattern_list
    (identifier) @target.variable)
  right: (identifier) @source.variable) @data.flow.unpack.assignment
`;
```

#### 1.3 Java数据流查询规则

**新文件**: `src/service/parser/constants/queries/java/data-flow.ts`

```typescript
/*
Java Data Flow-specific Tree-Sitter Query Patterns
用于追踪变量间的数据传递关系
*/
export default `
; 变量赋值数据流
(assignment_expression
  left: (identifier) @source.variable
  right: (identifier) @target.variable) @data.flow.assignment

; 字段赋值数据流
(assignment_expression
  left: (field_access
    object: (identifier) @source.object
    field: (identifier) @source.field)
  right: (identifier) @target.variable) @data.flow.field.assignment

; 方法调用参数传递数据流
(method_invocation
  name: (identifier) @target.method
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.parameter

; 对象方法调用参数传递数据流
(method_invocation
  function: (field_access
    object: (identifier) @target.object
    field: (identifier) @target.method)
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.method.parameter

; 返回值数据流
(return_statement
  (identifier) @source.variable) @data.flow.return

; 字段返回数据流
(return_statement
  (field_access
    object: (identifier) @source.object
    field: (identifier) @source.field)) @data.flow.field.return

; 构造函数调用数据流
(object_creation_expression
  type: (type_identifier) @target.class
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.constructor.parameter

; Lambda表达式赋值数据流
(assignment_expression
  left: (identifier) @source.variable
  right: (lambda_expression) @target.lambda) @data.flow.lambda.assignment

; 泛型方法调用数据流
(method_invocation
  name: (identifier) @target.method
  type_arguments: (type_arguments
    (type_identifier) @type.argument)
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.generic.parameter

; 静态方法调用数据流
(method_invocation
  function: (scoped_identifier
    scope: (identifier) @target.class
    name: (identifier) @target.method)
  arguments: (argument_list
    (identifier) @source.parameter)) @data.flow.static.parameter

; 数组访问数据流
(array_access
  array: (identifier) @source.array
  index: (identifier) @source.index) @data.flow.array.access

; 类型转换数据流
(cast_expression
  value: (identifier) @source.variable
  type: (type_identifier) @target.type) @data.flow.cast.flow
`;
```

### 2. 控制流关系查询规则

#### 2.1 JavaScript控制流关系查询规则

**扩展现有文件**: `src/service/parser/constants/queries/javascript/control-flow.ts`

```typescript
// 在现有内容基础上添加以下查询规则

; 异常处理流关系
(try_statement
  body: (statement_block) @source.try.block
  (catch_clause
    parameter: (identifier) @exception.parameter
    body: (statement_block) @target.catch.block)) @control.flow.exception

; 多个catch子句的异常流
(try_statement
  body: (statement_block) @source.try.block
  (catch_clause
    parameter: (identifier) @exception.parameter1
    body: (statement_block) @target.catch.block1)
  (catch_clause
    parameter: (identifier) @exception.parameter2
    body: (statement_block) @target.catch.block2)) @control.flow.multiple.exception

; Finally块流关系
(try_statement
  body: (statement_block) @source.try.block
  (finally_clause
    body: (statement_block) @target.finally.block)) @control.flow.finally

; Throw语句流关系
(throw_statement
  (identifier) @source.exception.variable) @control.flow.throw

; 条件语句嵌套流
(if_statement
  condition: (parenthesized_expression
    (identifier) @source.condition.variable)
  consequence: (statement_block
    (if_statement
      condition: (parenthesized_expression
        (identifier) @source.nested.condition)
      consequence: (statement_block) @target.nested.block))) @control.flow.nested.conditional

; 循环嵌套流
(for_statement
  body: (statement_block
    (while_statement
      condition: (parenthesized_expression
        (identifier) @source.while.condition)
      body: (statement_block) @target.while.block))) @control.flow.nested.loop

; Switch语句流关系
(switch_statement
  value: (identifier) @source.switch.variable
  body: (switch_block
    (switch_case
      value: (identifier) @case.value
      (statement_block) @target.case.block))) @control.flow.switch.case

; 回调函数流关系
(call_expression
  function: (identifier) @target.callback.function
  arguments: (argument_list
    (function_expression) @source.callback.function)) @control.flow.callback

; Promise链式流
(call_expression
  function: (member_expression
    object: (call_expression) @source.promise.call
    property: (property_identifier) @target.promise.method
    (#match? @target.promise.method "^(then|catch|finally)$"))
  arguments: (argument_list
    (function_expression) @source.handler.function)) @control.flow.promise.chain

; 异步函数调用流
(call_expression
  function: (identifier) @target.async.function
  arguments: (argument_list
    (identifier) @source.parameter)) @control.flow.async.call

; Await表达式流
(await_expression
  (call_expression) @source.awaited.call) @control.flow.await
`;
```

#### 2.2 Python控制流关系查询规则

**扩展现有文件**: `src/service/parser/constants/queries/python/control-flow.ts`

```typescript
// 在现有内容基础上添加以下查询规则

; 异常处理流关系
(try_statement
  body: (block) @source.try.block
  (except_clause
    name: (identifier) @exception.parameter
    body: (block) @target.catch.block)) @control.flow.exception

; 多个except子句的异常流
(try_statement
  body: (block) @source.try.block
  (except_clause
    name: (identifier) @exception.parameter1
    body: (block) @target.catch.block1)
  (except_clause
    name: (identifier) @exception.parameter2
    body: (block) @target.catch.block2)) @control.flow.multiple.exception

; Finally块流关系
(try_statement
  body: (block) @source.try.block
  (finally_clause
    body: (block) @target.finally.block)) @control.flow.finally

; Raise语句流关系
(raise_statement
  (identifier) @source.exception.variable) @control.flow.raise

; Assert语句流关系
(assert_statement
  condition: (identifier) @source.assert.condition) @control.flow.assert

; 上下文管理器流关系
(with_statement
  body: (block) @target.with.block
  (with_item
    context: (call_expression
      function: (identifier) @context.manager)
    as: (identifier) @context.variable)) @control.flow.context.manager

; 异步上下文管理器流
(async_with_statement
  body: (block) @target.async.with.block
  (with_item
    context: (call_expression
      function: (identifier) @async.context.manager)
    as: (identifier) @async.context.variable)) @control.flow.async.context

; 异步函数调用流
(call
  function: (identifier) @target.async.function
  arguments: (argument_list
    (identifier) @source.parameter)) @control.flow.async.call

; Await表达式流
(await
  (call) @source.awaited.call) @control.flow.await

; 异步迭代流
(async_for_statement
  body: (block) @target.async.for.block
  left: (identifier) @async.for.variable) @control.flow.async.for

; 装饰器流关系
(decorated_definition
  (decorator
    (call_expression
      function: (identifier) @decorator.function))
  definition: (function_definition
    name: (identifier) @target.decorated.function)) @control.flow.decorator

; 生成器函数流
(yield
  (identifier) @source.yield.variable) @control.flow.yield

; 生成器表达式流
(generator_expression
  (identifier) @source.generator.variable) @control.flow.generator.expression
`;
```

#### 2.3 Java控制流关系查询规则

**扩展现有文件**: `src/service/parser/constants/queries/java/control-flow-patterns.ts`

```typescript
// 在现有内容基础上添加以下查询规则

; 异常处理流关系
(try_statement
  block: (block) @source.try.block
  (catch_clause
    parameter: (catch_formal_parameter
      name: (identifier) @exception.parameter)
    block: (block) @target.catch.block)) @control.flow.exception

; 多个catch子句的异常流
(try_statement
  block: (block) @source.try.block
  (catch_clause
    parameter: (catch_formal_parameter
      name: (identifier) @exception.parameter1)
    block: (block) @target.catch.block1)
  (catch_clause
    parameter: (catch_formal_parameter
      name: (identifier) @exception.parameter2)
    block: (block) @target.catch.block2)) @control.flow.multiple.exception

; Finally块流关系
(try_statement
  block: (block) @source.try.block
  (finally_clause
    block: (block) @target.finally.block)) @control.flow.finally

; Throw语句流关系
(throw_statement
  (identifier) @source.exception.variable) @control.flow.throw

; 同步语句流关系
(synchronized_statement
  (parenthesized_expression
    (identifier) @lock.object)
  block: (block) @target.synchronized.block) @control.flow.synchronized

; Try-with-resources流关系
(try_with_resources_statement
  resources: (resource_specification
    (variable_declarator
      name: (identifier) @resource.variable))
  block: (block) @target.with.resources.block) @control.flow.try.with.resources

; Switch表达式流关系
(switch_expression
  value: (identifier) @source.switch.variable
  (switch_rule
    (pattern) @switch.pattern
    (expression) @target.switch.expression)) @control.flow.switch.expression

; Lambda表达式流
(lambda_expression
  body: (expression
    (identifier) @source.lambda.variable)) @control.flow.lambda.expression

; 方法引用流
(method_reference
  object: (identifier) @source.method.reference.object
  method: (identifier) @target.method.reference.method) @control.flow.method.reference

; Stream API流关系
(method_invocation
  function: (member_expression
    object: (identifier) @source.stream.object
    property: (property_identifier) @stream.method
    (#match? @stream.method "^(map|filter|flatMap|reduce|collect)$"))
  arguments: (argument_list
    (lambda_expression) @target.lambda.handler)) @control.flow.stream.api

; 并发流关系
(method_invocation
  function: (member_expression
    object: (identifier) @source.concurrent.object
    property: (property_identifier) @concurrent.method
    (#match? @concurrent.method "^(submit|execute|invokeAll|fork)$"))
  arguments: (argument_list
    (identifier) @source.parameter)) @control.flow.concurrent.method
`;
```

### 3. 语义关系查询规则

#### 3.1 JavaScript语义关系查询规则

**新文件**: `src/service/parser/constants/queries/javascript/semantic-relationships.ts`

```typescript
/*
JavaScript Semantic Relationships-specific Tree-Sitter Query Patterns
用于识别方法重写、重载、委托、观察者模式等语义关系
*/
export default `
; 原型链继承关系（方法重写）
(assignment_expression
  left: (member_expression
    object: (identifier) @subclass.object
    property: (property_identifier) @overridden.method)
  right: (function_expression)) @semantic.relationship.prototype.override

; 类继承关系（方法重写）
(class_declaration
  name: (identifier) @subclass.class
  heritage: (class_heritage
    (identifier) @superclass.class)
  body: (class_body
    (method_definition
      name: (property_identifier) @overridden.method))) @semantic.relationship.class.override

; 混入模式（委托关系）
(call_expression
  function: (member_expression
    object: (identifier) @mixin.object
    property: (property_identifier) @mixin.method)
  arguments: (argument_list
    (identifier) @target.object)) @semantic.relationship.mixin.delegation

; 观察者模式（事件监听）
(call_expression
  function: (member_expression
    object: (identifier) @observer.target
    property: (property_identifier) @observer.method
    (#match? @observer.method "^(addEventListener|on|watch|subscribe)$"))
  arguments: (argument_list
    (string) @event.name
    (function_expression) @handler.function)) @semantic.relationship.observer.pattern

; 发布订阅模式
(call_expression
  function: (member_expression
    object: (identifier) @publisher.object
    property: (property_identifier) @publisher.method
    (#match? @publisher.method "^(emit|publish|notify)$"))
  arguments: (argument_list
    (string) @event.name
    (identifier) @event.data)) @semantic.relationship.publisher.pattern

; 配置对象模式
(call_expression
  function: (identifier) @configurable.function
  arguments: (argument_list
    (object
      (pair
        key: (property_identifier) @config.key
        value: (identifier) @config.value)))) @semantic.relationship.configuration

; 工厂模式
(call_expression
  function: (identifier) @factory.function
  arguments: (argument_list
    (identifier) @factory.parameter)) @semantic.relationship.factory.pattern

; 单例模式
(assignment_expression
  left: (member_expression
    object: (identifier) @singleton.object
    property: (property_identifier) @singleton.instance)
  right: (call_expression
    function: (identifier) @constructor.function)) @semantic.relationship.singleton.pattern

; 装饰器模式（高阶函数）
(call_expression
  function: (identifier) @decorator.function
  arguments: (argument_list
    (function_expression) @decorated.function)) @semantic.relationship.decorator.pattern

; 策略模式
(call_expression
  function: (member_expression
    object: (identifier) @context.object
    property: (property_identifier) @strategy.setter
    (#match? @strategy.setter "^(setStrategy|setAlgorithm)$"))
  arguments: (argument_list
    (identifier) @strategy.object)) @semantic.relationship.strategy.pattern

; 命令模式
(call_expression
  function: (member_expression
    object: (identifier) @invoker.object
    property: (property_identifier) @invoker.method
    (#match? @invoker.method "^(execute|invoke|run)$"))
  arguments: (argument_list
    (identifier) @command.object)) @semantic.relationship.command.pattern
`;
```

#### 3.2 Python语义关系查询规则

**新文件**: `src/service/parser/constants/queries/python/semantic-relationships.ts`

```typescript
/*
Python Semantic Relationships-specific Tree-Sitter Query Patterns
用于识别方法重写、重载、委托、观察者模式等语义关系
*/
export default `
; 类继承关系（方法重写）
(class_definition
  name: (identifier) @subclass.class
  superclasses: (argument_list
    (identifier) @superclass.class)
  body: (block
    (function_definition
      name: (identifier) @overridden.method))) @semantic.relationship.class.override

; 装饰器模式（观察者）
(decorated_definition
  (decorator
    (call_expression
      function: (identifier) @observer.decorator
      (#match? @observer.decorator "^(observer|subscribe|watch)$")))
  definition: (function_definition
    name: (identifier) @observer.method)) @semantic.relationship.observer.decorator

; 属性装饰器（观察者模式）
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @property.name)
      (decorator
        (identifier) @property.decorator
        (#match? @property.decorator "^(property|setter|getter)$"))))) @semantic.relationship.property.decorator

; 类方法装饰器（委托模式）
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @delegated.method)
      (decorator
        (identifier) @delegate.decorator
        (#match? @delegate.decorator "^(delegate|forward)$"))))) @semantic.relationship.delegate.decorator

; 静态方法装饰器
(class_definition
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @static.method)
      (decorator
        (identifier) @staticmethod.decorator)))) @semantic.relationship.static.method

; 抽象基类装饰器
(class_definition
  name: (identifier) @abstract.class
  body: (block
    (decorated_definition
      definition: (function_definition
        name: (identifier) @abstract.method)
      (decorator
        (identifier) @abstractmethod.decorator)))) @semantic.relationship.abstract.method

; 数据类装饰器（配置模式）
(decorated_definition
  (decorator
    (identifier) @dataclass.decorator
    (#match? @dataclass.decorator "^(dataclass)$"))
  definition: (class_definition
    name: (identifier) @config.class)) @semantic.relationship.dataclass.pattern

; 上下文管理器装饰器
(decorated_definition
  (decorator
    (identifier) @contextmanager.decorator
    (#match? @contextmanager.decorator "^(contextmanager)$"))
  definition: (function_definition
    name: (identifier) @context.manager)) @semantic.relationship.contextmanager.pattern

; 元类模式
(class_definition
  name: (identifier) @metaclass.class
  (argument_list
    (keyword_argument
      key: (identifier) @metakey
      value: (identifier) @metavalue
      (#match? @metakey "metaclass")))) @semantic.relationship.metaclass.pattern

; 描述符协议
(class_definition
  body: (block
    (function_definition
      name: (identifier) @descriptor.method
      (#match? @descriptor.method "^(__get__|__set__|__delete__)$")))) @semantic.relationship.descriptor.pattern

; 迭代器协议
(class_definition
  body: (block
    (function_definition
      name: (identifier) @iterator.method
      (#match? @iterator.method "^(__iter__|__next__)$")))) @semantic.relationship.iterator.pattern

; 异步迭代器协议
(class_definition
  body: (block
    (function_definition
      name: (identifier) @async.iterator.method
      (#match? @async.iterator.method "^(__aiter__|__anext__)$")))) @semantic.relationship.async.iterator.pattern
`;
```

#### 3.3 Java语义关系查询规则

**新文件**: `src/service/parser/constants/queries/java/semantic-relationships.ts`

```typescript
/*
Java Semantic Relationships-specific Tree-Sitter Query Patterns
用于识别方法重写、重载、委托、观察者模式等语义关系
*/
export default `
; 方法重写关系（@Override注解）
(method_declaration
  name: (identifier) @overridden.method
  (annotation
    name: (identifier) @override.annotation
    (#match? @override.annotation "Override$"))) @semantic.relationship.method.override

; 类继承关系
(class_declaration
  name: (identifier) @subclass.class
  superclass: (superclass
    (type_identifier) @superclass.class)) @semantic.relationship.class.inheritance

; 接口实现关系
(class_declaration
  name: (identifier) @implementing.class
  super_interfaces: (super_interfaces
    (type_list
      (type_identifier) @implemented.interface))) @semantic.relationship.interface.implementation

; 接口继承关系
(interface_declaration
  name: (identifier) @subinterface.interface
  super_interfaces: (super_interfaces
    (type_list
      (type_identifier) @superinterface.interface))) @semantic.relationship.interface.inheritance

; 泛型类型参数关系
(class_declaration
  name: (identifier) @generic.class
  type_parameters: (type_parameters
    (type_parameter
      name: (identifier) @type.parameter))) @semantic.relationship.generic.parameter

; 观察者模式（@Observer注解）
(method_declaration
  name: (identifier) @observer.method
  (annotation
    name: (identifier) @observer.annotation
    (#match? @observer.annotation "Observer$"))) @semantic.relationship.observer.pattern

; 可观察对象（@Observable注解）
(class_declaration
  name: (identifier) @observable.class
  (annotation
    name: (identifier) @observable.annotation
    (#match? @observable.annotation "Observable$"))) @semantic.relationship.observable.pattern

; 事件处理器模式
(method_declaration
  name: (identifier) @event.handler
  (annotation
    name: (identifier) @event.annotation
    (#match? @event.annotation "^(EventHandler|Subscribe|Listen)$"))) @semantic.relationship.event.handler

; 依赖注入模式
(method_declaration
  parameters: (formal_parameters
    (formal_parameter
      name: (identifier) @injected.parameter
      (annotation
        name: (identifier) @inject.annotation
        (#match? @inject.annotation "^(Inject|Autowired)$"))))) @semantic.relationship.dependency.injection

; 配置属性模式
(field_declaration
  declarator: (variable_declarator
    name: (identifier) @config.property)
  (annotation
    name: (identifier) @config.annotation
    (#match? @config.annotation "^(Value|Property|Configuration)$"))) @semantic.relationship.configuration.property

; 组件扫描模式
(class_declaration
  name: (identifier) @component.class
  (annotation
    name: (identifier) @component.annotation
    (#match? @component.annotation "^(Component|Service|Repository|Controller)$"))) @semantic.relationship.component.pattern

; 单例模式
(class_declaration
  name: (identifier) @singleton.class
  (annotation
    name: (identifier) @singleton.annotation
    (#match? @singleton.annotation "Singleton$"))) @semantic.relationship.singleton.pattern

; 工厂方法模式
(method_declaration
  name: (identifier) @factory.method
  (annotation
    name: (identifier) @factory.annotation
    (#match? @factory.annotation "^(Bean|Factory|Producer)$"))) @semantic.relationship.factory.method

; 建造者模式
(class_declaration
  name: (identifier) @builder.class
  (annotation
    name: (identifier) @builder.annotation
    (#match? @builder.annotation "Builder$"))) @semantic.relationship.builder.pattern

; 策略模式
(interface_declaration
  name: (identifier) @strategy.interface
  (annotation
    name: (identifier) @strategy.annotation
    (#match? @strategy.annotation "Strategy$"))) @semantic.relationship.strategy.interface

; 模板方法模式
(class_declaration
  name: (identifier) @template.class
  (annotation
    name: (identifier) @template.annotation
    (#match? @template.annotation "Template$"))) @semantic.relationship.template.pattern
`;
```

### 4. 生命周期关系查询规则

#### 4.1 JavaScript生命周期关系查询规则

**新文件**: `src/service/parser/constants/queries/javascript/lifecycle-relationships.ts`

```typescript
/*
JavaScript Lifecycle Relationships-specific Tree-Sitter Query Patterns
用于识别对象实例化、初始化、销毁、生命周期管理等关系
*/
export default `
; 对象实例化关系
(new_expression
  constructor: (identifier) @instantiated.class
  arguments: (argument_list
    (identifier) @constructor.parameter)) @lifecycle.relationship.instantiation

; 类实例化关系
(new_expression
  constructor: (member_expression
    object: (identifier) @module.object
    property: (identifier) @instantiated.class)
  arguments: (argument_list
    (identifier) @constructor.parameter)) @lifecycle.relationship.class.instantiation

; 构造函数调用关系
(call_expression
  function: (member_expression
    object: (this) @constructor.this
    property: (property_identifier) @constructor.method
    (#match? @constructor.method "constructor$"))) @lifecycle.relationship.constructor.call

; 原型方法初始化
(assignment_expression
  left: (member_expression
    object: (member_expression
      object: (identifier) @class.object
      property: (property_identifier) @prototype.property)
    property: (property_identifier) @init.method)
  right: (function_expression)) @lifecycle.relationship.prototype.initialization

; 对象初始化方法
(call_expression
  function: (member_expression
    object: (identifier) @initialized.object
    property: (property_identifier) @init.method
    (#match? @init.method "^(init|initialize|setup|configure)$"))
  arguments: (argument_list
    (identifier) @init.parameter)) @lifecycle.relationship.object.initialization

; React组件生命周期
(method_definition
  name: (property_identifier) @lifecycle.method
  (#match? @lifecycle.method "^(componentDidMount|componentDidUpdate|componentWillUnmount|useEffect|useLayoutEffect)$")) @lifecycle.relationship.react.lifecycle

; 销毁关系
(call_expression
  function: (member_expression
    object: (identifier) @destroyed.object
    property: (property_identifier) @destroy.method
    (#match? @destroy.method "^(destroy|dispose|cleanup|teardown|close)$"))) @lifecycle.relationship.destruction

; 事件监听器添加（生命周期管理）
(call_expression
  function: (member_expression
    object: (identifier) @event.target
    property: (property_identifier) @add.listener.method
    (#match? @add.listener.method "^(addEventListener|addListener|on)$"))
  arguments: (argument_list
    (string) @event.name
    (identifier) @handler.function)) @lifecycle.relationship.listener.addition

; 事件监听器移除（生命周期管理）
(call_expression
  function: (member_expression
    object: (identifier) @event.target
    property: (property_identifier) @remove.listener.method
    (#match? @remove.listener.method "^(removeEventListener|removeListener|off)$"))
  arguments: (argument_list
    (string) @event.name
    (identifier) @handler.function)) @lifecycle.relationship.listener.removal

; 定时器创建（生命周期管理）
(call_expression
  function: (identifier) @timer.function
  (#match? @timer.function "^(setTimeout|setInterval)$")
  arguments: (argument_list
    (function_expression) @timer.handler
    (identifier) @timer.delay)) @lifecycle.relationship.timer.creation

; 定时器清除（生命周期管理）
(call_expression
  function: (identifier) @clear.timer.function
  (#match? @clear.timer.function "^(clearTimeout|clearInterval)$")
  arguments: (argument_list
    (identifier) @timer.id)) @lifecycle.relationship.timer.clearance

; Promise创建（异步生命周期）
(call_expression
  function: (identifier) @promise.constructor
  (#match? @promise.constructor "Promise$")
  arguments: (argument_list
    (function_expression) @promise.executor)) @lifecycle.relationship.promise.creation

; 异步资源管理
(call_expression
  function: (member_expression
    object: (identifier) @async.resource
    property: (property_identifier) @async.method
    (#match? @async.method "^(acquire|release|open|close|start|stop)$"))) @lifecycle.relationship.async.resource.management
`;
```

#### 4.2 Python生命周期关系查询规则

**新文件**: `src/service/parser/constants/queries/python/lifecycle-relationships.ts`

```typescript
/*
Python Lifecycle Relationships-specific Tree-Sitter Query Patterns
用于识别对象实例化、初始化、销毁、生命周期管理等关系
*/
export default `
; 对象实例化关系
(call
  function: (identifier) @instantiated.class
  arguments: (argument_list
    (identifier) @constructor.parameter)) @lifecycle.relationship.instantiation

; 构造函数调用关系
(class_definition
  name: (identifier) @constructed.class
  body: (block
    (function_definition
      name: (identifier) @constructor.method
      (#match? @constructor.method "^__init__$")))) @lifecycle.relationship.constructor.definition

; 初始化方法调用
(call
  function: (member_expression
    object: (identifier) @initialized.object
    attribute: (identifier) @init.method
    (#match? @init.method "^(initialize|setup|configure)$"))
  arguments: (argument_list
    (identifier) @init.parameter)) @lifecycle.relationship.object.initialization

; 析构函数定义
(class_definition
  name: (identifier) @destructed.class
  body: (block
    (function_definition
      name: (identifier) @destructor.method
      (#match? @destructor.method "^__del__$")))) @lifecycle.relationship.destructor.definition

; 上下文管理器入口
(class_definition
  name: (identifier) @context.manager.class
  body: (block
    (function_definition
      name: (identifier) @entry.method
      (#match? @entry.method "^__enter__$")))) @lifecycle.relationship.context.entry

; 上下文管理器出口
(class_definition
  name: (identifier) @context.manager.class
  body: (block
    (function_definition
      name: (identifier) @exit.method
      (#match? @exit.method "^__exit__$")))) @lifecycle.relationship.context.exit

; 异步上下文管理器入口
(class_definition
  name: (identifier) @async.context.manager.class
  body: (block
    (function_definition
      name: (identifier) @async.entry.method
      (#match? @async.entry.method "^__aenter__$")))) @lifecycle.relationship.async.context.entry

; 异步上下文管理器出口
(class_definition
  name: (identifier) @async.context.manager.class
  body: (block
    (function_definition
      name: (identifier) @async.exit.method
      (#match? @async.exit.method "^__aexit__$")))) @lifecycle.relationship.async.context.exit

; 迭代器协议入口
(class_definition
  name: (identifier) @iterator.class
  body: (block
    (function_definition
      name: (identifier) @iterator.method
      (#match? @iterator.method "^__iter__$")))) @lifecycle.relationship.iterator.entry

; 迭代器协议出口
(class_definition
  name: (identifier) @iterator.class
  body: (block
    (function_definition
      name: (identifier) @iterator.method
      (#match? @iterator.method "^__next__$")))) @lifecycle.relationship.iterator.exit

; 异步迭代器协议入口
(class_definition
  name: (identifier) @async.iterator.class
  body: (block
    (function_definition
      name: (identifier) @async.iterator.method
      (#match? @async.iterator.method "^__aiter__$")))) @lifecycle.relationship.async.iterator.entry

; 异步迭代器协议出口
(class_definition
  name: (identifier) @async.iterator.class
  body: (block
    (function_definition
      name: (identifier) @async.iterator.method
      (#match? @async.iterator.method "^__anext__$")))) @lifecycle.relationship.async.iterator.exit

; 资源获取方法
(call
  function: (member_expression
    object: (identifier) @resource.object
    attribute: (identifier) @acquire.method
    (#match? @acquire.method "^(acquire|open|start|connect)$"))) @lifecycle.relationship.resource.acquisition

; 资源释放方法
(call
  function: (member_expression
    object: (identifier) @resource.object
    attribute: (identifier) @release.method
    (#match? @release.method "^(release|close|stop|disconnect|cleanup)$"))) @lifecycle.relationship.resource.release

; 生成器创建
(call
  function: (identifier) @generator.function
  arguments: (argument_list
    (function_definition
      name: (identifier) @generator.definition))) @lifecycle.relationship.generator.creation

; 生成器销毁
(call
  function: (member_expression
    object: (identifier) @generator.object
    attribute: (identifier) @generator.method
    (#match? @generator.method "^(close|throw)$"))) @lifecycle.relationship.generator.destruction
`;
```

#### 4.3 Java生命周期关系查询规则

**新文件**: `src/service/parser/constants/queries/java/lifecycle-relationships.ts`

```typescript
/*
Java Lifecycle Relationships-specific Tree-Sitter Query Patterns
用于识别对象实例化、初始化、销毁、生命周期管理等关系
*/
export default `
; 对象实例化关系
(object_creation_expression
  type: (type_identifier) @instantiated.class
  arguments: (argument_list
    (identifier) @constructor.parameter)) @lifecycle.relationship.instantiation

; 构造函数定义
(constructor_declaration
  name: (identifier) @constructor.method
  parameters: (formal_parameters
    (formal_parameter
      name: (identifier) @constructor.parameter))) @lifecycle.relationship.constructor.definition

; 初始化块
(class_declaration
  name: (identifier) @initialized.class
  body: (class_body
    (instance_initializer
      (block) @init.block))) @lifecycle.relationship.initialization.block

; 静态初始化块
(class_declaration
  name: (identifier) @static.initialized.class
  body: (class_body
    (static_initializer
      (block) @static.init.block))) @lifecycle.relationship.static.initialization

; 析构方法（finalize）
(method_declaration
  name: (identifier) @destructor.method
  (#match? @destructor.method "finalize$")
  parameters: (formal_parameters)) @lifecycle.relationship.destructor.definition

; AutoCloseable接口实现
(class_declaration
  name: (identifier) @closeable.class
  super_interfaces: (super_interfaces
    (type_list
      (type_identifier) @auto.closeable.interface
      (#match? @auto.closeable.interface "AutoCloseable$")))) @lifecycle.relationship.auto.closeable

; Close方法实现
(method_declaration
  name: (identifier) @close.method
  (#match? @close.method "close$")
  parameters: (formal_parameters)) @lifecycle.relationship.close.method

; 生命周期注解方法
(method_declaration
  name: (identifier) @lifecycle.method
  (annotation
    name: (identifier) @lifecycle.annotation
    (#match? @lifecycle.annotation "^(PostConstruct|PreDestroy|Initialized|Destroyed)$"))) @lifecycle.relationship.annotated.method

; Spring生命周期注解
(method_declaration
  name: (identifier) @spring.lifecycle.method
  (annotation
    name: (identifier) @spring.annotation
    (#match? @spring.annotation "^(PostConstruct|PreDestroy|Bean|Component)$"))) @lifecycle.relationship.spring.lifecycle

; 事件监听器方法
(method_declaration
  name: (identifier) @event.listener.method
  (annotation
    name: (identifier) @event.annotation
    (#match? @event.annotation "^(EventListener|Subscribe|Handle)$"))) @lifecycle.relationship.event.listener

; 资源获取方法
(method_declaration
  name: (identifier) @acquire.method
  (#match? @acquire.method "^(acquire|open|start|connect|init)$")
  return_type: (type_identifier) @resource.type) @lifecycle.relationship.resource.acquisition

; 资源释放方法
(method_declaration
  name: (identifier) @release.method
  (#match? @release.method "^(release|close|stop|disconnect|cleanup|destroy)$")) @lifecycle.relationship.resource.release

; 线程生命周期
(method_declaration
  name: (identifier) @thread.lifecycle.method
  (#match? @thread.lifecycle.method "^(start|run|stop|interrupt|join)$")) @lifecycle.relationship.thread.lifecycle

; 事务生命周期
(method_declaration
  name: (identifier) @transaction.method
  (annotation
    name: (identifier) @transaction.annotation
    (#match? @transaction.annotation "^(Transactional|Begin|Commit|Rollback)$"))) @lifecycle.relationship.transaction.lifecycle

; 缓存生命周期
(method_declaration
  name: (identifier) @cache.method
  (annotation
    name: (identifier) @cache.annotation
    (#match? @cache.annotation "^(CacheEvict|CachePut|Cacheable)$"))) @lifecycle.relationship.cache.lifecycle
`;
```

### 5. 并发关系查询规则

#### 5.1 JavaScript并发关系查询规则

**新文件**: `src/service/parser/constants/queries/javascript/concurrency-relationships.ts`

```typescript
/*
JavaScript Concurrency Relationships-specific Tree-Sitter Query Patterns
用于识别同步、锁、通信、竞态条件等并发关系
*/
export default `
; Promise创建（异步并发）
(call_expression
  function: (identifier) @promise.constructor
  (#match? @promise.constructor "Promise$")
  arguments: (argument_list
    (function_expression) @promise.executor)) @concurrency.relationship.promise.creation

; Promise链式调用（异步并发）
(call_expression
  function: (member_expression
    object: (call_expression) @source.promise
    property: (property_identifier) @promise.method
    (#match? @promise.method "^(then|catch|finally)$"))
  arguments: (argument_list
    (function_expression) @handler.function)) @concurrency.relationship.promise.chain

; Async函数定义
(async_function_declaration
  name: (identifier) @async.function) @concurrency.relationship.async.function

; Async函数调用
(call_expression
  function: (identifier) @async.function
  arguments: (argument_list
    (identifier) @async.parameter)) @concurrency.relationship.async.call

; Await表达式
(await_expression
  (call_expression) @awaited.call) @concurrency.relationship.await.expression

; 并行Promise执行
(call_expression
  function: (member_expression
    object: (identifier) @promise.object
    property: (property_identifier) @parallel.method
    (#match? @parallel.method "^(all|allSettled|race)$"))
  arguments: (argument_list
    (array
      (identifier) @parallel.promise))) @concurrency.relationship.parallel.execution

; Worker创建
(new_expression
  constructor: (identifier) @worker.constructor
  (#match? @worker.constructor "Worker$")
  arguments: (argument_list
    (string) @worker.script)) @concurrency.relationship.worker.creation

; Worker消息发送
(call_expression
  function: (member_expression
    object: (identifier) @worker.object
    property: (property_identifier) @worker.method
    (#match? @worker.method "^(postMessage|send)$"))
  arguments: (argument_list
    (identifier) @worker.message)) @concurrency.relationship.worker.communication

; Worker消息接收
(assignment_expression
  left: (identifier) @message.handler
  right: (member_expression
    object: (identifier) @worker.object
    property: (property_identifier) @worker.event
    (#match? @worker.event "onmessage$"))) @concurrency.relationship.worker.message.reception

; 共享数组缓冲区
(new_expression
  constructor: (identifier) @shared.array.constructor
  (#match? @shared.array.constructor "SharedArrayBuffer$")
  arguments: (argument_list
    (identifier) @buffer.size)) @concurrency.relationship.shared.array

; Atomics操作
(call_expression
  function: (member_expression
    object: (identifier) @atomics.object
    property: (property_identifier) @atomics.method
    (#match? @atomics.method "^(add|sub|and|or|xor|load|store|compareExchange)$"))
  arguments: (argument_list
    (identifier) @atomics.target
    (identifier) @atomics.value)) @concurrency.relationship.atomics.operation

; 锁机制模拟
(call_expression
  function: (member_expression
    object: (identifier) @lock.object
    property: (property_identifier) @lock.method
    (#match? @lock.method "^(acquire|release|tryAcquire)$"))) @concurrency.relationship.lock.operation

; 条件变量模拟
(call_expression
  function: (member_expression
    object: (identifier) @condition.variable
    property: (property_identifier) @condition.method
    (#match? @condition.method "^(wait|signal|signalAll)$"))) @concurrency.relationship.condition.variable

; 信号量模拟
(call_expression
  function: (member_expression
    object: (identifier) @semaphore.object
    property: (property_identifier) @semaphore.method
    (#match? @semaphore.method "^(acquire|release|availablePermits)$"))) @concurrency.relationship.semaphore.operation

; 竞态条件检测
(assignment_expression
  left: (member_expression
    object: (identifier) @shared.variable
    property: (property_identifier) @shared.property)
  right: (binary_expression
    left: (member_expression
      object: (identifier) @shared.variable
      property: (property_identifier) @shared.property)
    operator: (identifier) @operator
    right: (identifier) @increment.value))) @concurrency.relationship.race.condition
`;
```

## 查询规则集成方案

### 1. 查询规则文件组织结构

```
src/service/parser/constants/queries/
├── javascript/
│   ├── data-flow.ts                    # 新增
│   ├── semantic-relationships.ts       # 新增
│   ├── lifecycle-relationships.ts      # 新增
│   ├── concurrency-relationships.ts    # 新增
│   └── ...
├── python/
│   ├── data-flow.ts                    # 新增
│   ├── semantic-relationships.ts       # 新增
│   ├── lifecycle-relationships.ts      # 新增
│   ├── concurrency-relationships.ts    # 新增
│   └── ...
├── java/
│   ├── data-flow.ts                    # 新增
│   ├── semantic-relationships.ts       # 新增
│   ├── lifecycle-relationships.ts      # 新增
│   ├── concurrency-relationships.ts    # 新增
│   └── ...
└── ...
```

### 2. 查询规则索引文件更新

需要更新各语言的主查询文件，添加新的查询类型：

#### JavaScript主查询文件更新

**文件**: `src/service/parser/constants/queries/javascript/index.ts`

```typescript
// 在现有导入基础上添加
import dataFlowQueries from './data-flow';
import semanticRelationshipsQueries from './semantic-relationships';
import lifecycleRelationshipsQueries from './lifecycle-relationships';
import concurrencyRelationshipsQueries from './concurrency-relationships';

// 在现有查询映射中添加
export const javascriptQueries = {
  // 现有查询...
  'data-flow': dataFlowQueries,
  'semantic-relationships': semanticRelationshipsQueries,
  'lifecycle-relationships': lifecycleRelationshipsQueries,
  'concurrency-relationships': concurrencyRelationshipsQueries,
};
```

### 3. 查询规则执行器扩展

需要扩展查询规则执行器以支持新的关系类型：

**新文件**: `src/service/parser/core/query/AdvancedRelationshipQueryExecutor.ts`

```typescript
/**
 * 高级关系查询执行器
 * 专门处理数据流、控制流、语义关系、生命周期和并发关系的查询
 */
export class AdvancedRelationshipQueryExecutor {
  constructor(
    private treeSitterService: TreeSitterService,
    private logger: LoggerService
  ) {}

  async executeDataFlowQueries(
    ast: Parser.SyntaxNode,
    language: string
  ): Promise<QueryResult[]> {
    const queryType = `${language}-data-flow`;
    return this.executeQuery(ast, queryType, 'data-flow');
  }

  async executeSemanticRelationshipQueries(
    ast: Parser.SyntaxNode,
    language: string
  ): Promise<QueryResult[]> {
    const queryType = `${language}-semantic-relationships`;
    return this.executeQuery(ast, queryType, 'semantic-relationships');
  }

  private async executeQuery(
    ast: Parser.SyntaxNode,
    queryType: string,
    category: string
  ): Promise<QueryResult[]> {
    try {
      const query = this.getQuery(queryType);
      if (!query) {
        this.logger.warn(`Query not found: ${queryType}`);
        return [];
      }

      const results = this.treeSitterService.queryTree(ast, query);
      return this.processQueryResults(results, category);
    } catch (error) {
      this.logger.error(`Failed to execute query ${queryType}:`, error);
      return [];
    }
  }

  private getQuery(queryType: string): string | null {
    // 从查询注册表中获取查询字符串
    return QueryRegistry.getQuery(queryType);
  }

  private processQueryResults(
    results: any[],
    category: string
  ): QueryResult[] {
    return results.map(result => ({
      captures: result.captures,
      category,
      metadata: {
        timestamp: new Date().toISOString(),
        relationshipType: this.extractRelationshipType(result)
      }
    }));
  }

  private extractRelationshipType(result: any): string {
    // 从查询结果中提取关系类型
    const relationshipCaptures = result.captures?.filter((capture: any) =>
      capture.name.includes('relationship')
    );
    return relationshipCaptures?.[0]?.name || 'unknown';
  }
}
```

## 实施优先级和时间安排

### 第一阶段（高优先级）
1. **数据流查询规则** - 所有语言的基础数据流分析
2. **控制流查询规则扩展** - 基于现有控制流规则增强关系提取
3. **查询规则执行器** - 实现高级关系查询执行框架

### 第二阶段（中优先级）
1. **语义关系查询规则** - 重点关注方法重写和观察者模式
2. **生命周期关系查询规则** - 重点关注实例化和初始化关系
3. **JavaScript异步模式查询规则** - Promise/async-await关系分析

### 第三阶段（低优先级）
1. **并发关系查询规则** - 复杂的并发模式分析
2. **设计模式查询规则** - 高级语义关系识别
3. **跨语言关系查询规则** - 多语言项目中的关系分析

## 总结

通过系统性地扩展Tree-sitter查询规则，可以实现对高级图映射规则的完整支持。新的查询规则将能够：

1. **精确识别数据流关系** - 追踪变量间的数据传递路径
2. **深入分析控制流关系** - 识别条件、循环、异常处理等控制流模式
3. **智能发现语义关系** - 识别设计模式和代码结构关系
4. **全面追踪生命周期关系** - 监控对象的创建、使用和销毁过程
5. **有效检测并发关系** - 识别同步、锁、通信等并发模式

这些扩展的查询规则将为代码索引和搜索系统提供更丰富、更精确的关系信息，从而显著提升代码分析和理解的能力。