#include <stdio.h>

int main() {
    int x = 5;
    
    switch (x) {
        case 1:
            printf("One\n");
            break;
        case 2:
            printf("Two\n");
            break;
        default:
            printf("Default case\n");
            break;
    }
    
    return 0;
}