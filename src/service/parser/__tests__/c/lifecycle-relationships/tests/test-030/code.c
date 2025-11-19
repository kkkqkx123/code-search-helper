#include <stdio.h>

// 函数参数生命周期测试
int process_data(int value, char* text) {
    printf("Value: %d, Text: %s\n", value, text);
    return value * 2;
}

int main() {
    int result = process_data(42, "Hello");
    return result;
}