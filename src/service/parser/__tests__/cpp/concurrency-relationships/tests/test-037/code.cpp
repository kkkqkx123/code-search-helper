#include <atomic>
#include <iostream>

template<typename T>
class LockFreeStack {
private:
    struct Node {
        T data;
        Node* next;
    };
    
    std::atomic<Node*> head;
    
public:
    LockFreeStack() : head(nullptr) {}
    
    void push(const T& value) {
        Node* newNode = new Node{value, head.load()};
        while (!head.compare_exchange_weak(newNode->next, newNode)) {
            // 重试直到成功
        }
    }
    
    bool pop(T& result) {
        Node* oldHead = head.load();
        while (oldHead && !head.compare_exchange_weak(oldHead, oldHead->next)) {
            // 重试直到成功
        }
        
        if (oldHead) {
            result = oldHead->data;
            delete oldHead;
            return true;
        }
        return false;
    }
};

int main() {
    LockFreeStack<int> stack;
    
    stack.push(10);
    stack.push(20);
    stack.push(30);
    
    int value;
    while (stack.pop(value)) {
        std::cout << "Popped: " << value << std::endl;
    }
    
    return 0;
}