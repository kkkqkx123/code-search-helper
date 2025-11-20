class MyClass {
private:
    int value;
public:
    MyClass(int v) : value(v) {}
    friend class FriendClass;
};

class FriendClass {
public:
    void accessPrivate(MyClass& obj) {
        // can access private members of MyClass
        obj.value = 0;
    }
};