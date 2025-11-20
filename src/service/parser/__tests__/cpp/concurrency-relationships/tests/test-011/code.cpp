#include <atomic>
#include <iostream>

std::atomic<int> value(0);

void compareExchangeExample() {
    int expected = 0;
    int desired = 42;
    
    if (value.compare_exchange(expected, desired)) {
        std::cout << "Exchange successful" << std::endl;
    } else {
        std::cout << "Exchange failed, current value: " << expected << std::endl;
    }
}

int main() {
    compareExchangeExample();
    return 0;
}