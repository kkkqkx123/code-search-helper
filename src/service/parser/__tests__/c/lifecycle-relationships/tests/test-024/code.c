#include <stdlib.h>

typedef struct {
    int* data;
    size_t size;
} Resource;

// 资源初始化函数
int init_resource(Resource* res) {
    if (!res) return -1;
    res->data = NULL;
    res->size = 0;
    return 0;
}