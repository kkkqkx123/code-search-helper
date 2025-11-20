#include <stdio.h>
#include <stdlib.h>

#define ERROR -1
#define INVALID -2
#define NULL 0

int divide(int a, int b) {
    if (b == 0) {
        return ERROR;  // 错误返回
    }
    return a / b;
}

int* allocate_memory(int size) {
    int* ptr = (int*)malloc(sizeof(int) * size);
    if (ptr == NULL) {  // 错误检查
        printf("Memory allocation failed\n");
        return NULL;
    }
    return ptr;
}

int main() {
    int result = divide(10, 0);
    if (result == ERROR) {
        printf("Division by zero error\n");
    }
    
    int* ptr = allocate_memory(100);
    if (ptr == NULL) {  // 错误检查
        printf("Failed to allocate memory\n");
        return ERROR;  // 错误返回
    }
    
    free(ptr);
    return 0;
}