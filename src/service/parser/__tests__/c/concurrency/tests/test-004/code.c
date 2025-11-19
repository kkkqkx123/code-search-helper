#include <pthread.h>
#include <time.h>

int main() {
    pthread_cond_t cond;
    pthread_mutex_t mutex;
    
    pthread_cond_init(&cond, NULL);
    pthread_mutex_init(&mutex, NULL);
    
    pthread_mutex_lock(&mutex);
    
    // pthread_cond_wait测试
    pthread_cond_wait(&cond, &mutex);
    
    // pthread_cond_timedwait测试
    struct timespec timeout;
    clock_gettime(CLOCK_REALTIME, &timeout);
    timeout.tv_sec += 5; // 5秒后超时
    pthread_cond_timedwait(&cond, &mutex, &timeout);
    
    pthread_mutex_unlock(&mutex);
    
    return 0;
}