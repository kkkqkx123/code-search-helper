#include <stdlib.h>

typedef struct {
    int* data;
    size_t size;
} Resource;

// 资源清理函数
void cleanup_resource(Resource* res) {
    if (res) {
        if (res->data) {
            free(res->data);
            res->data = NULL;
        }
        res->size = 0;
    }
}