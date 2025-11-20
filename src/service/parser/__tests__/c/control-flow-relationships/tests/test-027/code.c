#include <stdio.h>

int add(int a, int b) {
    return a + b;
}

int main() {
    int (*func_ptr)(int, int) = add;
    int result = func_ptr(5, 3);
    printf("Result: %d\n", result);
    return 0;
}