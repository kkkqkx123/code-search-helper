// __thread测试
__thread int thread_local_var1;

// _Thread_local测试
_Thread_local int thread_local_var2;

// 线程本地存储的完整声明
__thread static int counter = 0;

int main() {
    // 使用线程本地变量
    thread_local_var1 = 42;
    thread_local_var2 = 24;
    counter++;
    
    return 0;
}