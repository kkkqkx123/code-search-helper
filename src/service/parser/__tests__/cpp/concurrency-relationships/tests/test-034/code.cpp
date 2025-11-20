#include <coroutine>
#include <iostream>

// 简化的协程返回类型
struct Task {
    struct promise_type {
        Task get_return_object() {
            return Task{std::coroutine_handle<promise_type>::from_promise(*this)};
        }
        std::suspend_never initial_suspend() { return {}; }
        std::suspend_never final_suspend() noexcept { return {}; }
        void return_void() {}
        void unhandled_exception() {}
    };
    
    std::coroutine_handle<promise_type> h;
    Task(std::coroutine_handle<promise_type> handle) : h(handle) {}
    ~Task() { if (h) h.destroy(); }
};

Task coroutineFunction() {
    std::cout << "Coroutine started" << std::endl;
    co_return;
}

int main() {
    auto task = coroutineFunction();
    return 0;
}