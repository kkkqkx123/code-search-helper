#include <stdio.h>
#include <stdlib.h>

struct Node {
    int data;
    struct Node* next;  // 指向相同类型的指针
    char* name;         // 指向字符的指针
};

int main() {
    struct Node node;
    node.data = 42;
    node.next = NULL;
    node.name = "test";
    
    printf("Node data: %d\n", node.data);
    
    return 0;
}