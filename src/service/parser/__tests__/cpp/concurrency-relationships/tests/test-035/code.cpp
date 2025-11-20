#include <coroutine>
#include <iostream>

struct Awaiter {
    bool await_ready() { return false; }
    void await_suspend(std::coroutine_handle<>) {
        std::cout << "Coroutine suspended" << std::endl;
    }
    void await_resume() {
        std::cout << "Coroutine resumed" << std::endl;
    }
};

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

Task coroutineWithAwait() {
    std::cout << "Before await" << std::endl;
    co_await Awaiter{};
    std::cout << "After await" << std::endl;
}

int main() {
    auto task = coroutineWithAwait();
    return 0;
}