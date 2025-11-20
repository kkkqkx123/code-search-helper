#include <stdio.h>

int main() {
    int x = 5;
    
    if (x > 0) {
        if (x > 3) {
            printf("Nested positive\n");
        }
    }
    
    return 0;
}