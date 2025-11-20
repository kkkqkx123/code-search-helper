#include <stdio.h>

// 函数指针类型定义
typedef int (*BinaryOperation)(int, int);

int add(int a, int b) {
    return a + b;
}

int multiply(int a, int b) {
    return a * b;
}

int main() {
    BinaryOperation op1 = add;
    BinaryOperation op2 = multiply;
    
    int result1 = op1(5, 3);
    int result2 = op2(5, 3);
    
    printf("Addition: %d\n", result1);
    printf("Multiplication: %d\n", result2);
    
    return 0;
}