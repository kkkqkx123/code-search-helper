#include <thread>
#include <iostream>

void task() {
    std::cout << "Task is running" << std::endl;
}

int main() {
    std::thread t(task);
    t.join();  // 等待线程完成
    return 0;
}