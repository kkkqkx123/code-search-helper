# Nebula Graph Node.js 客户端动态切换 Space 指南

## 概述

本文档详细分析了 Nebula Graph Node.js 客户端（@nebula-contrib/nebula-nodejs）对动态切换当前使用 space 的支持情况，并提供实现动态切换 space 的方法。

## 当前实现分析

### 1. Space 配置方式

在当前的 @nebula-contrib/nebula-nodejs 实现中，space 是在连接初始化时通过配置项设置的：

```javascript
// 在 Client.js 中，连接是这样创建的：
const connection = new _Connection.default({
  host,
  port,
  userName: this.clientOption.userName,
  password: this.clientOption.password,
  space: this.clientOption.space  // space 在连接创建时固定设置
});
```

### 2. 连接初始化过程

在 `Connection.js` 中的 `prepare()` 方法中，space 的设置过程如下：

```javascript
prepare() {
  this.client.authenticate(this.connectionOption.userName, this.connectionOption.password)
    .then(response => {
      // ... 认证成功后 ...
      return new Promise((resolve, reject) => {
        this.run({
          command: `Use ${this.connectionOption.space}`,  // 执行 USE SPACE 命令
          returnOriginalData: false,
          resolve,
          reject
        });
      });
    })
    .then(response => {
      // ... 设置连接为就绪状态 ...
      this.isReady = true;
      this.isBusy = false;
    });
  // ...
}
```

### 3. 当前限制

1. **Space 配置固定**：space 配置在连接创建时确定，无法在连接生命周期内更改
2. **连接与 Space 绑定**：每个连接实例与一个特定的 space 绑定
3. **无动态切换接口**：当前 API 没有提供动态切换 space 的方法

## 动态切换 Space 的实现分析

### 方案一：直接执行 USE SPACE 命令

Nebula Graph 支持 `USE <space_name>` 命令来切换当前会话的 space。由于客户端的 `execute` 方法可以直接执行任意 Nebula 命令，因此可以手动执行 USE 命令来切换 space。

**优势：**
- 无需修改客户端库源码
- 直接利用 Nebula Graph 的原生命令支持
- 实现简单

**劣势：**
- 只能切换当前连接的 space（在连接池中，不同的连接可能处于不同的 space 状态）
- 需要管理连接状态的一致性

**实现示例：**
```javascript
// 使用现有客户端执行 USE 命令切换 space
const switchSpace = async (client, spaceName) => {
  try {
    const result = await client.execute(`USE ${spaceName}`);
    console.log(`Successfully switched to space: ${spaceName}`);
    return result;
  } catch (error) {
    console.error(`Failed to switch to space ${spaceName}:`, error);
    throw error;
  }
};

// 使用示例
await switchSpace(client, 'project_space_1');
const data1 = await client.execute('MATCH (n) RETURN n LIMIT 10');

await switchSpace(client, 'project_space_2');
const data2 = await client.execute('MATCH (n) RETURN n LIMIT 10');
```

### 方案二：创建多个客户端实例

为每个项目空间创建独立的客户端实例。

**优势：**
- 每个客户端绑定一个 space，避免状态混乱
- 更好的隔离性
- 不需要考虑连接池状态一致性

**劣势：**
- 资源开销更大（更多连接）
- 需要管理多个客户端实例

**实现示例：**
```javascript
class MultiSpaceClientManager {
  constructor(config) {
    this.clients = new Map();
    this.config = config;
  }

  getClient(spaceName) {
    if (!this.clients.has(spaceName)) {
      const clientConfig = { ...this.config, space: spaceName };
      const client = createClient(clientConfig);
      this.clients.set(spaceName, client);
    }
    return this.clients.get(spaceName);
  }

  async executeInSpace(spaceName, command) {
    const client = this.getClient(spaceName);
    return await client.execute(command);
  }
}
```

### 方案三：修改源码实现动态切换方法（推荐）

在客户端库中添加专门的动态切换 space 方法。

**修改内容：**

1. 在 `Connection.js` 中添加 `switchSpace` 方法：

```javascript
switchSpace(spaceName) {
  return new Promise((resolve, reject) => {
    // 首先检查连接是否就绪
    if (!this.isReady) {
      reject(new _NebulaError.default(9999, 'Connection is not ready'));
      return;
    }

    // 执行 USE 命令切换空间
    const task = {
      command: `USE ${spaceName}`,
      returnOriginalData: false,
      resolve: (response) => {
        if (response.error_code !== 0) {
          reject(new _NebulaError.default(response.error_code, response.error_msg));
        } else {
          // 更新连接配置中的 space
          this.connectionOption.space = spaceName;
          resolve(response);
        }
      },
      reject
    };

    this.run(task);
  });
}
```

