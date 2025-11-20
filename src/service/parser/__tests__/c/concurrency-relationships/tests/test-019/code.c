#include <stdatomic.h>

int main() {
    // atomic_thread_fence测试
    atomic_thread_fence(memory_order_seq_cst);
    
    // __atomic_thread_fence测试
    __atomic_thread_fence(__ATOMIC_SEQ_CST);
    
    return 0;
}