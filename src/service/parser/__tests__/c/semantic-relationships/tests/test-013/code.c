#include <stdio.h>
#include <stdlib.h>

typedef struct {
    int* data;
    int size;
} IntArray;

IntArray create_array(int size) {
    IntArray arr;
    arr.size = size;
    arr.data = (int*)malloc(sizeof(int) * size);  // 资源分配
    return arr;
}

int main() {
    IntArray my_array = create_array(10);
    
    if (my_array.data != NULL) {
        for (int i = 0; i < my_array.size; i++) {
            my_array.data[i] = i;
        }
        
        printf("Array created with size %d\n", my_array.size);
        free(my_array.data);
    }
    
    return 0;
}