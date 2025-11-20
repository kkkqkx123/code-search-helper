#include <mutex>
#include <thread>

std::mutex mtx;
int sharedData = 0;

void incrementData() {
    mtx.lock();
    sharedData++;
    mtx.unlock();
}

int main() {
    std::thread t1(incrementData);
    std::thread t2(incrementData);
    
    t1.join();
    t2.join();
    
    return 0;
}