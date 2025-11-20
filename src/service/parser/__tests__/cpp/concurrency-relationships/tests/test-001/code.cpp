#include <thread>
#include <iostream>

void workerFunction(int id) {
    std::cout << "Worker " << id << " is running" << std::endl;
}

int main() {
    std::thread t1(workerFunction, 1);
    std::thread t2(workerFunction, 2);
    
    t1.join();
    t2.join();
    
    return 0;
}