#include <thread>
#include <iostream>

void backgroundTask() {
    std::cout << "Background task running" << std::endl;
}

int main() {
    std::thread t(backgroundTask);
    t.detach();  // 分离线程，让其独立运行
    return 0;
}