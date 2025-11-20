class Lifecycle {
private:
    int* data;
public:
    // 构造函数
    Lifecycle(int size) {
        data = new int[size];
    }
    
    // 析构函数
    ~Lifecycle() {
        delete[] data;
    }
};