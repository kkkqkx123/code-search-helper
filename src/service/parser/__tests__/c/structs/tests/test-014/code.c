#include <stdio.h>

int main() {
    int arr[10];
    int matrix[5][5];
    
    // 数组访问测试
    arr[0] = 1;
    arr[1] = 2;
    arr[2] = arr[0] + arr[1];
    
    // 二维数组访问
    matrix[0][0] = 10;
    matrix[1][2] = 20;
    
    // 使用变量作为索引
    int i = 3;
    arr[i] = 30;
    
    return 0;
}