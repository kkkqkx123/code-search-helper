int main() {
    int x, y, z;
    
    // 简单赋值
    x = 10;
    y = 20;
    
    // 复合赋值
    x += 5;
    y -= 3;
    z *= 2;
    
    // 链式赋值
    x = y = z = 100;
    
    // 数组元素赋值
    int arr[10];
    arr[0] = 1;
    arr[1] = arr[0] + 1;
    
    // 指针赋值
    int* ptr;
    ptr = &x;
    *ptr = 50;
    
    return 0;
}