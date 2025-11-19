// 前向声明测试
struct Node;  // 结构体前向声明
union Storage;  // 联合体前向声明
enum State;    // 枚举前向声明

// 完整定义
struct Node {
    int data;
    struct Node* next;
};

union Storage {
    int i;
    float f;
    char c;
};

enum State {
    INIT,
    RUNNING,
    STOPPED
};

int main() {
    struct Node* head = NULL;
    return 0;
}