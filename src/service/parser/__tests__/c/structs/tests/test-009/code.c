#include <stdio.h>

struct Point {
    int x;
    int y;
};

int main() {
    struct Point p;
    p.x = 10;
    p.y = 20;
    
    // 成员访问测试
    printf("X: %d, Y: %d\n", p.x, p.y);
    
    struct Point* ptr = &p;
    ptr->x = 30;
    ptr->y = 40;
    
    return 0;
}