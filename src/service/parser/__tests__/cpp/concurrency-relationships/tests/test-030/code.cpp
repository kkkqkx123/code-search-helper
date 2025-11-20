#include <shared_mutex>
#include <iostream>

class ReadWriteLock {
private:
    std::shared_mutex rwMutex;
    
public:
    void readLock() {
        rwMutex.lock_shared();
        std::cout << "Read lock acquired" << std::endl;
    }
    
    void readUnlock() {
        rwMutex.unlock_shared();
        std::cout << "Read lock released" << std::endl;
    }
    
    void writeLock() {
        rwMutex.lock();
        std::cout << "Write lock acquired" << std::endl;
    }
    
    void writeUnlock() {
        rwMutex.unlock();
        std::cout << "Write lock released" << std::endl;
    }
};

int main() {
    ReadWriteLock rwLock;
    
    rwLock.readLock();
    rwLock.readUnlock();
    
    rwLock.writeLock();
    rwLock.writeUnlock();
    
    return 0;
}