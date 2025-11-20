#include <atomic>
#include <thread>
#include <iostream>

std::atomic<bool> flag(false);
int data = 0;

void writer() {
    data = 42;
    std::atomic_thread_fence(std::memory_order_release);
    flag.store(true, std::memory_order_relaxed);
}

void reader() {
    while (!flag.load(std::memory_order_relaxed)) {
        // 等待
    }
    std::atomic_thread_fence(std::memory_order_acquire);
    std::cout << "Data read: " << data << std::endl;
}

int main() {
    std::thread t1(writer);
    std::thread t2(reader);
    
    t1.join();
    t2.join();
    
    return 0;
}