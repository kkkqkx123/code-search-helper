#define VERSION 2

#if VERSION == 1
    printf("Version 1 code\n");
#elif VERSION == 2
    printf("Version 2 code\n");
#else
    printf("Unknown version\n");
#endif

#if defined(DEBUG)
    printf("Debug mode enabled\n");
#endif

int main() {
#if VERSION > 1
    printf("Using enhanced features\n");
#endif
    return 0;
}