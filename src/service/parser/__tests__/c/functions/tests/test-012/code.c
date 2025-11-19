#include <stdio.h>

// 多个参数的函数
int complex_calc(int a, int b, int c, int d, int e) {
    return a + b * c - d / e;
}

int main() {
    int result = complex_calc(1, 2, 3, 4, 5);
    return 0;
}