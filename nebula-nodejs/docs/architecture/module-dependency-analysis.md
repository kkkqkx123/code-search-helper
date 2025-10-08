# Nebula Node.js SDK 模块依赖关系分析

## 依赖关系图

```
index.js (入口模块)
    ├── nebula/ (Nebula 核心模块)
    │   ├── Client.js (客户端主类)
    │   │   ├── types.js (类型定义)
    │   │   ├── Connection.js (连接管理)
    │   │   └── parser/ (数据解析器)
    │   │       ├── index.js (解析器入口)
    │   │       ├── dataset.js (数据集解析)
    │   │       ├── vertex.js (顶点解析)
    │   │       ├── edge.js (边解析)
    │   │       ├── path.js (路径解析)
    │   │       ├── list.js (列表解析)
    │   │       ├── map.js (映射解析)
    │   │       ├── set.js (集合解析)
    │   │       ├── value.js (值解析)
    │   │       └── utils.js (解析工具)
    │   ├── Connection.js (连接实现)
    │   │   ├── types.js (类型定义)
    │   │   └── thrift/ (Thrift 通信)
    │   └── parser/ (数据解析)
    └── native/ (原生模块)
        ├── index.js (原生模块接口)
        └── addon.cc (C++ 实现)
            └── MurmurHash3.cc (哈希算法)

thrift/ (Thrift 协议栈)
    ├── index.js (Thrift 入口)
    ├── connection.js (连接管理)
    ├── transport.js (传输层)
    ├── protocol.js (协议层)
    ├── binary_protocol.js (二进制协议)
    ├── json_protocol.js (JSON 协议)
    ├── buffered_transport.js (缓冲传输)
    ├── framed_transport.js (帧传输)
    └── ... (其他协议和传输实现)
```

## 模块详细分析

### 1. 入口模块 (index.js)

**依赖关系**:
- `nebula` 模块: 获取 Client、Connection、createClient、parser
- `native` 模块: 获取 hash64、bytesToLongLongString

**职责**:
- 统一导出所有公共 API
- 提供默认导出 createClient 函数

### 2. Nebula 核心模块 (nebula/)

#### 2.1 主入口 (nebula/index.js)

**依赖关系**:
- `Client`: 客户端主类
- `Connection`: 连接管理类
- `parser`: 数据解析器

**职责**:
- 导出核心类和函数
- 提供 createClient 工厂函数

#### 2.2 客户端类 (nebula/Client.js)

**依赖关系**:
- `types.js`: 类型定义（ClientOption、Task 等）
- `Connection.js`: 连接管理
- `parser/`: 数据解析器
- Node.js 内置模块: `events`

**职责**:
- 管理连接池
- 处理任务队列
- 提供命令执行接口
- 事件发布

#### 2.3 连接类 (nebula/Connection.js)

**依赖关系**:
- `types.js`: 类型定义（ConnectionOption、ConnectionInfo、Task 等）
- `thrift/`: Thrift 通信协议
- Node.js 内置模块: `events`

**职责**:
- 维护单个 Nebula 连接
- 处理认证和会话管理
- 执行具体命令
- 心跳检测

#### 2.4 数据解析器 (nebula/parser/)

**依赖关系**:
- 内部模块相互依赖
- 无外部依赖（纯逻辑处理）

**职责**:
- 解析 Nebula 返回的各种数据类型
- 提供统一的 traverse 接口

### 3. 原生模块 (native/)

#### 3.1 接口层 (native/index.js)

**依赖关系**:
- `bindings`: Node.js 原生模块绑定
- `lodash`: 工具函数库

**职责**:
- 封装 C++ 原生功能
- 提供 JavaScript 友好的 API

#### 3.2 C++ 实现层 (native/addon.cc)

**依赖关系**:
- Node.js N-API
- MurmurHash3 算法实现

**职责**:
- 高性能哈希计算
- 字节到长整型转换

### 4. Thrift 协议栈 (thrift/)

**依赖关系**:
- `node-int64`: 64位整数处理
- `q`: Promise 库
- `ws`: WebSocket 支持

**职责**:
- 提供完整的 Thrift 协议实现
- 支持多种传输方式和协议格式
- 处理底层网络通信

## 依赖强度分析

### 强依赖 (核心依赖)

1. **nebula → types**: 类型定义是所有模块的基础
2. **Client → Connection**: 客户端依赖连接管理
3. **Connection → thrift**: 连接依赖 Thrift 通信
4. **native → bindings**: 原生模块依赖 Node.js 绑定机制

### 中等依赖 (功能依赖)

1. **Client → parser**: 客户端需要数据解析功能
2. **thrift → node-int64**: Thrift 需要 64位整数支持
3. **native → lodash**: 原生接口层需要工具函数

### 弱依赖 (工具依赖)

1. **thrift → q**: Thrift 使用 Promise 库
2. **thrift → ws**: WebSocket 支持（可选）

## 循环依赖检查

经过分析，该 SDK 模块间**不存在循环依赖**，依赖关系呈现清晰的层次结构：

```
index.js → nebula/ → types.js (底层)
index.js → native/ → bindings (底层)
nebula/Client → nebula/Connection → thrift/ (层次化)
```

## 依赖管理建议

### 1. 版本管理

- 锁定关键依赖的版本（如 bindings、node-int64）
- 定期更新依赖以获取安全补丁
- 测试新版本兼容性

### 2. 依赖优化

- 评估 lodash 的使用范围，考虑替换为轻量级替代方案
- 检查 q Promise 库的必要性，考虑使用原生 Promise
- 优化 thrift 模块的依赖大小

### 3. 依赖解耦

- 将 parser 模块设计为可插拔组件
- 提供 thrift 传输层的抽象接口
- 考虑将原生模块设为可选依赖

## 外部依赖风险评估

### 高风险依赖

1. **bindings**: 原生模块绑定的稳定性关键
2. **node-int64**: 64位整数处理的核心依赖

### 中等风险依赖

1. **lodash**: 广泛使用但需要关注体积
2. **q**: 较老的 Promise 库，维护状态需关注

### 低风险依赖

1. **ws**: WebSocket 支持，功能相对独立
2. **browser-or-node**: 环境检测，功能简单稳定

## 总结

Nebula Node.js SDK 的模块依赖关系设计合理，呈现清晰的层次结构。依赖关系遵循单向依赖原则，避免了循环依赖的问题。外部依赖选择较为谨慎，但仍需关注部分依赖的版本管理和维护状态。建议持续优化依赖结构，提高模块的独立性和可维护性。