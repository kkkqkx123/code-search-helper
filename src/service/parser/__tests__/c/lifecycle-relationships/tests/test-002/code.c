#include <stdlib.h>

int main() {
    int* ptr = (int*)malloc(sizeof(int) * 10);
    
    // free测试
    free(ptr);
    
    return 0;
}