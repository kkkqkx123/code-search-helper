#include <latch>
#include <thread>
#include <iostream>

std::latch completionLatch(3);

void workerTask(int id) {
    std::cout << "Worker " << id << " completed task" << std::endl;
    completionLatch.count_down();
}

void waitForCompletion() {
    completionLatch.wait();
    std::cout << "All workers completed" << std::endl;
}

int main() {
    std::thread t1(workerTask, 1);
    std::thread t2(workerTask, 2);
    std::thread t3(workerTask, 3);
    std::thread t4(waitForCompletion);
    
    t1.join();
    t2.join();
    t3.join();
    t4.join();
    
    return 0;
}