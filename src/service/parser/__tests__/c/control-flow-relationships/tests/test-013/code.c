#include <stdio.h>

int main() {
    int x = 5;
    
    goto end;
    printf("This will not be printed\n");
    
    end:
    printf("x = %d\n", x);
    
    return 0;
}