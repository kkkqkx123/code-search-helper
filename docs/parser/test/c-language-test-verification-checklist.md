# C语言查询规则与适配器测试验证清单

## 概述

本文档提供C语言查询规则与语言适配器协调关系的全面测试验证清单，确保所有关键功能点都得到充分测试。

## 1. 查询规则验证清单

### 1.1 函数查询规则 (functions.ts)

- [ ] **基本函数定义查询**
  - [ ] 简单函数定义：`int add(int a, int b) { return a + b; }`
  - [ ] 无返回值函数：`void print(const char* msg) { printf("%s\n", msg); }`
  - [ ] 带指针参数函数：`void process(int* data) { *data = 42; }`
  - [ ] 带数组参数函数：`void sort(int arr[], int size) { /* ... */ }`

- [ ] **函数原型查询**
  - [ ] 简单函数原型：`int calculate(int x, int y);`
  - [ ] 带指针参数原型：`void initialize(int* ptr);`
  - [ ] 带可变参数原型：`int printf(const char* format, ...);`

- [ ] **函数调用查询**
  - [ ] 简单函数调用：`result = calculate(x, y);`
  - [ ] 嵌套函数调用：`result = calculate(add(a, b), multiply(c, d));`
  - [ ] 函数指针调用：`operation(x, y);`
  - [ ] 结构体方法调用：`obj.method(param);`

- [ ] **函数指针查询**
  - [ ] 函数指针声明：`int (*operation)(int, int);`
  - [ ] 函数指针数组：`int (*operations[])(int, int);`
  - [ ] 作为结构体字段：`struct { int (*callback)(int); } handler;`

- [ ] **递归函数查询**
  - [ ] 直接递归：`int factorial(int n) { return n <= 1 ? 1 : n * factorial(n - 1); }`
  - [ ] 间接递归：函数A调用函数B，函数B调用函数A

- [ ] **内联函数查询**
  - [ ] 内联函数定义：`inline int max(int a, int b) { return a > b ? a : b; }`
  - [ ] 静态内联函数：`static inline int square(int x) { return x * x; }`

### 1.2 结构体查询规则 (structs.ts)

- [ ] **基本结构体定义**
  - [ ] 简单结构体：`struct Point { int x; int y; };`
  - [ ] 带指针字段：`struct Node { int data; struct Node* next; };`
  - [ ] 带数组字段：`struct Buffer { char data[1024]; int size; };`

- [ ] **联合体定义**
  - [ ] 简单联合体：`union Value { int i; float f; char* s; };`
  - [ ] 嵌套联合体：`struct { union { int i; float f; } value; } container;`

- [ ] **枚举定义**
  - [ ] 简单枚举：`enum Color { RED, GREEN, BLUE };`
  - [ ] 指定值枚举：`enum Status { OK = 0, ERROR = -1, PENDING = 1 };`

- [ ] **类型别名**
  - [ ] 简单类型别名：`typedef unsigned int uint32_t;`
  - [ ] 结构体类型别名：`typedef struct Point Point;`
  - [ ] 函数指针类型别名：`typedef int (*Operation)(int, int);`

- [ ] **复杂声明**
  - [ ] 数组声明：`int numbers[10];`
  - [ ] 指针声明：`int* pointer;`
  - [ ] 函数指针声明：`int (*func_ptr)(int);`
  - [ ] 指针数组：`int* ptr_array[10];`
  - [ ] 数组指针：`int (*array_ptr)[10];`

- [ ] **成员访问**
  - [ ] 直接成员访问：`point.x`
  - [ ] 指针成员访问：`ptr->x`
  - [ ] 嵌套成员访问：`obj.inner.field`

- [ ] **嵌套结构体**
  - [ ] 结构体嵌套：`struct Rectangle { struct Point top_left; struct Point bottom_right; };`
  - [ ] 匿名结构体：`struct { int x; int y; } point;`

- [ ] **位域**
  - [ ] 简单位域：`struct Flags { unsigned int a : 1; unsigned int b : 2; };`
  - [ ] 命名位域：`struct { unsigned int flag1 : 1; unsigned int flag2 : 1; } flags;`

### 1.3 变量查询规则 (variables.ts)

- [ ] **基本变量声明**
  - [ ] 简单变量：`int x;`
  - [ ] 带初始化：`int y = 10;`
  - [ ] 常量变量：`const int MAX_SIZE = 100;`

- [ ] **指针变量**
  - [ ] 指针声明：`int* ptr;`
  - [ ] 指针初始化：`int* ptr = &variable;`
  - [ ] 空指针：`int* ptr = NULL;`

