#include <stdio.h>

int main() {
    int x = 5;
    
    start:
    if (x > 0) {
        printf("x = %d\n", x);
        x--;
        goto start;
    }
    
    return 0;
}