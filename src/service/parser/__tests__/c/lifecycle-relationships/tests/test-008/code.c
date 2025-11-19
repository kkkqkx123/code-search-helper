#include <stdio.h>
#include <unistd.h>

int main() {
    FILE* file = fopen("test.txt", "w");
    int fd = open("data.bin", O_WRONLY);
    char buffer[] = "Hello, World!";
    
    // fwrite测试
    size_t bytes_written = fwrite(buffer, 1, sizeof(buffer), file);
    
    // write测试
    ssize_t bytes_written2 = write(fd, buffer, sizeof(buffer));
    
    // fputs测试
    fputs("Hello\n", file);
    
    // fprintf测试
    fprintf(file, "Value: %d\n", 42);
    
    return 0;
}