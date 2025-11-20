#include <semaphore>
#include <thread>
#include <iostream>

std::counting_semaphore<1> sem(0);

void waitForSemaphore() {
    sem.acquire();
    std::cout << "Resource accessed" << std::endl;
}

void releaseSemaphore() {
    sem.release();
    std::cout << "Resource released" << std::endl;
}

int main() {
    std::thread t1(waitForSemaphore);
    std::thread t2(releaseSemaphore);
    
    t1.join();
    t2.join();
    
    return 0;
}