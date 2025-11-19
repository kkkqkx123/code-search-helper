#include <pthread.h>
#include <stdio.h>

void* thread_function(void* arg) {
    // pthread_self测试
    pthread_t tid = pthread_self();
    printf("Thread ID: %lu\n", tid);
    return NULL;
}

int main() {
    pthread_t thread;
    
    pthread_create(&thread, NULL, thread_function, NULL);
    
    return 0;
}