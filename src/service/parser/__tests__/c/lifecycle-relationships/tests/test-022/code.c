#include <stdlib.h>

typedef struct {
    int* data;
    size_t size;
} Resource;

// 资源构造函数
Resource* create_resource(size_t size) {
    Resource* res = (Resource*)malloc(sizeof(Resource));
    if (res) {
        res->data = (int*)malloc(size * sizeof(int));
        res->size = size;
    }
    return res;
}