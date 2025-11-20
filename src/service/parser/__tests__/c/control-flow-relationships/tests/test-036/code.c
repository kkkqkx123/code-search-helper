#include <stdio.h>

int check_positive(int x) {
    return x > 0 && printf("Positive\n");
}

int main() {
    int result = check_positive(5);
    return 0;
}