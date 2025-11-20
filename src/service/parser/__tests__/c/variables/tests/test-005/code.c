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