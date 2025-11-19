#include <semaphore.h>

int main() {
    sem_t sem;
    
    sem_init(&sem, 0, 0);
    sem_wait(&sem);
    
    // Critical section
    // ...
    
    // sem_post测试
    sem_post(&sem);
    
    return 0;
}