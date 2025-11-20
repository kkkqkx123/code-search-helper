#include <semaphore>
#include <thread>
#include <iostream>

std::counting_semaphore<3> sem(3);

void acquireSemaphore() {
    sem.acquire();
    std::cout << "Semaphore acquired" << std::endl;
    // 模拟工作
    sem.release();
}