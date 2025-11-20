#include <stdio.h>

typedef void (*CallbackFunction)(int);

void my_callback(int value) {
    printf("Callback called with value: %d\n", value);
}

int main() {
    // 回调函数赋值
    CallbackFunction callback = my_callback;
    
    // 调用回调函数
    callback(42);
    
    return 0;
}