#include <stdio.h>

// 全局变量（符合命名约定）
int g_counter = 0;
char g_buffer[256];
double g_precision = 0.001;

// 普通全局变量（不符合命名约定，不应匹配）
int global_var = 10;

static int s_local_counter = 0;  // 静态变量

int main() {
    g_counter++;
    sprintf(g_buffer, "Counter: %d", g_counter);
    printf("%s\n", g_buffer);
    printf("Precision: %.3f\n", g_precision);
    
    return 0;
}