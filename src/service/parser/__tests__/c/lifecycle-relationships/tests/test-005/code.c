#include <stdio.h>

int main() {
    // fopen测试
    FILE* file1 = fopen("test.txt", "r");
    
    // fopen_s测试
    FILE* file2;
    errno_t err = fopen_s(&file2, "test2.txt", "w");
    
    return 0;
}