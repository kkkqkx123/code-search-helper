#include <pthread.h>

int main() {
    pthread_rwlock_t rwlock;
    pthread_rwlockattr_t attr;
    
    // pthread_rwlock_init测试
    pthread_rwlock_init(&rwlock, &attr);
    
    return 0;
}