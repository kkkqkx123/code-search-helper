#include <barrier>
#include <thread>
#include <iostream>

std::barrier syncPoint(3);

void synchronizedTask(int id) {
    std::cout << "Thread " << id << " reached barrier" << std::endl;
    syncPoint.arrive_and_wait();
    std::cout << "Thread " << id << " passed barrier" << std::endl;
}

int main() {
    std::thread t1(synchronizedTask, 1);
    std::thread t2(synchronizedTask, 2);
    std::thread t3(synchronizedTask, 3);
    
    t1.join();
    t2.join();
    t3.join();
    
    return 0;
}