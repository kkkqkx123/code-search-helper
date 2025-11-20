#include <vector>
#include <thread>
#include <queue>
#include <mutex>
#include <functional>
#include <iostream>

class ThreadPool {
private:
    std::vector<std::thread> workers;
    std::queue<std::function<void()>> tasks;
    std::mutex queueMutex;
    
public:
    ThreadPool(size_t threads) {
        for (size_t i = 0; i < threads; ++i) {
            workers.emplace_back([this] {
                while (true) {
                    std::function<void()> task;
                    {
                        std::unique_lock<std::mutex> lock(queueMutex);
                        if (tasks.empty()) {
                            break;
                        }
                        task = tasks.front();
                        tasks.pop();
                    }
                    task();
                }
            });
        }
    }
    
    ~ThreadPool() {
        for (std::thread &worker : workers) {
            worker.join();
        }
    }
    
    void enqueue(std::function<void()> task) {
        {
            std::unique_lock<std::mutex> lock(queueMutex);
            tasks.push(task);
        }
    }
};

int main() {
    ThreadPool pool(4);
    
    for (int i = 0; i < 8; ++i) {
        pool.enqueue([i] {
            std::cout << "Task " << i << " executed" << std::endl;
        });
    }
    
    return 0;
}