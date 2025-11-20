#include <queue>
#include <mutex>
#include <condition_variable>
#include <thread>
#include <iostream>

template<typename T>
class ProducerConsumerQueue {
private:
    std::queue<T> queue;
    std::mutex mtx;
    std::condition_variable cv;
    
public:
    void push(const T& item) {
        std::lock_guard<std::mutex> lock(mtx);
        queue.push(item);
        cv.notify_one();
    }
    
    T pop() {
        std::unique_lock<std::mutex> lock(mtx);
        cv.wait(lock, [this]{ return !queue.empty(); });
        T item = queue.front();
        queue.pop();
        return item;
    }
};

int main() {
    ProducerConsumerQueue<int> pcQueue;
    
    auto producer = [&]() {
        for (int i = 0; i < 5; ++i) {
            pcQueue.push(i);
            std::cout << "Produced: " << i << std::endl;
        }
    };
    
    auto consumer = [&]() {
        for (int i = 0; i < 5; ++i) {
            int item = pcQueue.pop();
            std::cout << "Consumed: " << item << std::endl;
        }
    };
    
    std::thread t1(producer);
    std::thread t2(consumer);
    
    t1.join();
    t2.join();
    
    return 0;
}