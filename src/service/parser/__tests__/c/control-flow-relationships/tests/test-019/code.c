#include <stdio.h>

void print_message() {
    printf("Message printed\n");
}

int main() {
    int x = -1;
    
    if (x > 0 || print_message()) {
        printf("Condition met\n");
    }
    
    return 0;
}