- [ ] **数组变量**
  - [ ] 数组声明：`int arr[10];`
  - [ ] 数组初始化：`int arr[] = {1, 2, 3, 4, 5};`
  - [ ] 多维数组：`int matrix[3][3];`

- [ ] **存储类说明符**
  - [ ] 静态变量：`static int counter = 0;`
  - [ ] 外部变量：`extern int global_var;`
  - [ ] 寄存器变量：`register int fast_var;`

### 1.4 预处理器查询规则 (preprocessor.ts)

- [ ] **文件包含**
  - [ ] 系统头文件：`#include <stdio.h>`
  - [ ] 本地头文件：`#include "myheader.h"`
  - [ ] 嵌套包含：`#include <sys/types.h>`

- [ ] **宏定义**
  - [ ] 简单宏：`#define PI 3.14159`
  - [ ] 带参数宏：`#define MAX(a, b) ((a) > (b) ? (a) : (b))`
  - [ ] 多行宏：`#define COMPLEX_MACRO(x, y) do { /* ... */ } while(0)`

- [ ] **条件编译**
  - [ ] #if指令：`#if defined(DEBUG)`
  - [ ] #ifdef指令：`#ifdef WINDOWS`
  - [ ] #ifndef指令：`#ifndef UNIT_TEST`
  - [ ] #else指令：`#else`
  - [ ] #elif指令：`#elif defined(LINUX)`
  - [ ] #endif指令：`#endif`

### 1.5 控制流查询规则 (control-flow.ts)

- [ ] **条件语句**
  - [ ] 简单if语句：`if (condition) { /* ... */ }`
  - [ ] if-else语句：`if (condition) { /* ... */ } else { /* ... */ }`
  - [ ] if-else if-else语句：`if (cond1) { /* ... */ } else if (cond2) { /* ... */ } else { /* ... */ }`
  - [ ] 嵌套if语句：`if (outer) { if (inner) { /* ... */ } }`

- [ ] **循环语句**
  - [ ] for循环：`for (int i = 0; i < 10; i++) { /* ... */ }`
  - [ ] while循环：`while (condition) { /* ... */ }`
  - [ ] do-while循环：`do { /* ... */ } while (condition);`
  - [ ] 无限循环：`while (1) { /* ... */ }`

- [ ] **跳转语句**
  - [ ] break语句：`break;`
  - [ ] continue语句：`continue;`
  - [ ] return语句：`return value;`
  - [ ] goto语句：`goto label;`
  - [ ] 标签语句：`label: /* ... */`

- [ ] **switch语句**
  - [ ] 简单switch：`switch (value) { case 1: /* ... */ break; }`
  - [ ] 带default的switch：`switch (value) { case 1: /* ... */ break; default: /* ... */ }`
  - [ ] 多个case：`switch (value) { case 1: case 2: /* ... */ break; }`

### 1.6 数据流查询规则 (data-flow.ts)

- [ ] **赋值数据流**
  - [ ] 简单赋值：`x = y;`
  - [ ] 复合赋值：`x += y;`, `x -= y;`, `x *= y;`, `x /= y;`
  - [ ] 增量减量：`x++`, `x--`, `++x`, `--x`

- [ ] **指针数据流**
  - [ ] 地址赋值：`ptr = &variable;`
  - [ ] 指针赋值：`ptr1 = ptr2;`
  - [ ] 解引用赋值：`*ptr = value;`

- [ ] **函数调用数据流**
  - [ ] 参数传递：`function(param1, param2);`
  - [ ] 返回值赋值：`result = function();`
  - [ ] 嵌套调用：`result = func1(func2(param));`

- [ ] **数组数据流**
  - [ ] 数组元素赋值：`arr[i] = value;`
  - [ ] 数组初始化：`int arr[] = {1, 2, 3};`
  - [ ] 多维数组访问：`matrix[i][j] = value;`

- [ ] **结构体数据流**
  - [ ] 结构体赋值：`struct1 = struct2;`
  - [ ] 成员赋值：`obj.field = value;`
  - [ ] 指针成员赋值：`ptr->field = value;`

- [ ] **类型转换数据流**
  - [ ] 显式类型转换：`int x = (int)float_value;`
  - [ ] 隐式类型转换：`float f = 10;`

### 1.7 控制流关系查询规则 (control-flow-relationships.ts)

- [ ] **条件控制流**
  - [ ] if语句控制流：条件到执行块的控制流
  - [ ] if-else控制流：条件到两个分支的控制流
  - [ ] 嵌套条件控制流：多层嵌套if语句的控制流

