#include <pthread.h>

void* thread_function(void* arg) {
    // pthread_exit测试
    pthread_exit(NULL);
    return NULL;
}

int main() {
    pthread_t thread;
    
    pthread_create(&thread, NULL, thread_function, NULL);
    
    return 0;
}