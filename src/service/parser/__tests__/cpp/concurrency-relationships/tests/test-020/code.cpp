#include <future>
#include <iostream>
#include <chrono>

void longRunningTask() {
    std::this_thread::sleep_for(std::chrono::seconds(2));
    std::cout << "Long task completed" << std::endl;
}

int main() {
    auto future = std::async(std::launch::async, longRunningTask);
    
    std::cout << "Waiting for task to complete..." << std::endl;
    future.wait();
    std::cout << "Task finished" << std::endl;
    
    return 0;
}