#include <pthread.h>

int main() {
    pthread_cond_t cond;
    pthread_mutex_t mutex;
    
    pthread_cond_init(&cond, NULL);
    pthread_mutex_init(&mutex, NULL);
    
    pthread_mutex_lock(&mutex);
    
    // pthread_cond_broadcast测试
    pthread_cond_broadcast(&cond);
    
    pthread_mutex_unlock(&mutex);
    
    return 0;
}