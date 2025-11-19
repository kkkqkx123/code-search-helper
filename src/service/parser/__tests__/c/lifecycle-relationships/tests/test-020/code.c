#include <sys/socket.h>
#include <winsock2.h>

int main() {
    int sockfd = socket(AF_INET, SOCK_STREAM, 0);
    SOCKET listen_sock = socket(AF_INET, SOCK_STREAM, 0);
    
    // accept测试
    int client_fd = accept(sockfd, NULL, NULL);
    
    // WSAAccept测试
    SOCKET client_sock = WSAAccept(listen_sock, NULL, NULL, NULL, 0);
    
    return 0;
}