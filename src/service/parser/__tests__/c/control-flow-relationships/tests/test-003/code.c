#include <stdio.h>

int main() {
    int x = 10;
    
    if (x > 15) {
        if (x > 20) {
            printf("x is greater than 20\n");
        } else {
            printf("x is between 15 and 20\n");
        }
    }
    
    return 0;
}