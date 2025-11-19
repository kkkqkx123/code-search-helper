#include <stdlib.h>

int main() {
    int* ptr = (int*)malloc(sizeof(int) * 10);
    
    // realloc测试
    int* new_ptr = (int*)realloc(ptr, sizeof(int) * 20);
    
    return 0;
}