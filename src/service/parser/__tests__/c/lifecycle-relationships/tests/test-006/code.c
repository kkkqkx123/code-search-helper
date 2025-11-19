#include <stdio.h>
#include <unistd.h>

int main() {
    FILE* file = fopen("test.txt", "r");
    int fd = open("data.bin", O_RDONLY);
    
    // fclose测试
    fclose(file);
    
    // close测试
    close(fd);
    
    return 0;
}