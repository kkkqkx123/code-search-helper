#include <future>
#include <iostream>
#include <thread>

int sharedTask() {
    std::cout << "Shared task executing" << std::endl;
    return 200;
}

int main() {
    std::shared_future<int> sharedFuture = std::async(sharedTask);
    
    std::thread t1([&]() {
        int result = sharedFuture.get();
        std::cout << "Thread 1 got result: " << result << std::endl;
    });
    
    std::thread t2([&]() {
        int result = sharedFuture.get();
        std::cout << "Thread 2 got result: " << result << std::endl;
    });
    
    t1.join();
    t2.join();
    
    return 0;
}