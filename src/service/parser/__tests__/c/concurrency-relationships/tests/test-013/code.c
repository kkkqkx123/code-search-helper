#include <pthread.h>

int main() {
    pthread_rwlock_t rwlock;
    
    pthread_rwlock_init(&rwlock, NULL);
    pthread_rwlock_wrlock(&rwlock);
    pthread_rwlock_unlock(&rwlock);
    
    // pthread_rwlock_destroy测试
    pthread_rwlock_destroy(&rwlock);
    
    return 0;
}