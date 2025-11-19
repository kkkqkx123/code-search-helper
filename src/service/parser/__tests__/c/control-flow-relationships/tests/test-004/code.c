#include <stdio.h>

int main() {
    int x = 10;
    
    if (x > 5) {
        printf("x is greater than 5\n");
    } else if (x == 5) {
        printf("x is equal to 5\n");
    } else {
        printf("x is less than 5\n");
    }
    
    return 0;
}