#include <stdio.h>

// 全局变量生命周期测试
int global_counter = 0;
char* global_message = "Hello, World!";

int main() {
    global_counter++;
    printf("%s\n", global_message);
    return 0;
}