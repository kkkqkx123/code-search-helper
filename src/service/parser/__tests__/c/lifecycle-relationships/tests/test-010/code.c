#include <pthread.h>
#include <windows.h>

void* thread_function(void* arg) {
    return NULL;
}

int main() {
    pthread_t thread;
    pthread_attr_t attr;
    HANDLE hThread;
    DWORD threadId;
    
    // pthread_create测试
    pthread_create(&thread, &attr, thread_function, NULL);
    
    // CreateThread测试
    hThread = CreateThread(NULL, 0, (LPTHREAD_START_ROUTINE)thread_function, NULL, 0, &threadId);
    
    // _beginthread测试
    HANDLE hThread2 = (HANDLE)_beginthread(thread_function, 0, NULL);
    
    return 0;
}