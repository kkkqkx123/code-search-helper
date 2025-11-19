#include <pthread.h>

int main() {
    pthread_mutex_t mutex;
    
    pthread_mutex_init(&mutex, NULL);
    
    // pthread_mutex_lock测试
    pthread_mutex_lock(&mutex);
    
    // Critical section
    // ...
    
    pthread_mutex_unlock(&mutex);
    
    return 0;
}