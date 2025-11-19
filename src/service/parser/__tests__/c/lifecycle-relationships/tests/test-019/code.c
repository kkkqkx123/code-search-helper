#include <sys/socket.h>

int main() {
    int sockfd = socket(AF_INET, SOCK_STREAM, 0);
    
    // listen测试
    listen(sockfd, 5);
    
    return 0;
}