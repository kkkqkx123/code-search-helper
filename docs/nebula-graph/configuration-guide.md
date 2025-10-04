# Nebula Node.js 客户端配置指南

## 概述

`@nebula-contrib/nebula-nodejs` 是一个为 Nebula Graph 提供 Node.js 客户端 API 的库。该库内部实现了连接池机制，自动管理连接和会话，用户不需要手动创建或管理连接池。

## 主要特性

- **多服务器支持**：可以连接到多个 Nebula Graph 服务器
- **自动重连支持**：客户端会无限尝试重新连接，直到服务器再次可用
- **内置连接池**：客户端内部自动管理连接池
- **断开连接检测**：实现了心跳机制，定期发送 ping 到服务器以检测连接状态
- **Thrift 协议增强**：修复了自动重连问题和大数据场景下的性能问题

## 连接配置项

连接客户端需要传递一个配置对象，包含以下参数：

### 基本配置项

| 参数 | 类型 | 描述 | 是否必需 | 默认值 |
|------|------|------|----------|--------|
| `servers` | `string[]` | Nebula 服务器地址列表 | 是 | - |
| `userName` | `string` | 登录用户名 | 是 | - |
| `password` | `string` | 登录密码 | 是 | - |
| `space` | `string` | Nebula 服务器中的空间名 | 否 | - |

### 连接池相关配置项

| 参数 | 类型 | 描述 | 是否必需 | 默认值 |
|------|------|------|----------|--------|
| `poolSize` | `number` | 每个服务器的连接池大小 | 否 | 5 |
| `bufferSize` | `number` | 离线或连接建立前的命令缓存大小 | 否 | 2000 |

### 连接行为配置项

| 参数 | 类型 | 描述 | 是否必需 | 默认值 |
|------|------|------|----------|--------|
| `executeTimeout` | `number` | 命令执行超时时间（毫秒） | 否 | 10000 |
| `pingInterval` | `number` | 心跳间隔时间（毫秒），用于保持连接 | 否 | 60000 |

## 配置示例

```javascript
// ES 模块导入
import { createClient } from '@nebula-contrib/nebula-nodejs';

// CommonJS 导入
// const { createClient } = require('@nebula-contrib/nebula-nodejs');

// 配置选项
const options = {
  servers: ['127.0.0.1:9669', '127.0.0.1:9670'], // Nebula 服务器地址
  userName: 'root',                               // 用户名
  password: 'password',                          // 密码
  space: 'test_space',                           // 空间名
  poolSize: 10,                                  // 每个服务器的连接池大小
  bufferSize: 2000,                              // 命令缓存大小
  executeTimeout: 15000,                         // 执行超时时间（毫秒）
  pingInterval: 30000                            // 心跳间隔时间（毫秒）
};

// 创建客户端
const client = createClient(options);

// 使用客户端执行命令
try {
  // 等待连接就绪
  await new Promise((resolve, reject) => {
    client.once('authorized', () => resolve());
    client.once('error', (error) => reject(error));
  });

  // 执行查询命令
  const response = await client.execute('SHOW SPACES');
  console.log('查询结果:', response);
} catch (error) {
  console.error('执行错误:', error);
}
```

## 配置项详细说明

### 1. 服务器配置

- `servers`: 字符串数组，每个元素是"host:port"格式的服务器地址
- 支持指定多个服务器地址，实现负载均衡和高可用性
- 服务器地址格式必须是"host:port"格式

### 2. 认证配置

- `userName`: 登录到 Nebula Graph 的用户名
- `password`: 对应用户的密码
- `space`: 连接后自动切换到的 Nebula 空间

### 3. 连接池配置

- `poolSize`: 每个服务器的连接池大小
  - 默认值为 5
  - 数值必须为正整数
  - 该值控制客户端与每个服务器之间建立的连接数量
- `bufferSize`: 命令缓存大小
  - 默认值为 2000
  - 在连接未准备好或所有的连接都忙碌时，命令会被缓存
  - 如果缓存队列达到此大小，新命令会被拒绝

### 4. 超时和心跳配置

- `executeTimeout`: 命令执行超时时间（毫秒）
  - 默认值为 10000（10秒）
  - 执行命令超过此时间将触发超时错误
- `pingInterval`: 心跳间隔时间（毫秒）
  - 默认值为 60000（60秒）
  - 客户端会定期发送心跳包以保持与服务器的连接

## 配置验证

库内部会对配置项进行验证：

1. 数值型配置项（poolSize, bufferSize, executeTimeout, pingInterval）必须是正整数
2. 服务器地址格式必须是"host:port"格式
3. Host 和 Port 都必须有效

验证函数：
```javascript
const getNumberValue = (actualValue, defaultValue) => {
  if (!_.isInteger(actualValue)) {
    return defaultValue;
  } else if (actualValue <= 0) {
    return defaultValue;
  }
  return actualValue;
};
```

## 事件支持

客户端基于 EventEmitter 实现，支持以下事件：

| 事件名称 | 回调参数 | 描述 |
|----------|----------|------|
| `ready` | `{ sender }` | 连接准备就绪，可以执行命令 |
| `error` | `{ sender, error }` | 发生错误 |
| `connected` | `{ sender }` | 已连接到服务器 |
| `authorized` | `{ sender }` | 已成功授权 |
| `reconnecting` | `{ sender, retryInfo }` | 正在重连，retryInfo 包含 delay 和 attempt |
| `close` | `{ sender }` | 连接已关闭 |

## 内部工作机制

1. 客户端内部为每个服务器地址创建指定数量的连接（由 poolSize 控制）
2. 每个连接都维护自己的状态（isReady, isBusy）
3. 命令执行时，客户端从空闲连接中随机选择一个执行命令
4. 支持命令排队机制，当所有连接都在忙碌时，命令会被放入队列等待
5. 实现了心跳机制，通过 pingInterval 设置的时间间隔发送心跳包
6. 自动重连机制确保连接断开后会自动尝试重连

## 注意事项

1. 客户端内部已经实现了连接池管理，不需要用户手动创建会话池
2. 所有连接的配置相同，通过相同的配置对象创建
3. 命令执行是异步的，结果通过 Promise 返回
4. 确保配置的服务器地址、用户名和密码正确
5. poolSize 配置应根据应用的并发需求和服务器承载能力进行调整
6. executeTimeout 应根据查询的复杂程度进行设置，复杂查询可能需要更长的超时时间