#include <pthread.h>

void* thread_function(void* arg) {
    return NULL;
}

int main() {
    pthread_t thread;
    
    pthread_create(&thread, NULL, thread_function, NULL);
    
    // pthread_detach测试
    pthread_detach(thread);
    
    return 0;
}