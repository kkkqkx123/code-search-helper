#define PLATFORM 2

#if PLATFORM == 1
    #define OS_NAME "Windows"
#elif PLATFORM == 2
    #define OS_NAME "Linux"
#elif PLATFORM == 3
    #define OS_NAME "macOS"
#else
    #define OS_NAME "Unknown"
#endif

int main() {
    printf("Running on %s\n", OS_NAME);
    return 0;
}