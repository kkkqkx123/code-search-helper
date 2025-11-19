#include <stdio.h>

// 静态函数
static int static_add(int a, int b) {
    return a + b;
}

int main() {
    int result = static_add(3, 4);
    return 0;
}