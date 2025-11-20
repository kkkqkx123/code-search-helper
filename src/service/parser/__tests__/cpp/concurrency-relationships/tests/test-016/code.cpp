#include <latch>
#include <thread>
#include <iostream>

std::latch startLatch(1);

void waitForStart() {
    startLatch.wait();
    std::cout << "Thread started" << std::endl;
}

void startAllThreads() {
    std::cout << "Starting all threads" << std::endl;
    startLatch.count_down();
}

int main() {
    std::thread t1(waitForStart);
    std::thread t2(waitForStart);
    std::thread t3(startAllThreads);
    
    t1.join();
    t2.join();
    t3.join();
    
    return 0;
}