#include <sys/socket.h>
#include <unistd.h>
#include <winsock2.h>

int main() {
    int sockfd = socket(AF_INET, SOCK_STREAM, 0);
    SOCKET win_sock = socket(AF_INET, SOCK_STREAM, 0);
    
    // close测试
    close(sockfd);
    
    // closesocket测试
    closesocket(win_sock);
    
    // shutdown测试
    shutdown(sockfd, SHUT_RDWR);
    
    return 0;
}