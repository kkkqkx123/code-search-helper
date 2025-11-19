#include <stdio.h>
#include <unistd.h>

int main() {
    FILE* file = fopen("test.txt", "r");
    int fd = open("data.bin", O_RDONLY);
    char buffer[1024];
    
    // fread测试
    size_t bytes_read = fread(buffer, 1, sizeof(buffer), file);
    
    // read测试
    ssize_t bytes_read2 = read(fd, buffer, sizeof(buffer));
    
    // fgets测试
    char* line = fgets(buffer, sizeof(buffer), file);
    
    // getline测试
    char* line2 = NULL;
    size_t len = 0;
    ssize_t read = getline(&line2, &len, file);
    
    return 0;
}