#include <future>
#include <iostream>
#include <thread>

void setValueTask(std::promise<int> prom) {
    std::cout << "Setting promise value" << std::endl;
    prom.set_value(300);
}

int main() {
    std::promise<int> prom;
    std::future<int> fut = prom.get_future();
    
    std::thread t(setValueTask, std::move(prom));
    
    std::cout << "Waiting for promise value" << std::endl;
    int value = fut.get();
    std::cout << "Promise value: " << value << std::endl;
    
    t.join();
    return 0;
}