#include <thread>
#include <iostream>

struct Counter {
    int value;
};

void incrementCounter(Counter* counter) {
    // 这是一个潜在的竞态条件
    counter->value = counter->value + 1;
}

int main() {
    Counter counter{0};
    
    std::thread t1(incrementCounter, &counter);
    std::thread t2(incrementCounter, &counter);
    
    t1.join();
    t2.join();
    
    std::cout << "Final counter value: " << counter.value << std::endl;
    
    return 0;
}