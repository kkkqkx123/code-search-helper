int main() {
    // 局部变量作用域开始测试
    {
        int local_var = 42;
        char str[] = "Hello";
        // 使用局部变量
        printf("%d\n", local_var);
    }
    
    return 0;
}