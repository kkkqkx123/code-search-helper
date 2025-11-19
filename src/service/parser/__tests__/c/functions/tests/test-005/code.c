#include <stdio.h>

// 函数指针声明
int (*func_ptr)(int, int);

int add(int a, int b) {
    return a + b;
}

int main() {
    func_ptr = add;
    int result = func_ptr(5, 3);
    return 0;
}