#include <coroutine>
#include <iostream>

struct Generator {
    struct promise_type {
        int current_value;
        
        Generator get_return_object() {
            return Generator{std::coroutine_handle<promise_type>::from_promise(*this)};
        }
        std::suspend_always initial_suspend() { return {}; }
        std::suspend_always final_suspend() noexcept { return {}; }
        std::suspend_always yield_value(int value) {
            current_value = value;
            return {};
        }
        void return_void() {}
        void unhandled_exception() {}
    };
    
    std::coroutine_handle<promise_type> h;
    Generator(std::coroutine_handle<promise_type> handle) : h(handle) {}
    ~Generator() { if (h) h.destroy(); }
    
    bool next() {
        h.resume();
        return !h.done();
    }
    
    int value() {
        return h.promise().current_value;
    }
};

Generator numberGenerator() {
    for (int i = 0; i < 5; ++i) {
        co_yield i;
    }
}

int main() {
    auto gen = numberGenerator();
    
    while (gen.next()) {
        std::cout << "Generated: " << gen.value() << std::endl;
    }
    
    return 0;
}