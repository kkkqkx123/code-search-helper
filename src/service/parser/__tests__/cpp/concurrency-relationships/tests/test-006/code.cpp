#include <mutex>
#include <iostream>

std::mutex mtx;

void tryLockExample() {
    if (mtx.try_lock()) {
        std::cout << "Lock acquired successfully" << std::endl;
        mtx.unlock();
    } else {
        std::cout << "Failed to acquire lock" << std::endl;
    }
}

int main() {
    std::thread t1(tryLockExample);
    std::thread t2(tryLockExample);
    
    t1.join();
    t2.join();
    
    return 0;
}