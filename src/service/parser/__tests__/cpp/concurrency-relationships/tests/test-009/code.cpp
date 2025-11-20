#include <mutex>
#include <condition_variable>
#include <thread>
#include <iostream>

std::mutex mtx;
std::condition_variable cv;
bool dataReady = false;

void waitForData() {
    std::unique_lock<std::mutex> lock(mtx);
    cv.wait(lock, []{ return dataReady; });
    std::cout << "Data received, processing..." << std::endl;
}

void prepareData() {
    {
        std::lock_guard<std::mutex> lock(mtx);
        dataReady = true;
    }
    cv.notify_one();
    std::cout << "Data prepared, notification sent" << std::endl;
}

int main() {
    std::thread t1(waitForData);
    std::thread t2(prepareData);
    
    t1.join();
    t2.join();
    
    return 0;
}