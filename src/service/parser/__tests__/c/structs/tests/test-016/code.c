#include <stdio.h>

struct Point {
    int x;
    int y;
};

int main() {
    struct Point p = {5, 10};
    struct Point* ptr = &p;
    
    // 指针成员访问测试
    printf("X: %d, Y: %d\n", ptr->x, ptr->y);
    
    // 修改通过指针访问的成员
    ptr->x = 15;
    ptr->y = 25;
    
    return 0;
}