class FriendExample {
private:
    int value;
public:
    FriendExample(int v) : value(v) {}
    
    friend void friendFunction(FriendExample& obj);
    friend class FriendClass;
};