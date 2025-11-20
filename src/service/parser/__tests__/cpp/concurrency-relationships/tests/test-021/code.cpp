#include <future>
#include <iostream>

int computeResult() {
    return 100;
}

int main() {
    auto future = std::async(std::launch::async, computeResult);
    
    std::cout << "Doing other work..." << std::endl;
    
    int result = future.get();
    std::cout << "Computed result: " << result << std::endl;
    
    return 0;
}