# C语言预处理器Tree-Sitter查询规则测试用例

本文档为C语言预处理器的Tree-Sitter查询规则提供测试用例，每个查询规则后都附有相应的测试代码示例，方便在TreeSitter Playground中进行验证。

## 1. 对象宏定义

### 测试用例
```c
#include <stdio.h>

#define MAX_SIZE 100
#define BUFFER_SIZE 1024
#define PI 3.14159265359
#define VERSION "1.0.0"
#define DEBUG_FLAG 1

int main() {
    int array[MAX_SIZE];
    char buffer[BUFFER_SIZE];
    double radius = 5.0;
    double area = PI * radius * radius;
    
#ifdef DEBUG
    printf("Version: %s\n", VERSION);
#endif

    if (DEBUG_FLAG) {
        printf("Debug mode enabled\n");
    }
    
    return 0;
}
```

### 查询规则
```
(preproc_def
  name: (identifier) @name.definition.macro) @definition.macro
```

## 2. 函数宏定义

### 查询规则
```
(preproc_function_def
  name: (identifier) @name.definition.macro) @definition.macro
```

### 测试用例
```c
#include <stdio.h>
#include <stdlib.h>

#define MAX(a, b) ((a) > (b) ? (a) : (b))
#define MIN(a, b) ((a) < (b) ? (a) : (b))
#define SQUARE(x) ((x) * (x))
#define ABS(x) ((x) < 0 ? -(x) : (x))
#define SWAP(a, b) do { typeof(a) temp = a; a = b; b = temp; } while(0)

int main() {
    int x = 10, y = 20;
    int max_val = MAX(x, y);
    int min_val = MIN(x, y);
    int square_val = SQUARE(x);
    int abs_val = ABS(-15);
    
    printf("Max: %d, Min: %d\n", max_val, min_val);
    printf("Square: %d, Abs: %d\n", square_val, abs_val);
    
    SWAP(x, y);
    printf("After swap: x=%d, y=%d\n", x, y);
    
    return 0;
}
```

## 3. 系统库包含

### 查询规则
```
(preproc_include
  path: (system_lib_string) @name.definition.include) @definition.include
```

### 测试用例
```c
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <time.h>
#include <unistd.h>

int main() {
    printf("Hello, World!\n");
    return 0;
}
```

## 4. 用户头文件包含

### 查询规则
```
(preproc_include
  path: (string_literal) @name.definition.include) @definition.include
```

### 测试用例
```c
#include "my_header.h"
#include "utils/helper.h"
#include "config/settings.h"
#include "../common/types.h"

int main() {
    // 使用自定义头文件中的函数和类型
    my_function();
    return 0;
}
```

## 5. 条件编译-if

### 查询规则
```
(preproc_if
  condition: (_) @name.definition.preproc_condition) @definition.preproc_condition
```

### 测试用例
```c
#define VERSION 2

#if VERSION == 1
    printf("Version 1 code\n");
#elif VERSION == 2
    printf("Version 2 code\n");
#else
    printf("Unknown version\n");
#endif

#if defined(DEBUG)
    printf("Debug mode enabled\n");
#endif

int main() {
#if VERSION > 1
    printf("Using enhanced features\n");
#endif
    return 0;
}
```

## 6. 条件编译-ifdef

### 查询规则
```
(preproc_ifdef
  name: (identifier) @name.definition.preproc_ifdef) @definition.preproc_ifdef
```

### 测试用例
```c
#define DEBUG

#ifdef DEBUG
    #define LOG(msg) printf("DEBUG: %s\n", msg)
#else
    #define LOG(msg)
#endif

#ifndef MAX_BUFFER_SIZE
    #define MAX_BUFFER_SIZE 1024
#endif

int main() {
    LOG("Application started");
    char buffer[MAX_BUFFER_SIZE];
    LOG("Buffer allocated");
    return 0;
}
```

## 7. 条件编译-elif

### 查询规则
```
(preproc_elif
  condition: (_) @name.definition.preproc_condition) @definition.preproc_condition
```

### 测试用例
```c
#define PLATFORM 2

#if PLATFORM == 1
    #define OS_NAME "Windows"
#elif PLATFORM == 2
    #define OS_NAME "Linux"
#elif PLATFORM == 3
    #define OS_NAME "macOS"
#else
    #define OS_NAME "Unknown"
#endif

int main() {
    printf("Running on %s\n", OS_NAME);
    return 0;
}
```

## 8. 条件编译-else

### 查询规则
```
(preproc_else) @definition.preproc_else
```

### 测试用例
```c
#define ENABLE_FEATURE_X

#ifdef ENABLE_FEATURE_X
    void feature_x() {
        printf("Feature X is enabled\n");
    }
#else
    void feature_x() {
        // Feature X is disabled
    }
#endif

#ifndef DISABLE_LOGGING
    #define LOG(msg) printf("LOG: %s\n", msg)
#else
    #define LOG(msg)
#endif

int main() {
    feature_x();
    LOG("Application started");
    return 0;
}