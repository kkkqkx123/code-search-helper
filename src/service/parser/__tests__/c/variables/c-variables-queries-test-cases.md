# C语言变量Tree-Sitter查询规则测试用例

本文档为C语言变量的Tree-Sitter查询规则提供测试用例，每个查询规则后都附有相应的测试代码示例，方便在Tree-Sitter Playground中进行验证。

## 1. 全局变量声明

### 测试用例
```c
// 基本变量声明
int global_var;
char* string_ptr;
float pi_value;

// 结构体变量声明
struct Point {
    int x;
    int y;
} point;

// 数组变量声明
int numbers[100];
char buffer[256];
```

### 查询规则
```
[
  ; 全局变量声明 - 基本形式
  (declaration
    type: (_)
    declarator: (identifier) @name.definition.variable) @definition.variable

  ; 变量声明带存储类说明符
  (declaration
    (storage_class_specifier)
    type: (_)
    declarator: (identifier) @name.definition.variable) @definition.variable

  ; 变量声明带初始化
  (declaration
    type: (_)
    declarator: (init_declarator
      declarator: (identifier) @name.definition.variable)) @definition.variable

  ; 赋值表达式
  (assignment_expression
    left: (identifier) @name.definition.assignment) @definition.assignment
]
```

## 2. 带存储类说明符的变量声明

### 测试用例
```c
// static变量声明
static int counter;
static char* message;

// extern变量声明
extern int external_var;
extern void* external_ptr;

// const变量声明
const int max_value = 100;
const char* version = "1.0";

// volatile变量声明
volatile int flag;
volatile bool* status_ptr;

// register变量声明
register int i;
register char c;
```

### 查询规则
```
[
  ; 全局变量声明 - 基本形式
  (declaration
    type: (_)
    declarator: (identifier) @name.definition.variable) @definition.variable

  ; 变量声明带存储类说明符
  (declaration
    (storage_class_specifier)
    type: (_)
    declarator: (identifier) @name.definition.variable) @definition.variable

  ; 变量声明带初始化
  (declaration
    type: (_)
    declarator: (init_declarator
      declarator: (identifier) @name.definition.variable)) @definition.variable

  ; 赋值表达式
  (assignment_expression
    left: (identifier) @name.definition.assignment) @definition.assignment
]
```

## 3. 带初始化的变量声明

### 测试用例
```c
// 基本类型初始化
int count = 0;
float rate = 3.14;
char letter = 'A';

// 指针类型初始化
int* ptr = NULL;
char* str = "Hello";
void* data = malloc(100);

// 数组初始化
int arr[] = {1, 2, 3, 4, 5};
char name[] = "John";

// 结构体初始化
struct Config {
    int port;
    char* host;
} config = {8080, "localhost"};
```

### 查询规则
```
[
  ; 全局变量声明 - 基本形式
  (declaration
    type: (_)
    declarator: (identifier) @name.definition.variable) @definition.variable

  ; 变量声明带存储类说明符
  (declaration
    (storage_class_specifier)
    type: (_)
    declarator: (identifier) @name.definition.variable) @definition.variable

  ; 变量声明带初始化
  (declaration
    type: (_)
    declarator: (init_declarator
      declarator: (identifier) @name.definition.variable)) @definition.variable

  ; 赋值表达式
  (assignment_expression
    left: (identifier) @name.definition.assignment) @definition.assignment
]
```

## 4. 赋值表达式

### 测试用例
```c
int main() {
    int x, y, z;
    
    // 简单赋值
    x = 10;
    y = 20;
    
    // 复合赋值
    x += 5;
    y -= 3;
    z *= 2;
    
    // 链式赋值
    x = y = z = 100;
    
    // 数组元素赋值
    int arr[10];
    arr[0] = 1;
    arr[1] = arr[0] + 1;
    
    // 指针赋值
    int* ptr;
    ptr = &x;
    *ptr = 50;
    
    return 0;
}
```

### 查询规则
```
[
  ; 全局变量声明 - 基本形式
  (declaration
    type: (_)
    declarator: (identifier) @name.definition.variable) @definition.variable

  ; 变量声明带存储类说明符
  (declaration
    (storage_class_specifier)
    type: (_)
    declarator: (identifier) @name.definition.variable) @definition.variable

  ; 变量声明带初始化
  (declaration
    type: (_)
    declarator: (init_declarator
      declarator: (identifier) @name.definition.variable)) @definition.variable

  ; 赋值表达式
  (assignment_expression
    left: (identifier) @name.definition.assignment) @definition.assignment
]
```

## 5. 复杂变量声明场景

### 测试用例
```c
#include <stdio.h>
#include <stdlib.h>

// 全局变量
int global_counter = 0;
static const int MAX_SIZE = 1000;
extern volatile bool system_ready;

// 函数内变量
void process_data() {
    // 基本变量
    int local_var;
    double price = 99.99;
    char buffer[256] = {0};
    
    // 静态变量
    static int call_count = 0;
    static char* last_message = NULL;
    
    // 寄存器变量
    register int i;
    register char c = 'A';
    
    // 赋值操作
    local_var = 42;
    price += 10.0;
    call_count++;
    
    // 指针操作
    int* ptr = malloc(sizeof(int));
    *ptr = 100;
    ptr = &local_var;
}

int main() {
    // 多种变量声明和赋值
    int a = 1, b = 2, c;
    const int limit = 100;
    volatile bool flag = true;
    
    c = a + b;
    flag = false;
    
    process_data();
    
    return 0;
}
```

### 查询规则
```
[
  ; 全局变量声明 - 基本形式
  (declaration
    type: (_)
    declarator: (identifier) @name.definition.variable) @definition.variable

  ; 变量声明带存储类说明符
  (declaration
    (storage_class_specifier)
    type: (_)
    declarator: (identifier) @name.definition.variable) @definition.variable

  ; 变量声明带初始化
  (declaration
    type: (_)
    declarator: (init_declarator
      declarator: (identifier) @name.definition.variable)) @definition.variable

  ; 赋值表达式
  (assignment_expression
    left: (identifier) @name.definition.assignment) @definition.assignment
]
```