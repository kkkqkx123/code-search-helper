#include <pthread.h>
#include <stdio.h>

int main() {
    pthread_mutex_t mutex;
    
    pthread_mutex_init(&mutex, NULL);
    
    // pthread_mutex_trylock测试
    int result = pthread_mutex_trylock(&mutex);
    if (result == 0) {
        // Critical section
        // ...
        pthread_mutex_unlock(&mutex);
    } else {
        printf("Mutex is locked by another thread\n");
    }
    
    return 0;
}