#define DEBUG

#ifdef DEBUG
    #define LOG(msg) printf("DEBUG: %s\n", msg)
#else
    #define LOG(msg)
#endif

#ifndef MAX_BUFFER_SIZE
    #define MAX_BUFFER_SIZE 1024
#endif

int main() {
    LOG("Application started");
    char buffer[MAX_BUFFER_SIZE];
    LOG("Buffer allocated");
    return 0;
}