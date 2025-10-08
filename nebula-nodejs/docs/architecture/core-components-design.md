# Nebula Node.js SDK 核心组件详细设计

## 1. 客户端组件 (Client)

### 1.1 设计目标

- 提供简单易用的 API 接口
- 管理连接池和负载均衡
- 处理故障转移和重连
- 支持事件驱动的编程模型

### 1.2 核心属性

```typescript
class Client extends EventEmitter {
    private clientOption: ClientOption;      // 客户端配置
    private connections: Connection[];        // 连接池
    private taskQueue: Task[];               // 任务队列
    private connectionGuarders: any[];      // 连接守护器
}
```

### 1.3 关键方法

#### execute(command, returnOriginalData)
- **功能**: 执行 Nebula 命令
- **参数**: 
  - `command`: string - 要执行的命令
  - `returnOriginalData`: boolean - 是否返回原始数据
- **返回值**: Promise<any> - 解析后的数据或原始数据
- **设计要点**:
  - 从连接池选择可用连接
  - 支持任务队列和负载均衡
  - 提供超时控制
  - 错误处理和重试机制

#### close()
- **功能**: 关闭客户端和所有连接
- **返回值**: Promise<any>
- **设计要点**:
  - 优雅关闭所有连接
  - 清理资源
  - 处理未完成的任务

### 1.4 事件处理

| 事件名称 | 触发时机 | 参数 |
|---------|---------|------|
| `ready` | 连接就绪 | `{sender}` - 连接实例 |
| `error` | 发生错误 | `{sender, error}` - 连接实例和错误信息 |
| `connected` | 连接建立 | `{sender}` - 连接实例 |
| `authorized` | 认证成功 | `{sender}` - 连接实例 |
| `reconnecting` | 正在重连 | `{sender, retryInfo}` - 连接实例和重试信息 |
| `close` | 连接关闭 | `{sender}` - 连接实例 |

### 1.5 设计亮点

1. **连接池管理**: 使用数组维护连接池，支持动态扩缩容
2. **负载均衡**: 轮询算法选择连接，支持权重配置
3. **故障检测**: 心跳机制检测连接健康状态
4. **自动重连**: 指数退避算法实现智能重连

## 2. 连接组件 (Connection)

### 2.1 设计目标

- 管理单个 Nebula 服务器连接
- 处理认证和会话管理
- 提供命令执行接口
- 维护连接状态

### 2.2 核心属性

```typescript
class Connection extends EventEmitter {
    private connectionOption: ConnectionOption;  // 连接配置
    private connection: any;                     // Thrift 连接
    private client: any;                       // Thrift 客户端
    private sessionId: number;                   // 会话 ID
    public connectionId: string;                 // 连接 ID
    public isReady: boolean;                     // 就绪状态
    public isBusy: boolean;                      // 忙碌状态
}
```

### 2.3 关键方法

#### prepare()
- **功能**: 准备连接（建立连接并进行认证）
- **设计要点**:
  - 异步建立 Thrift 连接
  - 执行认证流程
  - 设置会话参数
  - 启动心跳定时器

#### run(task)
- **功能**: 执行具体任务
- **参数**: `Task` - 任务对象
- **设计要点**:
  - 设置连接忙碌状态
  - 执行超时控制
  - 结果处理和错误处理
  - 清理和状态恢复

#### ping(timeout)
- **功能**: 心跳检测
- **参数**: `timeout` - 超时时间（毫秒）
- **返回值**: Promise<boolean> - 是否成功
- **设计要点**:
  - 发送 ping 命令
  - 超时处理
  - 错误处理

### 2.4 状态管理

```
状态转换图：

Disconnected → Connecting → Authenticating → Ready
     ↑              ↓              ↓          ↓
     ←------------ Error ←-------- Timeout   Busy
                           ↓
                       Closed
```

### 2.5 设计亮点

1. **状态机设计**: 清晰的状态转换逻辑
2. **超时控制**: 多层次超时机制
3. **资源管理**: 连接生命周期管理
4. **错误处理**: 细粒度的错误分类和处理

