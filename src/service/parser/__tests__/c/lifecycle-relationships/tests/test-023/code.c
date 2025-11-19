#include <stdlib.h>

typedef struct {
    int* data;
    size_t size;
} Resource;

// 资源析构函数
void destroy_resource(Resource* res) {
    if (res) {
        free(res->data);
        free(res);
    }
}