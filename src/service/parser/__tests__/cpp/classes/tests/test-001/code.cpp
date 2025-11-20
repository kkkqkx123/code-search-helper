class MyClass {
public:
    int x;
    int y;
    
    MyClass(int x, int y) : x(x), y(y) {}
    
    int getX() const {
        return x;
    }
    
    int getY() const {
        return y;
    }
};