2. 在 `Client.js` 中添加 `switchSpace` 方法：

```javascript
async switchSpace(spaceName) {
  // 为连接池中的所有连接切换 space
  const switchPromises = this.connections.map(connection => {
    if (connection.isReady) {
      return connection.switchSpace(spaceName);
    } else {
      // 对于未就绪的连接，当它们准备就绪时会使用新的 space
      // 这里可以设置一个待处理的 space 切换
      return Promise.resolve();
    }
  });

  return await Promise.all(switchPromises);
}

// 或者添加一个仅切换单个连接的方法
async switchConnectionSpace(connectionIndex, spaceName) {
  if (connectionIndex >= 0 && connectionIndex < this.connections.length) {
    return await this.connections[connectionIndex].switchSpace(spaceName);
  } else {
    throw new Error('Invalid connection index');
  }
}
```

## 推荐方案

对于本项目中根据项目动态切换 space 的需求，推荐使用**修改源码实现动态切换方法**的方案，因为：

1. **最佳资源利用**：无需创建多个客户端实例
2. **状态一致性**：可以确保连接池中所有连接的状态一致
3. **易用性**：提供专门的 API 接口，简化上层应用开发
4. **性能**：避免频繁创建和销毁连接

## 具体修改建议

### 1. 在 Connection 类中添加方法：

```javascript
// 添加到 Connection 类中
async switchSpace(spaceName) {
  return new Promise((resolve, reject) => {
    if (!this.isReady) {
      reject(new _NebulaError.default(9999, 'Connection is not ready'));
      return;
    }

    if (!spaceName || typeof spaceName !== 'string') {
      reject(new _NebulaError.default(9999, 'Invalid space name'));
      return;
    }

    const task = {
      command: `USE ${spaceName}`,
      returnOriginalData: false,
      resolve: (response) => {
        if (response.error_code !== 0) {
          reject(new _NebulaError.default(response.error_code, response.error_msg));
        } else {
          // 更新连接配置中的 space
          this.connectionOption.space = spaceName;
          resolve(response);
        }
      },
      reject
    };

    this.run(task);
  });
}

// 获取当前连接的 space
getCurrentSpace() {
  return this.connectionOption.space;
}
```

### 2. 在 Client 类中添加方法：

```javascript
// 添加到 Client 类中
async switchSpace(spaceName) {
  if (!spaceName || typeof spaceName !== 'string') {
    throw new _NebulaError.default(9999, 'Invalid space name');
  }

  // 为连接池中的所有连接切换 space
  const switchPromises = this.connections.map(connection => {
    if (connection.isReady) {
      return connection.switchSpace(spaceName);
    } else {
      // 对于未就绪的连接，更新配置使它们在连接时使用新 space
      connection.connectionOption.space = spaceName;
      return Promise.resolve();
    }
  });

  return await Promise.all(switchPromises);
}

// 获取当前客户端连接池的 space 状态
getConnectionSpaceInfo() {
  return this.connections.map(connection => connection.getConnectionInfo());
}
```

这样修改后，就可以在不修改现有 API 结构的情况下，支持动态切换 space 的需求。

## 应用层实现示例

```javascript
// 使用修改后的客户端
const client = createClient({
  servers: ['127.0.0.1:9669'],
  userName: 'root',
  password: 'password',
  space: 'default_space'  // 初始 space
});

// 等待连接就绪
await new Promise((resolve, reject) => {
  client.once('authorized', resolve);
  client.once('error', reject);
});

// 动态切换到项目A的 space
await client.switchSpace('project_space_A');
const projectAData = await client.execute('MATCH (n) RETURN n LIMIT 10');

// 动态切换到项目B的 space
await client.switchSpace('project_space_B');
const projectBData = await client.execute('MATCH (n) RETURN n LIMIT 10');
```

## 总结

当前 @nebula-contrib/nebula-nodejs 库在设计上不直接支持动态切换 space，但可以通过以下方式实现：

1. **最简单方式**：直接执行 `USE <space_name>` 命令，但需要处理连接池状态一致性问题
2. **推荐方式**：修改客户端源码，在 Connection 和 Client 类中添加 `switchSpace` 方法，以支持动态切换功能

通过源码修改的方式，可以实现一个稳定、一致的动态 space 切换功能，完美满足本项目中根据项目动态切换 space 的需求。