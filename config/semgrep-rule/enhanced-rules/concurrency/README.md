# 并发问题检测规则 (Concurrency Rules)

这个文件夹包含了专门用于检测并发相关问题的 Semgrep 规则，包括死锁、竞态条件、线程安全等。

## 规则分类

### 1. 死锁检测 (deadlock-detection.yml)
- **deadlock-potential-synchronized-blocks**: 检测嵌套同步块可能导致的死锁
- **deadlock-potential-lock-acquisition-order**: 检测不一致的锁获取顺序
- **deadlock-potential-reentrant-lock**: 检测ReentrantLock使用中的潜在死锁

### 2. 竞态条件检测 (race-condition-detection.yml)
- **race-condition-shared-variable-access**: 检测共享变量的非同步访问
- **race-condition-unsynchronized-map-access**: 检测非同步的Map/List访问
- **race-condition-static-variable**: 检测静态变量的竞态条件

### 2.1 增强版竞态条件检测 (enhanced-race-condition-detection.yml)
- **race-condition-shared-variable-assignment**: 共享变量赋值竞态条件
- **race-condition-concurrent-map-access**: 并发Map访问竞态条件
- **race-condition-counter-increment**: 计数器递增竞态条件
- **race-condition-file-access**: 文件访问竞态条件
- **race-condition-resource-pool**: 资源池管理竞态条件
- **race-condition-async-operation**: 异步操作竞态条件

### 2.2 多语言竞态条件检测 (multi-language-race-condition-detection.yml)

#### Java支持
- **race-condition-shared-variable-java**: Java共享变量竞态条件
- **race-condition-collection-java**: Java集合访问竞态条件
- **race-condition-static-java**: Java静态变量竞态条件
- **race-condition-counter-java**: Java计数器递增竞态条件
- **race-condition-file-java**: Java文件访问竞态条件
- **race-condition-thread-java**: Java线程创建竞态条件

#### Python支持
- **race-condition-shared-variable-python**: Python共享变量竞态条件
- **race-condition-collection-python**: Python字典访问竞态条件
- **race-condition-static-python**: Python全局变量竞态条件
- **race-condition-counter-python**: Python计数器递增竞态条件
- **race-condition-file-python**: Python文件访问竞态条件
- **race-condition-async-python**: Python异步操作竞态条件
- **race-condition-thread-python**: Python线程创建竞态条件

#### JavaScript/TypeScript支持
- **race-condition-shared-variable-js**: JS共享变量竞态条件
- **race-condition-collection-js**: JS集合访问竞态条件
- **race-condition-static-js**: JS全局变量竞态条件
- **race-condition-counter-js**: JS计数器递增竞态条件
- **race-condition-file-js**: JS文件访问竞态条件
- **race-condition-async-js**: JS异步操作竞态条件
- **race-condition-thread-js**: JS线程创建竞态条件

### 3. 线程安全问题 (thread-safety-issues.yml)
- **thread-safety-simpledateformat**: 检测非线程安全的SimpleDateFormat使用
- **thread-safety-calendar-instance**: 检测非线程安全的Calendar使用
- **thread-safety-mutable-static-fields**: 检测可变的静态字段
- **thread-safety-unsafe-publication**: 检测不安全对象发布

### 4. 并发最佳实践 (concurrency-best-practices.yml)
- **concurrency-use-concurrent-collections**: 建议使用并发集合
- **concurrency-prefer-executorservice**: 建议使用ExecutorService
- **concurrency-avoid-wait-notify**: 避免使用wait/notify
- **concurrency-use-atomic-variables**: 建议使用原子变量
- **concurrency-avoid-thread-local-improperly**: 正确使用ThreadLocal

### 5. 异步编程问题 (async-programming-issues.yml)
- **async-future-get-with-timeout**: Future.get()应使用超时
- **async-completablefuture-exception-handling**: CompletableFuture异常处理
- **async-avoid-busy-waiting**: 避免忙等待
- **async-resource-cleanup**: 异步资源清理
- **async-avoid-blocking-in-callbacks**: 避免在回调中阻塞

## 使用方法

### 验证规则
```bash
# 验证所有并发规则
semgrep --validate --config=./concurrency/

# 验证单个规则文件
semgrep --validate --config=./concurrency/deadlock-detection.yml
```

### 运行规则
```bash
# 运行所有并发规则检测
semgrep --config=./concurrency/ /path/to/source/code

# 运行特定类型的规则
semgrep --config=./concurrency/deadlock-detection.yml /path/to/source/code
semgrep --config=./concurrency/race-condition-detection.yml /path/to/source/code
```

### 集成到CI/CD
```yaml
# .github/workflows/semgrep.yml
name: Semgrep Concurrency Check
on: [push, pull_request]
jobs:
  semgrep-concurrency:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: returntocorp/semgrep-action@v1
        with:
          config: >-
            d:/ide/tool/codebase-index/enhanced-rules/concurrency/
```

## 支持的语言

- Java (主要支持)
- JavaScript/TypeScript (部分规则)
- Python (部分规则)

## 规则严重性级别

- **ERROR**: 可能导致程序错误或数据不一致的严重问题
- **WARNING**: 需要审查的潜在问题
- **INFO**: 最佳实践建议

## 参考文档

- [Oracle Java Concurrency Tutorial](https://docs.oracle.com/javase/tutorial/essential/concurrency/)
- [SEI CERT Java Concurrency Guidelines](https://wiki.sei.cmu.edu/confluence/display/java/Concurrency)
- [Java Concurrency in Practice](https://jcip.net/)