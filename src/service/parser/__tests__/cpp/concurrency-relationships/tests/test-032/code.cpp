#include <vector>
#include <algorithm>
#include <execution>
#include <iostream>

int main() {
    std::vector<int> numbers = {5, 2, 8, 1, 9, 3};
    
    // 并行排序
    std::sort(std::execution::par, numbers.begin(), numbers.end());
    
    std::cout << "Sorted numbers: ";
    for (int num : numbers) {
        std::cout << num << " ";
    }
    std::cout << std::endl;
    
    // 并行for_each
    std::for_each(std::execution::par, numbers.begin(), numbers.end(), 
                  [](int& n) { n *= 2; });
    
    std::cout << "Doubled numbers: ";
    for (int num : numbers) {
        std::cout << num << " ";
    }
    std::cout << std::endl;
    
    return 0;
}