/*
C Semantic Relationships-specific Tree-Sitter Query Patterns
用于识别和分析代码中的高级语义关系
*/
export default `
; 函数调用关系
(call_expression
  function: (identifier) @target.function
  arguments: (argument_list
    (identifier)* @source.parameter)) @semantic.relationship.function.call

; 函数指针调用关系
(call_expression
  function: (pointer_expression
    argument: (identifier) @source.function.pointer)
  arguments: (argument_list
    (identifier)* @source.parameter)) @semantic.relationship.function.pointer.call

; 递归函数调用关系
(call_expression
  function: (identifier) @target.recursive.function
  arguments: (argument_list)) @semantic.relationship.recursive.call

; 回调函数模式
(assignment_expression
  left: (identifier) @callback.variable
  right: (identifier) @callback.function) @semantic.relationship.callback.pattern

; 函数指针赋值
(assignment_expression
  left: (identifier) @target.function.pointer
  right: (identifier) @source.function) @semantic.relationship.function.pointer.assignment

; 函数指针数组
(init_declarator
  declarator: (array_declarator
    declarator: (pointer_declarator
      declarator: (identifier) @function.pointer.array))
  value: (initializer_list
    (identifier)* @function.pointers)) @semantic.relationship.function.pointer.array

; 结构体定义关系
(struct_specifier
  name: (type_identifier) @target.struct
  body: (field_declaration_list
    (field_declaration
      type: (type_identifier) @source.field.type
      declarator: (field_identifier) @field.name))) @semantic.relationship.struct.definition

; 结构体嵌套关系
(struct_specifier
  name: (type_identifier) @target.struct
  body: (field_declaration_list
    (field_declaration
      type: (struct_specifier
        name: (type_identifier) @source.nested.struct)
      declarator: (field_identifier) @field.name))) @semantic.relationship.struct.nesting

; 结构体指针关系
(field_declaration
  type: (pointer_type
    (type_identifier) @source.pointed.type)
  declarator: (field_identifier) @pointer.field) @semantic.relationship.struct.pointer.field

; 联合体定义关系
(union_specifier
  name: (type_identifier) @target.union
  body: (field_declaration_list
    (field_declaration
      type: (type_identifier) @source.field.type
      declarator: (field_identifier) @field.name))) @semantic.relationship.union.definition

; 枚举定义关系
(enum_specifier
  name: (type_identifier) @target.enum
  body: (enumerator_list
    (enumerator
      name: (identifier) @enum.constant))) @semantic.relationship.enum.definition

; 类型别名关系
(type_definition
  type: (type_identifier) @source.original.type
  declarator: (type_identifier) @target.alias.type) @semantic.relationship.type.alias

; 函数指针类型关系
(type_definition
  type: (pointer_type
    (function_type
      parameters: (parameter_list
        (parameter_declaration
          type: (type_identifier) @param.type
          declarator: (identifier) @param.name))))
  declarator: (type_identifier) @target.function.pointer.type) @semantic.relationship.function.pointer.type

; 单例模式（全局变量）
(declaration
  type: (type_identifier) @singleton.type
  declarator: (init_declarator
    declarator: (identifier) @singleton.instance
    value: (call_expression
      function: (identifier) @singleton.constructor))) @semantic.relationship.singleton.pattern

; 工厂模式
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @factory.function
    parameters: (parameter_list
      (parameter_declaration
        type: (type_identifier) @factory.parameter.type
        declarator: (identifier) @factory.parameter.name)))
  body: (compound_statement
    (return_statement
      (call_expression
        function: (identifier) @created.constructor)))) @semantic.relationship.factory.pattern

; 观察者模式（回调注册）
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @observer.register.function)
  parameters: (parameter_list
    (parameter_declaration
      type: (pointer_type
        (function_type))
      declarator: (identifier) @observer.callback.parameter))) @semantic.relationship.observer.pattern

; 策略模式（函数指针参数）
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @strategy.context.function)
  parameters: (parameter_list
    (parameter_declaration
      type: (pointer_type
        (function_type))
      declarator: (identifier) @strategy.function.parameter))) @semantic.relationship.strategy.pattern

; 状态模式（状态机）
(struct_specifier
  name: (type_identifier) @state.machine.struct
  body: (field_declaration_list
    (field_declaration
      type: (pointer_type
        (function_type))
      declarator: (field_identifier) @state.method)
    (field_declaration
      type: (pointer_type
        (type_identifier) @current.state.type)
      declarator: (field_identifier) @current.state.field))) @semantic.relationship.state.pattern

; 头文件包含关系
(preproc_include
  path: (string_literal
    (string_content) @included.header)) @semantic.relationship.include.dependency

; 宏定义关系
(preproc_def
  name: (identifier) @macro.name
  value: (identifier)? @macro.value) @semantic.relationship.macro.definition

; 宏使用关系
(call_expression
  function: (identifier) @macro.usage
  arguments: (argument_list)) @semantic.relationship.macro.usage

; 条件编译关系
(preproc_if
  condition: (identifier) @conditional.symbol) @semantic.relationship.conditional.compilation

; 全局变量定义
(declaration
  type: (type_identifier) @global.variable.type
  declarator: (init_declarator
    declarator: (identifier) @global.variable.name)) @semantic.relationship.global.variable

; 外部变量声明
(declaration
  storage_class_specifier: (storage_class_specifier) @extern.specifier
  type: (type_identifier) @extern.variable.type
  declarator: (identifier) @extern.variable.name) @semantic.relationship.extern.variable

; 内存分配模式
(call_expression
  function: (identifier) @allocation.function
  (#match? @allocation.function "^(malloc|calloc|realloc|alloca)$")
  arguments: (argument_list
    (identifier) @allocation.size)) @semantic.relationship.memory.allocation

; 内存释放模式
(call_expression
  function: (identifier) @deallocation.function
  (#match? @deallocation.function "^(free)$")
  arguments: (argument_list
    (identifier) @deallocated.pointer)) @semantic.relationship.memory.deallocation

; 内存复制模式
(call_expression
  function: (identifier) @memory.function
  (#match? @memory.function "^(memcpy|memmove|memset)$")
  arguments: (argument_list
    (identifier) @destination.pointer
    (identifier) @source.pointer)) @semantic.relationship.memory.operation

; 资源获取即初始化(RAII-like模式)
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @resource.constructor)
  body: (compound_statement
    (declaration
      type: (type_identifier) @resource.type
      declarator: (init_declarator
        declarator: (identifier) @resource.variable
        value: (call_expression
          function: (identifier) @resource.allocation.function))))) @semantic.relationship.resource.initialization

; 错误码返回模式
(return_statement
  (identifier) @error.code
  (#match? @error.code "^(ERROR|FAIL|INVALID|NULL)$")) @semantic.relationship.error.code.return

; 错误检查模式
(if_statement
  condition: (binary_expression
    left: (identifier) @checked.variable
    operator: "=="
    right: (identifier) @error.value)
  consequence: (statement) @error.handling.block) @semantic.relationship.error.checking

; 错误传播模式
(return_statement
  (identifier) @propagated.error) @semantic.relationship.error.propagation

; 清理函数模式
(function_definition
  declarator: (function_declarator
    declarator: (identifier) @cleanup.function
    parameters: (parameter_list
      (parameter_declaration
        type: (pointer_type)
        declarator: (identifier) @resource.parameter)))) @semantic.relationship.cleanup.pattern
`;