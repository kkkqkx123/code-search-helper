#include <pthread.h>

int main() {
    pthread_rwlock_t rwlock;
    
    pthread_rwlock_init(&rwlock, NULL);
    pthread_rwlock_wrlock(&rwlock);
    
    // Write section
    // ...
    
    // pthread_rwlock_unlock测试
    pthread_rwlock_unlock(&rwlock);
    
    return 0;
}