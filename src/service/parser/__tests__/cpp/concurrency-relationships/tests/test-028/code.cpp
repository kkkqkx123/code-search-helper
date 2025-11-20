#include <mutex>
#include <thread>
#include <iostream>

std::mutex mutex1, mutex2;

void thread1() {
    mutex1.lock();
    std::cout << "Thread 1 acquired mutex1" << std::endl;
    // 模拟一些工作
    mutex2.lock();
    std::cout << "Thread 1 acquired mutex2" << std::endl;
    
    mutex2.unlock();
    mutex1.unlock();
}

void thread2() {
    mutex2.lock();
    std::cout << "Thread 2 acquired mutex2" << std::endl;
    // 模拟一些工作
    mutex1.lock();
    std::cout << "Thread 2 acquired mutex1" << std::endl;
    
    mutex1.unlock();
    mutex2.unlock();
}

int main() {
    std::thread t1(thread1);
    std::thread t2(thread2);
    
    t1.join();
    t2.join();
    
    return 0;
}