## 3. 数据解析器 (Parser)

### 3.1 设计目标

- 解析 Nebula 返回的复杂数据结构
- 支持多种数据类型
- 提供统一的解析接口
- 处理嵌套数据结构

### 3.2 解析器架构

```
Parser (入口)
├── Dataset Parser (数据集)
├── Vertex Parser (顶点)
├── Edge Parser (边)
├── Path Parser (路径)
├── Value Parser (值)
├── List Parser (列表)
├── Map Parser (映射)
├── Set Parser (集合)
└── Utils (工具函数)
```

### 3.3 核心解析器

#### Dataset Parser
- **功能**: 解析数据集结构
- **输入**: Nebula 响应数据
- **输出**: 结构化的数据集对象
- **处理逻辑**:
  - 解析列定义
  - 解析行数据
  - 处理每行的多个值

#### Vertex Parser
- **功能**: 解析顶点数据
- **输入**: 顶点原始数据
- **输出**: 标准化的顶点对象
- **处理逻辑**:
  - 提取顶点 ID
  - 解析标签信息
  - 处理属性数据

#### Edge Parser
- **功能**: 解析边数据
- **输入**: 边原始数据
- **输出**: 标准化的边对象
- **处理逻辑**:
  - 提取源顶点和目标顶点
  - 解析边类型
  - 处理边属性
  - 处理排名信息

#### Value Parser
- **功能**: 解析各种值类型
- **输入**: 值原始数据
- **输出**: JavaScript 对应类型的值
- **支持类型**:
  - 基本类型: int, float, string, bool
  - 时间类型: date, datetime, timestamp
  - 复杂类型: list, map, set
  - 特殊类型: vertex, edge, path

### 3.4 设计亮点

1. **递归解析**: 支持嵌套数据结构的深度解析
2. **类型安全**: TypeScript 类型定义确保数据类型正确
3. **错误处理**: 解析错误不会中断整个流程
4. **性能优化**: 延迟解析和缓存机制

## 4. 原生模块 (Native Module)

### 4.1 设计目标

- 提供高性能的计算能力
- 处理 JavaScript 不擅长的操作
- 优化内存使用
- 提供底层功能支持

### 4.2 核心功能

#### hash64 函数
- **功能**: 计算字符串的 64位哈希值
- **算法**: MurmurHash3
- **输入**: 字符串
- **输出**: 两个 64位哈希值（数组）
- **应用场景**: 数据分片、快速查找

#### bytesToLongLongString 函数
- **功能**: 将字节数组转换为长整型字符串
- **输入**: 8个字节的数组
- **输出**: 长整型字符串表示
- **应用场景**: 处理 Nebula 的 64位整数

### 4.3 C++ 实现

```cpp
// 主要功能模块
addon.cc
├── BytesToLongLongString()  // 字节转换
├── Hash64()                 // 哈希计算
└── Init()                   // 模块初始化
```

### 4.4 性能优化

1. **内存管理**: 直接在 C++ 层处理数据，避免 JavaScript 层的内存拷贝
2. **算法优化**: 使用高效的 MurmurHash3 算法
3. **并行处理**: 支持多线程环境下的安全调用
4. **错误处理**: 完善的参数验证和错误处理

## 5. Thrift 协议栈

### 5.1 设计目标

- 提供完整的 Thrift 协议支持
- 支持多种传输方式
- 支持多种协议格式
- 高性能的网络通信

### 5.2 架构设计

```
Thrift Stack
├── Transport Layer (传输层)
│   ├── TBufferedTransport
│   ├── TFramedTransport
│   ├── TSocket
│   └── ...
├── Protocol Layer (协议层)
│   ├── TBinaryProtocol
│   ├── TJSONProtocol
│   ├── TCompactProtocol
│   └── ...
└── Connection Layer (连接层)
    ├── Connection
    ├── HttpConnection
    ├── WSConnection
    └── ...
```

### 5.3 传输层设计

#### TBufferedTransport
- **特点**: 缓冲传输，提高小数据包的传输效率
- **应用场景**: 普通的数据传输

