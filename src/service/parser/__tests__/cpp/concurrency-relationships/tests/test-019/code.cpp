#include <future>
#include <iostream>

int asyncTask() {
    std::cout << "Async task running" << std::endl;
    return 42;
}

int main() {
    auto future = std::async(asyncTask);
    
    std::cout << "Main thread continues" << std::endl;
    
    int result = future.get();
    std::cout << "Async task result: " << result << std::endl;
    
    return 0;
}