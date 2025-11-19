#include <stdio.h>

// 内联函数
static inline int square(int x) {
    return x * x;
}

int main() {
    int result = square(5);
    return 0;
}