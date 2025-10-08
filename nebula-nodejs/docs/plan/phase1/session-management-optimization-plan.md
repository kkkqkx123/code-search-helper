# Nebula Node.js SDK 会话管理优化实施方案

## 问题背景

根据 `nebula-nodejs-session-management-analysis.md` 的分析，当前 SDK 存在会话泄露风险，主要体现在：

1. 会话清理依赖连接就绪状态，可能导致僵尸会话
2. 重连机制创建新会话但未清理旧会话
3. 缺乏会话生命周期监控机制

## 优化目标

1. **消除会话泄露**: 确保所有会话都能被正确清理
2. **增强可靠性**: 提高会话管理的健壮性
3. **保持兼容性**: 优化不破坏现有 API 接口
4. **性能可控**: 优化带来的性能开销在可接受范围内

## 具体实施方案

### 第一阶段：增强会话清理机制

#### 1.1 修改 Connection.close() 方法

**当前问题**:
```javascript
// 原代码 - 仅当 isReady 为 true 时才清理会话
return this.isReady ? this.client.signout(this.sessionId) : Promise.resolve();
```

**优化方案**:
```javascript
close() {
  return new Promise((resolve, reject) => {
    // 优先尝试会话注销，无论连接状态如何
    const cleanupPromise = this.sessionId 
      ? this.client.signout(this.sessionId).catch(() => {}) 
      : Promise.resolve();
    
    cleanupPromise.finally(() => {
      if (this.connection.connected) {
        this.connection.end().then(resolve).catch(reject);
      } else {
        resolve({});
      }
    });
  });
}
```

**优化要点**:
- 只要存在 sessionId 就尝试注销，不依赖 isReady 状态
- 使用 catch(() => {}) 忽略注销失败，确保流程继续
- 使用 finally 确保连接清理总是执行

#### 1.2 添加 forceCleanup() 方法

**新增方法**:
```javascript
forceCleanup() {
  return new Promise((resolve) => {
    if (this.sessionId) {
      // 无论连接状态如何，都尝试注销会话
      this.client.signout(this.sessionId)
        .catch(() => {
          // 忽略注销失败，但确保尝试过
        })
        .finally(() => {
          // 清理本地会话ID
          this.sessionId = null;
          resolve();
        });
    } else {
      resolve();
    }
  });
}
```

**使用场景**:
- 连接异常时的强制清理
- 会话监控发现僵尸会话时的清理
- 应用程序关闭时的补充清理

### 第二阶段：添加会话生命周期监控

#### 2.1 在 Client 类中添加会话监控

**新增方法**:
```javascript
startSessionMonitor() {
  // 每30秒检查一次会话状态
  this.sessionMonitor = setInterval(() => {
    this.connections.forEach(conn => {
      // 发现僵尸会话：有sessionId但连接未就绪
      if (conn.sessionId && !conn.isReady) {
        console.warn(`发现僵尸会话 ${conn.sessionId}，正在清理...`);
        conn.forceCleanup().then(() => {
          console.log(`僵尸会话 ${conn.sessionId} 清理完成`);
        });
      }
    });
  }, 30000);
}

stopSessionMonitor() {
  if (this.sessionMonitor) {
    clearInterval(this.sessionMonitor);
    this.sessionMonitor = null;
  }
}
```

**集成到构造函数**:
```javascript
constructor(option) {
  // ... 现有代码 ...
  
  // 启动会话监控
  this.startSessionMonitor();
}
```

**集成到 close() 方法**:
```javascript
close() {
  // 停止会话监控
  this.stopSessionMonitor();
  
  // 清理现有的连接监控定时器
  _lodash.default.forEach(this.connectionGuarders, timer => {
    clearInterval(timer);
  });
  
  return Promise.all([..._lodash.default.map(this.connections, o => o.close())]);
}
```

### 第三阶段：改进重连机制

#### 3.1 修改 prepare() 方法的重连逻辑

**当前问题**:
```javascript
// 原代码 - 重连时直接重新调用prepare，可能创建新会话而不清理旧会话
setTimeout(() => {
  this.prepare.bind(self)();
}, 1000);
```

**优化方案**:
```javascript
prepare() {
  this.client.authenticate(this.connectionOption.userName, this.connectionOption.password)
    .then(response => {
      if (response.error_code !== 0) {
        throw new _NebulaError.default(response.error_code, response.error_msg);
      }
      
      // 认证成功，先清理可能存在的旧会话
      if (this.sessionId && this.sessionId !== response.session_id) {
        console.warn(`发现旧会话 ${this.sessionId}，正在清理...`);
        return this.forceCleanup().then(() => response);
      }
      
      return response;
    })
    .then(response => {
      this.sessionId = response.session_id;
      // ... 其余代码保持不变 ...
    })
    .catch(err => {
      // ... 错误处理代码 ...
      
      // 重连前先清理当前会话
      if (this.sessionId) {
        this.forceCleanup().finally(() => {
          const self = this;
          setTimeout(() => {
            this.prepare.bind(self)();
          }, 1000);
        });
      } else {
        const self = this;
        setTimeout(() => {
          this.prepare.bind(self)();
        }, 1000);
      }
    });
}
```

