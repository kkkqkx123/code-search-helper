#include <stdio.h>

// 带参数的函数
int calculate(int x, int y, int z) {
    return x * y + z;
}

int main() {
    int result = calculate(2, 3, 4);
    return 0;
}