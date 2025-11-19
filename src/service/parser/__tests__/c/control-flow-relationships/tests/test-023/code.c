#include <stdio.h>

int factorial(int n) {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);  // Recursive call
}

int main() {
    int result = factorial(5);
    printf("Factorial: %d\n", result);
    
    return 0;
}