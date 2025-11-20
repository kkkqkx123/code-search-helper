#include <mutex>
#include <iostream>

std::mutex mtx;
int sharedData = 0;

void safeIncrement() {
    std::lock_guard<std::mutex> lock(mtx);
    sharedData++;
    std::cout << "Data incremented to: " << sharedData << std::endl;
}

int main() {
    std::thread t1(safeIncrement);
    std::thread t2(safeIncrement);
    
    t1.join();
    t2.join();
    
    return 0;
}