#include <pthread.h>

void* thread_function(void* arg) {
    return NULL;
}

int main() {
    pthread_t thread;
    void* result;
    
    pthread_create(&thread, NULL, thread_function, NULL);
    
    // pthread_join测试
    pthread_join(thread, &result);
    
    return 0;
}