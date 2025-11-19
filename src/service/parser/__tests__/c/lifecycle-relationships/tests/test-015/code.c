#include <pthread.h>
#include <windows.h>

int main() {
    pthread_mutex_t mutex;
    CRITICAL_SECTION cs;
    
    pthread_mutex_init(&mutex, NULL);
    InitializeCriticalSection(&cs);
    
    // pthread_mutex_lock测试
    pthread_mutex_lock(&mutex);
    
    // EnterCriticalSection测试
    EnterCriticalSection(&cs);
    
    return 0;
}