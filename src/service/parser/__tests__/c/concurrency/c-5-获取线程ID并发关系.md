## 5. 获取线程ID并发关系

### 查询规则
```
(call_expression) @concurrency.relationship.thread.id
  function: (identifier) @thread.id.function
  (#match? @thread.id.function "^(pthread_self)$")
  arguments: (argument_list)
```

### 测试用例
```c
#include <pthread.h>
#include <stdio.h>

void* thread_function(void* arg) {
    // pthread_self测试
    pthread_t tid = pthread_self();
    printf("Thread ID: %lu\n", tid);
    return NULL;
}

int main() {
    pthread_t thread;
    
    pthread_create(&thread, NULL, thread_function, NULL);
    
    return 0;
}
```

### 查询结果