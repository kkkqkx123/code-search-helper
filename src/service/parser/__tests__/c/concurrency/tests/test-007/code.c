#include <pthread.h>

int main() {
    pthread_cond_t cond;
    
    pthread_cond_init(&cond, NULL);
    
    // pthread_cond_destroy测试
    pthread_cond_destroy(&cond);
    
    return 0;
}