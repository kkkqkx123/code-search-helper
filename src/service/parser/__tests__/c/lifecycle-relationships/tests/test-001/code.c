#include <stdlib.h>

int main() {
    // malloc测试
    int* ptr1 = (int*)malloc(sizeof(int) * 10);
    
    // calloc测试
    int* ptr2 = (int*)calloc(10, sizeof(int));
    
    // realloc测试
    int* ptr3 = (int*)realloc(ptr1, sizeof(int) * 20);
    
    // alloca测试
    int* ptr4 = (int*)alloca(sizeof(int) * 5);
    
    return 0;
}