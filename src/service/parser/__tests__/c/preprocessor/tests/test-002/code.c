#include <stdio.h>
#include <stdlib.h>

#define MAX(a, b) ((a) > (b) ? (a) : (b))
#define MIN(a, b) ((a) < (b) ? (a) : (b))
#define SQUARE(x) ((x) * (x))
#define ABS(x) ((x) < 0 ? -(x) : (x))
#define SWAP(a, b) do { typeof(a) temp = a; a = b; b = temp; } while(0)

int main() {
    int x = 10, y = 20;
    int max_val = MAX(x, y);
    int min_val = MIN(x, y);
    int square_val = SQUARE(x);
    int abs_val = ABS(-15);
    
    printf("Max: %d, Min: %d\n", max_val, min_val);
    printf("Square: %d, Abs: %d\n", square_val, abs_val);
    
    SWAP(x, y);
    printf("After swap: x=%d, y=%d\n", x, y);
    
    return 0;
}