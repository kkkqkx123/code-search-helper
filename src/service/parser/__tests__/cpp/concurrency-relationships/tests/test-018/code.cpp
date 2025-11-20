#include <shared_mutex>
#include <thread>
#include <iostream>

std::shared_mutex rwMutex;
int sharedData = 0;

void reader() {
    rwMutex.lock_shared();
    std::cout << "Reading data: " << sharedData << std::endl;
    rwMutex.unlock_shared();
}

void writer() {
    rwMutex.lock();
    sharedData++;
    std::cout << "Writing data: " << sharedData << std::endl;
    rwMutex.unlock();
}

int main() {
    std::thread t1(reader);
    std::thread t2(reader);
    std::thread t3(writer);
    
    t1.join();
    t2.join();
    t3.join();
    
    return 0;
}