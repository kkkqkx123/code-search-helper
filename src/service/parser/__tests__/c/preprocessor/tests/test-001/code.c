#include <stdio.h>

#define MAX_SIZE 100
#define BUFFER_SIZE 1024
#define PI 3.14159265359
#define VERSION "1.0.0"
#define DEBUG_FLAG 1

int main() {
    int array[MAX_SIZE];
    char buffer[BUFFER_SIZE];
    double radius = 5.0;
    double area = PI * radius * radius;
    
#ifdef DEBUG
    printf("Version: %s\n", VERSION);
#endif

    if (DEBUG_FLAG) {
        printf("Debug mode enabled\n");
    }
    
    return 0;
}