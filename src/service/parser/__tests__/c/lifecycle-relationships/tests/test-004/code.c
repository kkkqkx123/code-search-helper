#include <stdlib.h>

int main() {
    // 内存分配变量绑定测试
    int* ptr = (int*)malloc(sizeof(int) * 10);
    char* str = (char*)calloc(100, sizeof(char));
    
    return 0;
}