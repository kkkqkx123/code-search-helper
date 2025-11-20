#include <future>
#include <iostream>
#include <functional>

int multiply(int a, int b) {
    return a * b;
}

int main() {
    std::packaged_task<int(int, int)> task(multiply);
    std::future<int> result = task.get_future();
    
    std::thread t(std::move(task), 6, 7);
    
    std::cout << "Waiting for packaged task result" << std::endl;
    int value = result.get();
    std::cout << "Packaged task result: " << value << std::endl;
    
    t.join();
    return 0;
}