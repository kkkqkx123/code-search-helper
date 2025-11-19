#include <stdio.h>

void print_message() {
    printf("Message printed\n");
}

int main() {
    int x = 5;
    
    if (x > 0 && print_message()) {
        printf("Condition met\n");
    }
    
    return 0;
}