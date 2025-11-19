#include <semaphore.h>

int main() {
    sem_t sem;
    
    sem_init(&sem, 0, 1);
    sem_wait(&sem);
    sem_post(&sem);
    
    // sem_destroy测试
    sem_destroy(&sem);
    
    return 0;
}