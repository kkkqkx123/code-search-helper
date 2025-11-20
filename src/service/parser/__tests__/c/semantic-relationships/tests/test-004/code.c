#include <stdio.h>

// 基本结构体定义
struct Point {
    int x;
    int y;
};

// 嵌套结构体
struct Rectangle {
    struct Point topLeft;
    struct Point bottomRight;
    int width;
    int height;
};

int main() {
    struct Point p = {10, 20};
    struct Rectangle rect = {{0, 0}, {100, 100}, 100, 100};
    
    printf("Point: (%d, %d)\n", p.x, p.y);
    printf("Rectangle: (%d, %d) to (%d, %d)\n", 
           rect.topLeft.x, rect.topLeft.y,
           rect.bottomRight.x, rect.bottomRight.y);
    
    return 0;
}