#### TFramedTransport
- **特点**: 帧传输，每个数据包有明确的边界
- **应用场景**: 需要消息边界的场景

### 5.4 协议层设计

#### TBinaryProtocol
- **特点**: 二进制协议，高效紧凑
- **应用场景**: 高性能场景

#### TJSONProtocol
- **特点**: JSON 协议，可读性好
- **应用场景**: 调试和开发阶段

#### TCompactProtocol
- **特点**: 压缩协议，节省带宽
- **应用场景**: 网络带宽受限的环境

### 5.5 连接层设计

#### Connection
- **特点**: 基础的 Socket 连接
- **功能**: 建立 TCP 连接，维护连接状态

#### HttpConnection
- **特点**: HTTP 传输
- **功能**: 通过 HTTP 协议传输 Thrift 数据

#### WSConnection
- **特点**: WebSocket 传输
- **功能**: 通过 WebSocket 协议传输 Thrift 数据

## 6. 配置管理

### 6.1 客户端配置 (ClientOption)

```typescript
interface ClientOption {
    servers: string[] | Endpoint[];      // 服务器列表
    userName: string;                     // 用户名
    password: string;                     // 密码
    space: string;                        // 图空间
    poolSize?: number;                    // 连接池大小
    bufferSize?: number;                  // 缓冲区大小
    executeTimeout?: number;              // 执行超时
    pingInterval?: number;                // 心跳间隔
}
```

### 6.2 连接配置 (ConnectionOption)

```typescript
interface ConnectionOption {
    host: string;                         // 主机地址
    port: number;                         // 端口号
    userName: string;                     // 用户名
    password: string;                     // 密码
    space: string;                        // 图空间
}
```

### 6.3 配置验证

- 必填字段验证
- 数值范围验证
- 类型验证
- 默认值设置

## 7. 错误处理设计

### 7.1 错误类型

#### NebulaError
- **基础错误类**: 所有 Nebula 相关错误的基类
- **属性**: 错误码、错误消息、错误详情

#### ConnectionError
- **连接错误**: 网络连接相关错误
- **场景**: 连接失败、连接超时、认证失败

#### ExecutionError
- **执行错误**: 命令执行相关错误
- **场景**: 语法错误、权限错误、超时错误

#### ParserError
- **解析错误**: 数据解析相关错误
- **场景**: 格式错误、类型错误、数据损坏

### 7.2 错误处理策略

1. **分级处理**: 根据错误严重程度采取不同的处理策略
2. **重试机制**: 对临时性错误进行重试
3. **降级处理**: 在错误发生时提供降级服务
4. **错误恢复**: 自动从错误状态中恢复

### 7.3 错误传播

```
底层错误 → 连接层 → 客户端层 → 应用层
     ↓         ↓        ↓        ↓
   网络错误  连接错误  执行错误  业务错误
```

## 8. 性能监控

### 8.1 监控指标

#### 连接指标
- 连接数（总数、活跃数、空闲数）
- 连接成功率
- 连接平均建立时间
- 连接错误率

#### 执行指标
- 命令执行次数
- 平均执行时间
- 执行成功率
- 超时率

#### 资源指标
- 内存使用量
- CPU 使用率
- 网络吞吐量
- 队列长度

### 8.2 监控实现

1. **事件收集**: 通过 EventEmitter 收集各种事件
2. **指标计算**: 实时计算各种性能指标
3. **数据存储**: 将监控数据存储到时序数据库
4. **可视化**: 通过图表展示监控数据

## 总结

Nebula Node.js SDK 的核心组件设计体现了以下特点：

1. **高内聚低耦合**: 每个组件职责单一，组件间依赖关系清晰
2. **可扩展性**: 支持多种协议、传输方式和数据格式
3. **高性能**: 原生模块优化 + 连接池 + 异步处理
4. **高可靠性**: 完善的错误处理、重试机制和故障转移
5. **易用性**: 简洁的 API 设计、丰富的事件机制和详细的文档

这些设计使得 SDK 能够稳定、高效地支持各种规模的图数据库应用。