### 第四阶段：增强错误处理

#### 4.1 添加会话状态验证

**在 run() 方法中添加会话验证**:
```javascript
run(task) {
  // 执行前验证会话状态
  if (!this.sessionId || !this.isReady) {
    const error = new _NebulaError.default(9995, '会话无效或连接未就绪');
    task.reject(error);
    this.isBusy = false;
    this.emit('free', { sender: this });
    return;
  }
  
  this.isBusy = true;
  // ... 其余代码保持不变 ...
}
```

#### 4.2 改进 ping() 方法

**增强心跳检测**:
```javascript
ping(timeout) {
  if (this.connection.connected && this.sessionId) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        resolve(false);
      }, timeout);
      
      this.client.execute(this.sessionId, 'YIELD 1')
        .then(response => {
          clearTimeout(timer);
          // 验证会话是否仍然有效
          const isValid = response.error_code === 0 || 
                         (response.error_code === -1005); // 会话无效错误码
          resolve(isValid);
        })
        .catch((error) => {
          clearTimeout(timer);
          // 如果是会话相关错误，标记为需要重新认证
          if (error.code === -1005) {
            this.isReady = false;
            this.forceCleanup();
          }
          resolve(false);
        });
    });
  }
  return Promise.resolve(false);
}
```

## 实施步骤

### 步骤 1: 修改 Connection.js

1. 修改 `close()` 方法，增强会话清理逻辑
2. 添加 `forceCleanup()` 方法
3. 改进 `prepare()` 方法的重连逻辑
4. 增强 `run()` 和 `ping()` 方法的会话验证

### 步骤 2: 修改 Client.js

1. 添加会话监控相关方法
2. 在构造函数中启动会话监控
3. 在 `close()` 方法中停止会话监控

### 步骤 3: 添加测试用例

```javascript
// 测试会话清理机制
describe('Session Management', () => {
  test('should cleanup session even when connection is not ready', async () => {
    const connection = new Connection(options);
    connection.sessionId = 'test-session-id';
    connection.isReady = false;
    
    await connection.close();
    
    expect(connection.sessionId).toBeNull();
  });
  
  test('should detect and cleanup zombie sessions', async () => {
    const client = new Client(options);
    
    // 模拟僵尸会话
    client.connections[0].sessionId = 'zombie-session';
    client.connections[0].isReady = false;
    
    // 触发会话监控
    await new Promise(resolve => setTimeout(resolve, 31000));
    
    expect(client.connections[0].sessionId).toBeNull();
  });
});
```

## 性能影响评估

### 正面影响
- **减少会话泄露**: 避免服务器资源浪费
- **提高稳定性**: 减少因会话问题导致的连接失败
- **增强可维护性**: 更好的会话状态管理

### 潜在开销
- **CPU 开销**: 会话监控定时器每30秒执行一次，开销极小
- **网络开销**: 额外的会话注销请求，但频率很低
- **内存开销**: 几乎可以忽略不计

### 优化建议
- 会话监控频率可配置（默认30秒）
- 支持禁用会话监控（在高性能场景）
- 批量处理会话清理请求

## 兼容性保证

### API 兼容性
- 所有现有 API 保持不变
- 新增方法为内部使用，不暴露给最终用户
- 配置选项保持向后兼容

### 行为兼容性
- 正常情况下行为保持一致
- 异常情况下行为更加健壮
- 错误处理更加完善

## 验证方案

### 功能验证
1. 测试正常会话生命周期
2. 测试异常断开时的会话清理
3. 测试重连时的会话管理
4. 测试僵尸会话检测和清理

### 性能验证
1. 基准性能测试对比
2. 内存使用监控
3. 网络流量分析
4. 长时间运行稳定性测试

### 压力测试
1. 高并发场景下的会话管理
2. 频繁重连场景下的会话清理
3. 大量连接池的会话监控性能

## 部署建议

### 渐进式部署
1. 先在测试环境验证功能
2. 在小规模生产环境试运行
3. 逐步扩大部署范围
4. 监控关键指标变化

### 回滚策略
1. 保留原始代码版本
2. 监控关键业务指标
3. 发现问题及时回滚
4. 收集问题数据用于改进

## 总结

本优化方案通过增强会话清理机制、添加会话生命周期监控、改进重连机制等措施，有效解决了 SDK 的会话泄露问题。方案在保持 API 兼容性的前提下，显著提高了系统的可靠性和稳定性，同时性能开销在可接受范围内。建议按照实施步骤逐步推进，确保优化效果的同时降低风险。