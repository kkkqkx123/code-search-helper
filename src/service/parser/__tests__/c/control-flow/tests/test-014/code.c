#include <stdio.h>

int main() {
    int a = 5;
    int b = 10;
    
    int max = (a > b) ? a : b;
    
    printf("Max: %d\n", max);
    
    return 0;
}