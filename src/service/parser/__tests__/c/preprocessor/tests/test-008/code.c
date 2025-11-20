#define ENABLE_FEATURE_X

#ifdef ENABLE_FEATURE_X
    void feature_x() {
        printf("Feature X is enabled\n");
    }
#else
    void feature_x() {
        // Feature X is disabled
    }
#endif

#ifndef DISABLE_LOGGING
    #define LOG(msg) printf("LOG: %s\n", msg)
#else
    #define LOG(msg)
#endif

int main() {
    feature_x();
    LOG("Application started");
    return 0;
}