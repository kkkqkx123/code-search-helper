#include <stdio.h>

int main() {
    int a = 5;
    int b = 10;
    int result;
    
    result = (a > b) ? a : b;
    printf("Max: %d\n", result);
    
    return 0;
}