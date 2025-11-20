#include <stdio.h>
#include <stdlib.h>

int main() {
    // malloc测试
    int* ptr1 = (int*)malloc(sizeof(int) * 10);
    
    // calloc测试
    int* ptr2 = (int*)calloc(5, sizeof(int));
    
    // realloc测试
    int* ptr3 = (int*)realloc(ptr1, sizeof(int) * 20);
    
    // 使用分配的内存
    if (ptr3 != NULL) {
        for (int i = 0; i < 20; i++) {
            ptr3[i] = i;
        }
    }
    
    // free测试
    free(ptr2);
    free(ptr3);
    
    return 0;
}