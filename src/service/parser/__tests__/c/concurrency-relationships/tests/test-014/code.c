#include <semaphore.h>

int main() {
    sem_t sem;
    
    // sem_init测试
    sem_init(&sem, 0, 1); // 初始化为1，表示可用资源数
    
    return 0;
}