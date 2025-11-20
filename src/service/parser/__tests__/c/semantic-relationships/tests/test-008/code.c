#include <stdio.h>
#include <stdlib.h>

// 宏定义
#define MAX(a, b) ((a) > (b) ? (a) : (b))
#define BUFFER_SIZE 1024
#define DEBUG

#ifdef DEBUG
#define LOG(msg) printf("DEBUG: %s\n", msg)
#else
#define LOG(msg)
#endif

int main() {
    int x = 10;
    int y = 20;
    
    int max_value = MAX(x, y);
    char buffer[BUFFER_SIZE];
    
    printf("Max value: %d\n", max_value);
    LOG("Program started");
    
    return 0;
}