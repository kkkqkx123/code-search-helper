// 基本类型初始化
int count = 0;
float rate = 3.14;
char letter = 'A';

// 指针类型初始化
int* ptr = NULL;
char* str = "Hello";
void* data = malloc(100);

// 数组初始化
int arr[] = {1, 2, 3, 4, 5};
char name[] = "John";

// 结构体初始化
struct Config {
    int port;
    char* host;
} config = {8080, "localhost"};