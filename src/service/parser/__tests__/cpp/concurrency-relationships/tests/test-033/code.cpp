#include <vector>
#include <algorithm>
#include <execution>
#include <iostream>

int main() {
    std::vector<int> data = {1, 2, 3, 4, 5};
    
    // 使用并行执行策略
    auto policy = std::execution::par;
    
    std::for_each(policy, data.begin(), data.end(), 
                  [](int& x) { x *= x; });
    
    std::cout << "Squared values: ";
    for (int val : data) {
        std::cout << val << " ";
    }
    std::cout << std::endl;
    
    return 0;
}