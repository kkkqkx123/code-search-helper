#include <atomic>
#include <thread>
#include <iostream>

std::atomic<int> x(0);
std::atomic<int> y(0);

void write_x_then_y() {
    x.store(1, std::memory_order_relaxed);
    y.store(1, std::memory_order_release);
}

void read_y_then_x() {
    while (y.load(std::memory_order_acquire) == 0) {
        // 等待
    }
    if (x.load(std::memory_order_relaxed) == 0) {
        std::cout << "Reordering detected!" << std::endl;
    } else {
        std::cout << "No reordering" << std::endl;
    }
}

int main() {
    std::thread t1(write_x_then_y);
    std::thread t2(read_y_then_x);
    
    t1.join();
    t2.join();
    
    return 0;
}