#include <pthread.h>
#include <windows.h>

int main() {
    pthread_mutex_t mutex;
    CRITICAL_SECTION cs;
    
    // pthread_mutex_init测试
    pthread_mutex_init(&mutex, NULL);
    
    // InitializeCriticalSection测试
    InitializeCriticalSection(&cs);
    
    return 0;
}