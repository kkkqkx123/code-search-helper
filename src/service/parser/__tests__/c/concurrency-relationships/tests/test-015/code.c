#include <semaphore.h>

int main() {
    sem_t sem;
    
    sem_init(&sem, 0, 1);
    
    // sem_wait测试
    sem_wait(&sem);
    
    // Critical section
    // ...
    
    sem_post(&sem);
    
    return 0;
}