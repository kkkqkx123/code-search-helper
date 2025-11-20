#include <semaphore.h>
#include <stdio.h>

int main() {
    sem_t sem;
    
    sem_init(&sem, 0, 1);
    
    // sem_trywait测试
    int result = sem_trywait(&sem);
    if (result == 0) {
        // Critical section
        // ...
        sem_post(&sem);
    } else {
        printf("Semaphore not available\n");
    }
    
    return 0;
}