#include <sys/socket.h>

int main() {
    int sockfd = socket(AF_INET, SOCK_STREAM, 0);
    struct sockaddr_in addr;
    
    // bind测试
    bind(sockfd, (struct sockaddr*)&addr, sizeof(addr));
    
    return 0;
}