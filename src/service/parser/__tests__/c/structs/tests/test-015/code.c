#include <stdio.h>

// 嵌套结构体定义
struct Point {
    int x;
    int y;
};

struct Rectangle {
    struct Point top_left;
    struct Point bottom_right;
};

struct Circle {
    struct Point center;
    int radius;
};

int main() {
    struct Rectangle rect;
    rect.top_left.x = 0;
    rect.top_left.y = 0;
    rect.bottom_right.x = 10;
    rect.bottom_right.y = 10;
    
    struct Circle circle;
    circle.center.x = 5;
    circle.center.y = 5;
    circle.radius = 7;
    
    return 0;
}