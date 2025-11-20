#include <iostream>
#include <thread>

thread_local int threadLocalVar = 0;

void threadFunction(int id) {
    threadLocalVar = id;
    std::cout << "Thread " << id << " threadLocalVar = " << threadLocalVar << std::endl;
}

int main() {
    std::thread t1(threadFunction, 1);
    std::thread t2(threadFunction, 2);
    
    t1.join();
    t2.join();
    
    std::cout << "Main thread threadLocalVar = " << threadLocalVar << std::endl;
    
    return 0;
}