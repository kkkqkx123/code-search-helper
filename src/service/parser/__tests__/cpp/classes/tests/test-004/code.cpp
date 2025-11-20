template<typename T>
class Vector {
private:
    T* data;
    size_t size;
public:
    Vector(size_t s) : size(s) {
        data = new T[size];
    }
    
    ~Vector() {
        delete[] data;
    }
};