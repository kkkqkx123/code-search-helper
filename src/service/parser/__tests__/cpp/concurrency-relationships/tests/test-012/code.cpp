#include <atomic>
#include <thread>
#include <iostream>

std::atomic_flag flag = ATOMIC_FLAG_INIT;

void trySetFlag() {
    if (!flag.test_and_set()) {
        std::cout << "Flag was unset, now set" << std::endl;
    } else {
        std::cout << "Flag was already set" << std::endl;
    }
}

void clearFlag() {
    flag.clear();
    std::cout << "Flag cleared" << std::endl;
}

int main() {
    std::thread t1(trySetFlag);
    std::thread t2(trySetFlag);
    std::thread t3(clearFlag);
    
    t1.join();
    t2.join();
    t3.join();
    
    return 0;
}