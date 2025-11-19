#include <sys/socket.h>
#include <winsock2.h>

int main() {
    // socket测试
    int sockfd = socket(AF_INET, SOCK_STREAM, 0);
    
    // WSASocket测试
    SOCKET sock = WSASocket(AF_INET, SOCK_STREAM, IPPROTO_TCP, NULL, 0, 0);
    
    return 0;
}