- [ ] **循环控制流**
  - [ ] for循环控制流：初始化、条件、更新到循环体的控制流
  - [ ] while循环控制流：条件到循环体的控制流
  - [ ] do-while控制流：循环体到条件的控制流
  - [ ] 嵌套循环控制流：外层循环到内层循环的控制流

- [ ] **跳转控制流**
  - [ ] break控制流：break到循环外部的控制流
  - [ ] continue控制流：continue到循环条件控制流
  - [ ] return控制流：return到函数出口的控制流
  - [ ] goto控制流：goto到标签的控制流

- [ ] **switch控制流**
  - [ ] switch到case的控制流
  - [ ] case到执行块的控制流
  - [ ] default到执行块的控制流

### 1.8 语义关系查询规则 (semantic-relationships.ts)

- [ ] **函数调用关系**
  - [ ] 普通函数调用关系
  - [ ] 递归函数调用关系
  - [ ] 函数指针调用关系

- [ ] **回调模式**
  - [ ] 回调函数赋值：`callback = handler;`
  - [ ] 回调函数字段：`struct { void (*callback)(int); }`
  - [ ] 回调函数调用：`callback(param);`

- [ ] **结构体关系**
  - [ ] 结构体定义关系
  - [ ] 嵌套结构体关系
  - [ ] 结构体指针关系

- [ ] **设计模式**
  - [ ] 单例模式识别
  - [ ] 工厂模式识别
  - [ ] 观察者模式识别
  - [ ] 策略模式识别

- [ ] **错误处理模式**
  - [ ] 错误码返回模式
  - [ ] 错误检查模式
  - [ ] 资源清理模式

- [ ] **资源管理模式**
  - [ ] 内存分配释放模式
  - [ ] 文件打开关闭模式
  - [ ] 资源初始化清理模式

### 1.9 生命周期关系查询规则 (lifecycle-relationships.ts)

- [ ] **对象生命周期**
  - [ ] 对象创建：`malloc`, `calloc`, `new`
  - [ ] 对象初始化：构造函数模式
  - [ ] 对象销毁：`free`, `delete`
  - [ ] 对象清理：清理函数模式

- [ ] **资源生命周期**
  - [ ] 文件资源生命周期：`fopen`, `fclose`
  - [ ] 网络资源生命周期：`socket`, `close`
  - [ ] 锁资源生命周期：`lock`, `unlock`

### 1.10 并发关系查询规则 (concurrency-relationships.ts)

- [ ] **线程同步**
  - [ ] 互斥锁：`pthread_mutex_lock`, `pthread_mutex_unlock`
  - [ ] 读写锁：`pthread_rwlock_rdlock`, `pthread_rwlock_wrlock`
  - [ ] 条件变量：`pthread_cond_wait`, `pthread_cond_signal`

- [ ] **线程通信**
  - [ ] 线程创建：`pthread_create`
  - [ ] 线程等待：`pthread_join`
  - [ ] 信号量：`sem_wait`, `sem_post`

## 2. 适配器验证清单

### 2.1 查询类型映射验证

- [ ] **基本查询类型映射**
  - [ ] `functions` → `function`
  - [ ] `structs` → `class`
  - [ ] `variables` → `variable`
  - [ ] `preprocessor` → `expression`
  - [ ] `control-flow` → `control-flow`
  - [ ] `calls` → `call`
  - [ ] `data-flows` → `data-flow`
  - [ ] `inheritance` → `inheritance`

- [ ] **高级关系类型映射**
  - [ ] `concurrency-relationships` → `concurrency`
  - [ ] `control-flow-relationships` → `control-flow`
  - [ ] `lifecycle-relationships` → `lifecycle`
  - [ ] `semantic-relationships` → `semantic`

### 2.2 节点类型映射验证

- [ ] **函数相关节点**
  - [ ] `function_definition` → `function`
  - [ ] `function_declarator` → `function`
  - [ ] `parameter_declaration` → `parameter`
  - [ ] `call_expression` → `call`

- [ ] **结构体相关节点**
  - [ ] `struct_specifier` → `struct`
  - [ ] `union_specifier` → `union`
  - [ ] `enum_specifier` → `enum`
  - [ ] `type_definition` → `type`
  - [ ] `field_declaration` → `field`

- [ ] **变量相关节点**
  - [ ] `declaration` → `variable`
  - [ ] `init_declarator` → `variable`
  - [ ] `assignment_expression` → `assignment`

- [ ] **控制流相关节点**
  - [ ] `if_statement` → `control_statement`
  - [ ] `for_statement` → `control_statement`
  - [ ] `while_statement` → `control_statement`
  - [ ] `switch_statement` → `control_statement`

### 2.3 名称提取验证

