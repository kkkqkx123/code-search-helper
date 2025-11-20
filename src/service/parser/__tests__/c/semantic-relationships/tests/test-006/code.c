#include <stdio.h>

// 基本类型别名
typedef unsigned int uint32_t;
typedef long long int64_t;

// 结构体类型别名
struct Person {
    char name[50];
    int age;
};

typedef struct Person PersonAlias;

int main() {
    uint32_t value = 42;
    int64_t big_value = 1234567890LL;
    
    PersonAlias person = {"Alice", 30};
    
    printf("Value: %u\n", value);
    printf("Big Value: %lld\n", big_value);
    printf("Person: %s, Age: %d\n", person.name, person.age);
    
    return 0;
}