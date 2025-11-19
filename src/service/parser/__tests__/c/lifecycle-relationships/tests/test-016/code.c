#include <pthread.h>
#include <windows.h>

int main() {
    pthread_mutex_t mutex;
    CRITICAL_SECTION cs;
    
    pthread_mutex_init(&mutex, NULL);
    InitializeCriticalSection(&cs);
    
    pthread_mutex_lock(&mutex);
    EnterCriticalSection(&cs);
    
    // pthread_mutex_unlock测试
    pthread_mutex_unlock(&mutex);
    
    // LeaveCriticalSection测试
    LeaveCriticalSection(&cs);
    
    return 0;
}