- [ ] **捕获名称匹配**
  - [ ] `function.name` 捕获
  - [ ] `type.name` 捕获
  - [ ] `field.name` 捕获
  - [ ] `variable.name` 捕获
  - [ ] `call.function` 捕获

- [ ] **回退机制验证**
  - [ ] 从主节点的name字段提取
  - [ ] 从identifier字段提取
  - [ ] 从type_identifier字段提取
  - [ ] 从field_identifier字段提取
  - [ ] 默认返回'unnamed'

### 2.4 元数据提取验证

- [ ] **函数元数据**
  - [ ] 参数数量提取
  - [ ] 返回类型提取
  - [ ] 存储类说明符提取
  - [ ] 类型限定符提取

- [ ] **结构体元数据**
  - [ ] 字段数量提取
  - [ ] 嵌套结构体识别
  - [ ] 位域信息提取

- [ ] **变量元数据**
  - [ ] 初始化值提取
  - [ ] 数组大小提取
  - [ ] 指针层级提取

### 2.5 依赖提取验证

- [ ] **函数调用依赖**
  - [ ] 识别函数调用
  - [ ] 提取函数名称
  - [ ] 处理嵌套调用

- [ ] **类型引用依赖**
  - [ ] 识别类型引用
  - [ ] 提取类型名称
  - [ ] 处理复杂类型

### 2.6 修饰符提取验证

- [ ] **存储类修饰符**
  - [ ] `static` 修饰符
  - [ ] `extern` 修饰符
  - [ ] `register` 修饰符
  - [ ] `auto` 修饰符

- [ ] **类型限定符**
  - [ ] `const` 修饰符
  - [ ] `volatile` 修饰符
  - [ ] `restrict` 修饰符
  - [ ] `_Atomic` 修饰符

- [ ] **函数修饰符**
  - [ ] `inline` 修饰符
  - [ ] `_Noreturn` 修饰符

### 2.7 复杂度计算验证

- [ ] **基础复杂度**
  - [ ] 函数复杂度计算
  - [ ] 结构体复杂度计算
  - [ ] 控制流复杂度计算

- [ ] **C语言特定复杂度**
  - [ ] 指针复杂度
  - [ ] 静态变量复杂度
  - [ ] 外部变量复杂度
  - [ ] 成员访问复杂度
  - [ ] 内存管理复杂度
  - [ ] 多线程复杂度
  - [ ] 信号处理复杂度

## 3. 关系提取器验证清单

### 3.1 数据流关系提取器验证

- [ ] **节点类型识别**
  - [ ] `assignment_expression` 识别
  - [ ] `parameter_declaration` 识别
  - [ ] `return_statement` 识别
  - [ ] `field_expression` 识别
  - [ ] `init_declarator` 识别

- [ ] **数据流类型确定**
  - [ ] `variable_assignment` 类型
  - [ ] `parameter_passing` 类型
  - [ ] `return_value` 类型
  - [ ] `field_access` 类型

- [ ] **元数据提取**
  - [ ] 数据类型提取
  - [ ] 数据流路径构建
  - [ ] 位置信息提取

### 3.2 控制流关系提取器验证

- [ ] **节点类型识别**
  - [ ] `if_statement` 识别
  - [ ] `for_statement` 识别
  - [ ] `while_statement` 识别
  - [ ] `switch_statement` 识别
  - [ ] `break_statement` 识别
  - [ ] `continue_statement` 识别
  - [ ] `goto_statement` 识别
  - [ ] `return_statement` 识别

- [ ] **控制流类型确定**
  - [ ] `conditional` 类型
  - [ ] `loop` 类型
  - [ ] `switch` 类型
  - [ ] `jump` 类型

- [ ] **目标节点提取**
  - [ ] 条件目标节点提取
  - [ ] 循环目标节点提取
  - [ ] switch目标节点提取
  - [ ] 跳转目标节点提取

### 3.3 语义关系提取器验证

- [ ] **语义模式识别**
  - [ ] 单例模式识别
  - [ ] 工厂模式识别
  - [ ] 观察者模式识别
  - [ ] 策略模式识别
  - [ ] 错误处理模式识别
  - [ ] 资源管理模式识别
  - [ ] 回调模式识别
  - [ ] 状态机模式识别

- [ ] **置信度计算**
  - [ ] 基于关键词的置信度计算
  - [ ] 基于模式的置信度计算
  - [ ] 置信度上限控制

- [ ] **描述生成**
  - [ ] 模式描述生成
  - [ ] 关系描述生成

### 3.4 调用关系提取器验证

