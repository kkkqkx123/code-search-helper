class FriendClass {
private:
    int value;
public:
    FriendClass(int v) : value(v) {}
    
    friend void friendFunction(FriendClass& obj);
};

void friendFunction(FriendClass& obj) {
    // can access private members
    obj.value = 0;
}