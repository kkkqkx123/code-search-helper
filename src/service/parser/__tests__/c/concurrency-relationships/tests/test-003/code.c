#include <pthread.h>

int main() {
    pthread_cond_t cond;
    pthread_condattr_t attr;
    
    // pthread_cond_init测试
    pthread_cond_init(&cond, &attr);
    
    return 0;
}