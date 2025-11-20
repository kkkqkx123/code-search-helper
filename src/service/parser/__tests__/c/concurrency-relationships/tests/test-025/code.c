#include <pthread.h>

int main() {
    pthread_mutex_t mutex;
    pthread_mutexattr_t attr;
    
    // pthread_mutex_init测试
    pthread_mutex_init(&mutex, &attr);
    
    return 0;
}