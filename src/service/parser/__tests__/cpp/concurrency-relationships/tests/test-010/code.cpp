#include <atomic>
#include <thread>
#include <iostream>

std::atomic<int> counter(0);

void incrementCounter() {
    counter.fetch_add(1);
}

void readCounter() {
    int value = counter.load();
    std::cout << "Counter value: " << value << std::endl;
}

int main() {
    std::thread t1(incrementCounter);
    std::thread t2(incrementCounter);
    std::thread t3(readCounter);
    
    t1.join();
    t2.join();
    t3.join();
    
    return 0;
}