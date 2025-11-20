#include <pthread.h>
#include <windows.h>

void* thread_function(void* arg) {
    return NULL;
}

int main() {
    pthread_t thread;
    pthread_attr_t attr;
    
    // pthread_create测试
    pthread_create(&thread, &attr, thread_function, NULL);
    
    // CreateThread测试
    HANDLE hThread = CreateThread(
        NULL,                   // Security attributes
        0,                      // Stack size
        (LPTHREAD_START_ROUTINE)thread_function,  // Start function
        NULL,                   // Argument
        0,                      // Creation flags
        NULL                    // Thread ID
    );
    
    // _beginthreadex测试
    HANDLE hThread2 = (HANDLE)_beginthreadex(
        NULL,                   // Security
        0,                      // Stack size
        (LPTHREAD_START_ROUTINE)thread_function,  // Start function
        NULL,                   // Argument
        0,                      // Init flag
        NULL                    // Thread address
    );
    
    return 0;
}