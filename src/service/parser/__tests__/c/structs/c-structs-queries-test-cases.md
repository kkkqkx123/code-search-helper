# C语言结构体Tree-Sitter查询规则测试用例

本文档为C语言结构体的Tree-Sitter查询规则提供测试用例，每个测试代码示例后都附有相应的查询规则，方便在Tree-Sitter Playground中进行验证。







## 3. 枚举定义查询

### 测试用例
```c
// 枚举定义测试
enum Color {
    RED,
    GREEN,
    BLUE
};

enum Status {
    SUCCESS = 0,
    ERROR = 1,
    PENDING = 2
};

enum Direction {
    NORTH, SOUTH, EAST, WEST
};
```

### 查询规则
```
(enum_specifier
  name: (type_identifier) @type.name
  body: (enumerator_list
    (enumerator
      name: (identifier) @enum.constant)*)) @definition.enum
```

## 4. 类型别名查询

### 测试用例
```c
// 类型别名定义测试
typedef int Integer;
typedef char* String;
typedef struct Point Point;
typedef enum Color Color;
typedef union Data Data;

// 函数指针类型别名
typedef int (*Comparator)(int a, int b);
```

### 查询规则
```
(type_definition
 type: (_)
  declarator: (type_identifier) @alias.name) @definition.type.alias
```

## 5. 数组声明查询

### 测试用例
```c
// 数组声明测试
int numbers[10];
char buffer[256];
float matrix[5][5];
double values[20];
char text[100] = "Hello";
int dynamic_array[];
```

### 查询规则
```
(declaration
  type: (_)
  declarator: (array_declarator
    declarator: (identifier) @array.name
    size: (_)? @array.size)) @definition.array
```

## 6. 指针声明查询

### 测试用例
```c
// 指针声明测试
int* ptr;
char* string;
void* generic_ptr;
int** double_ptr;
const char* const_str;
struct Point* point_ptr;
```

### 查询规则
```
(declaration
  type: (_)
  declarator: (pointer_declarator
    declarator: (identifier) @pointer.name)) @definition.pointer
```

## 7. 成员访问查询

### 测试用例
```c
#include <stdio.h>

struct Point {
    int x;
    int y;
};

int main() {
    struct Point p;
    p.x = 10;
    p.y = 20;
    
    // 成员访问测试
    printf("X: %d, Y: %d\n", p.x, p.y);
    
    struct Point* ptr = &p;
    ptr->x = 30;
    ptr->y = 40;
    
    return 0;
}
```

### 查询规则
```
(field_expression
  argument: (identifier) @object.name
  field: (field_identifier) @field.name) @definition.member.access
```

## 8. 指针成员访问查询

### 测试用例
```c
#include <stdio.h>

struct Point {
    int x;
    int y;
};

int main() {
    struct Point p = {5, 10};
    struct Point* ptr = &p;
    
    // 指针成员访问测试
    printf("X: %d, Y: %d\n", ptr->x, ptr->y);
    
    // 修改通过指针访问的成员
    ptr->x = 15;
    ptr->y = 25;
    
    return 0;
}
```

### 查询规则
```
(field_expression
  argument: (pointer_expression
    argument: (identifier) @pointer.name)
  field: (field_identifier) @field.name) @definition.pointer.member.access
```

## 9. 数组访问查询

### 测试用例
```c
#include <stdio.h>

int main() {
    int arr[10];
    int matrix[5][5];
    
    // 数组访问测试
    arr[0] = 1;
    arr[1] = 2;
    arr[2] = arr[0] + arr[1];
    
    // 二维数组访问
    matrix[0][0] = 10;
    matrix[1][2] = 20;
    
    // 使用变量作为索引
    int i = 3;
    arr[i] = 30;
    
    return 0;
}
```

### 查询规则
```
(subscript_expression
  argument: (identifier) @array.name
  index: (_) @index) @definition.array.access
```

## 10. 嵌套结构体查询

### 测试用例
```c
#include <stdio.h>

// 嵌套结构体定义
struct Point {
    int x;
    int y;
};

struct Rectangle {
    struct Point top_left;
    struct Point bottom_right;
};

struct Circle {
    struct Point center;
    int radius;
};

int main() {
    struct Rectangle rect;
    rect.top_left.x = 0;
    rect.top_left.y = 0;
    rect.bottom_right.x = 10;
    rect.bottom_right.y = 10;
    
    struct Circle circle;
    circle.center.x = 5;
    circle.center.y = 5;
    circle.radius = 7;
    
    return 0;
}
```

### 查询规则
```
(struct_specifier
  body: (field_declaration_list
    (field_declaration
      type: (struct_specifier)
      declarator: (field_identifier) @nested.field.name))) @definition.nested.struct
```

## 11. 前向声明查询

### 测试用例
```c
// 前向声明测试
struct Node;  // 结构体前向声明
union Storage;  // 联合体前向声明
enum State;    // 枚举前向声明

// 完整定义
struct Node {
    int data;
    struct Node* next;
};

union Storage {
    int i;
    float f;
    char c;
};

enum State {
    INIT,
    RUNNING,
    STOPPED
};

int main() {
    struct Node* head = NULL;
    return 0;
}
```

### 查询规则
```
(struct_specifier
  name: (type_identifier) @forward.struct.name) @definition.forward.struct

(union_specifier
  name: (type_identifier) @forward.union.name) @definition.forward.union

(enum_specifier
  name: (type_identifier) @forward.enum.name) @definition.forward.enum