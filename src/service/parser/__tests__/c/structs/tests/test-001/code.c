// 结构体定义测试
struct Point {
    int x;
    int y;
};

struct Person {
    char name[50];
    int age;
    float height;
};

// 嵌套结构体
struct Rectangle {
    struct Point top_left;
    struct Point bottom_right;
};