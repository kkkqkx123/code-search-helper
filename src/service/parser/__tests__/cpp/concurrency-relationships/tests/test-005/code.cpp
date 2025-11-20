#include <mutex>
#include <thread>

std::mutex mtx;
int sharedResource = 0;

void accessResource() {
    mtx.lock();
    sharedResource += 10;
    mtx.unlock();
}

int main() {
    std::thread t1(accessResource);
    std::thread t2(accessResource);
    
    t1.join();
    t2.join();
    
    return 0;
}