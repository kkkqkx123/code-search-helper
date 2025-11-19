#include <stdio.h>

int main() {
    int x = 5;
    int y = ++x;  // Pre-increment
    int z = x--;  // Post-decrement
    
    printf("x: %d, y: %d, z: %d\n", x, y, z);
    
    return 0;
}