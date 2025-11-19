int main() {
    // 局部变量作用域结束测试
    {
        int local_var = 42;
        printf("%d\n", local_var);
    } // 作用域在此结束
    
    return 0;
}