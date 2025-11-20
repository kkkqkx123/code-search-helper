#include <stdio.h>
#include <stdlib.h>

void helper_function(int param) {
    printf("Helper function called with %d\n", param);
}

int calculate(int a, int b) {
    return a + b;
}

int main() {
    int x = 10;
    int y = 20;
    
    // 直接函数调用
    int result = calculate(x, y);
    
    // 调用helper函数
    helper_function(result);
    
    return 0;
}