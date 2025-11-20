#include <pthread.h>

int main() {
    pthread_rwlock_t rwlock;
    
    pthread_rwlock_init(&rwlock, NULL);
    
    // pthread_rwlock_rdlock测试
    pthread_rwlock_rdlock(&rwlock);
    
    // Read-only section
    // ...
    
    pthread_rwlock_unlock(&rwlock);
    
    return 0;
}