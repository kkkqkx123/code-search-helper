#include <pthread.h>
#include <windows.h>

int main() {
    pthread_mutex_t mutex;
    CRITICAL_SECTION cs;
    
    pthread_mutex_init(&mutex, NULL);
    InitializeCriticalSection(&cs);
    
    // pthread_mutex_destroy测试
    pthread_mutex_destroy(&mutex);
    
    // DeleteCriticalSection测试
    DeleteCriticalSection(&cs);
    
    return 0;
}