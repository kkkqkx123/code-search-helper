#include <pthread.h>
#include <windows.h>

void* thread_function(void* arg) {
    return NULL;
}

int main() {
    pthread_t thread;
    HANDLE hThread;
    void* result;
    
    pthread_create(&thread, NULL, thread_function, NULL);
    hThread = CreateThread(NULL, 0, (LPTHREAD_START_ROUTINE)thread_function, NULL, 0, NULL);
    
    // pthread_join测试
    pthread_join(thread, &result);
    
    // WaitForSingleObject测试
    WaitForSingleObject(hThread, INFINITE);
    
    return 0;
}