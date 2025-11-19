#include <stdio.h>

// 返回指针的函数
int* get_pointer(int *x) {
    return x;
}

int main() {
    int value = 42;
    int *ptr = get_pointer(&value);
    return 0;
}