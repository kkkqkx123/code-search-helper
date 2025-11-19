#include <stdio.h>

int main() {
    // 文件句柄变量绑定测试
    FILE* file = fopen("test.txt", "r");
    int fd = open("data.bin", O_RDONLY);
    
    return 0;
}