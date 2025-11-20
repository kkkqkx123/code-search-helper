#include <stdio.h>

// 外部变量声明
extern int external_counter;
extern char* external_string;

int main() {
    // 使用外部变量
    printf("External counter: %d\n", external_counter);
    printf("External string: %s\n", external_string);
    
    return 0;
}