- [ ] **调用上下文分析**
  - [ ] 调用者函数上下文查找
  - [ ] 调用名称提取
  - [ ] 调用类型确定
  - [ ] 调用链分析

- [ ] **调用关系元数据**
  - [ ] 调用名称提取
  - [ ] 调用类型确定
  - [ ] 调用上下文分析
  - [ ] 位置信息提取

## 4. 集成测试验证清单

### 4.1 端到端流程验证

- [ ] **完整解析流程**
  - [ ] 代码解析 → 查询执行 → 结果标准化 → 关系提取
  - [ ] 多种查询类型协调执行
  - [ ] 结果聚合和去重

- [ ] **复杂代码场景**
  - [ ] 大型文件解析
  - [ ] 复杂嵌套结构
  - [ ] 多种语言特性混合

### 4.2 错误处理验证

- [ ] **语法错误处理**
  - [ ] 部分语法错误代码处理
  - [ ] 错误恢复机制
  - [ ] 错误信息报告

- [ ] **异常情况处理**
  - [ ] 空输入处理
  - [ ] 无效查询结果处理
  - [ ] 内存不足处理

### 4.3 性能验证

- [ ] **解析性能**
  - [ ] 大文件解析时间
  - [ ] 内存使用情况
  - [ ] CPU使用率

- [ ] **查询性能**
  - [ ] 查询执行时间
  - [ ] 查询结果大小
  - [ ] 查询缓存效果

## 5. 回归测试验证清单

### 5.1 真实代码库测试

- [ ] **开源项目测试**
  - [ ] Linux内核代码片段
  - [ ] OpenSSL代码片段
  - [ ] Redis代码片段
  - [ ] Nginx代码片段

- [ ] **项目特定代码**
  - [ ] 公司内部C项目
  - [ ] 嵌入式系统代码
  - [ ] 系统级代码

### 5.2 边界条件测试

- [ ] **极端代码结构**
  - [ ] 极深的嵌套结构
  - [ ] 极长的标识符
  - [ ] 极大的文件
  - [ ] 极复杂的表达式

- [ ] **特殊语法结构**
  - [ ] GCC扩展语法
  - [ ] MSVC扩展语法
  - [ ] C11新特性
  - [ ] 预处理器复杂宏

## 6. 测试覆盖率验证清单

### 6.1 代码覆盖率

- [ ] **语句覆盖率**
  - [ ] 查询规则文件：100%
  - [ ] 适配器文件：95%+
  - [ ] 关系提取器文件：95%+

- [ ] **分支覆盖率**
  - [ ] 条件分支：90%+
  - [ ] 异常分支：85%+

- [ ] **函数覆盖率**
  - [ ] 公共函数：100%
  - [ ] 私有函数：90%+

### 6.2 测试用例覆盖率

- [ ] **功能覆盖**
  - [ ] 所有查询规则类型
  - [ ] 所有适配器方法
  - [ ] 所有关系提取器

- [ ] **场景覆盖**
  - [ ] 正常使用场景
  - [ ] 异常使用场景
  - [ ] 边界条件场景

## 7. 文档验证清单

### 7.1 测试文档

- [ ] **测试计划文档**
  - [ ] 测试目标明确
  - [ ] 测试范围完整
  - [ ] 测试策略合理

- [ ] **测试用例文档**
  - [ ] 用例描述清晰
  - [ ] 预期结果明确
  - [ ] 覆盖范围全面

### 7.2 技术文档

- [ ] **API文档**
  - [ ] 接口描述完整
  - [ ] 参数说明清晰
  - [ ] 返回值说明准确

- [ ] **架构文档**
  - [ ] 组件关系清晰
  - [ ] 数据流向明确
  - [ ] 设计决策说明

## 8. 持续集成验证清单

### 8.1 自动化测试

- [ ] **CI/CD集成**
  - [ ] 代码提交触发测试
  - [ ] 定时回归测试
  - [ ] 测试报告生成

- [ ] **测试环境**
  - [ ] 测试环境一致性
  - [ ] 测试数据管理
  - [ ] 测试结果存储

### 8.2 质量监控

- [ ] **质量指标**
  - [ ] 测试通过率监控
  - [ ] 代码覆盖率监控
  - [ ] 性能指标监控

- [ ] **问题跟踪**
  - [ ] 测试失败跟踪
  - [ ] 缺陷修复验证
  - [ ] 质量趋势分析

## 总结

本验证清单提供了C语言查询规则与语言适配器协调关系的全面测试覆盖。通过系统性地执行这些验证项目，可以确保系统的可靠性、准确性和性能。建议按照优先级分阶段执行验证，并建立持续改进机制，以适应不断变化的需求。