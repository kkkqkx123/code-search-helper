// 注意：这是一个假设性的示例，因为C++事务内存扩展尚未标准化
#include <iostream>
#include <transaction>

int sharedData = 0;

void transactionalUpdate() {
    try {
        atomic {
            sharedData += 10;
            if (sharedData > 100) {
                atomic_cancel; // 取消事务
            }
        }
    } catch (const std::exception& e) {
        std::cout << "Transaction failed: " << e.what() << std::endl;
    }
}

int main() {
    transactionalUpdate();
    std::cout << "Final sharedData: " << sharedData << std::endl;
    return 0;
}