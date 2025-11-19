#include <stdio.h>

// 静态变量生命周期测试
static int static_counter = 0;
static char* static_message = "Static Message";

void increment_counter() {
    static int function_static = 0;
    function_static++;
    static_counter++;
}

int main() {
    increment_counter();
    return 0;
}