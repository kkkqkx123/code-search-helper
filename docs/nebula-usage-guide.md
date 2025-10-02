# Nebula图数据库使用指南

## 概述

本指南介绍了如何在代码库索引与检索服务中使用Nebula图数据库功能。Nebula是一个开源的分布式图数据库，专为处理大规模图数据而设计。

## 功能特性

1. **图数据存储** - 支持节点和关系的存储
2. **图查询** - 支持复杂的图遍历查询
3. **项目空间管理** - 为每个项目创建独立的图空间
4. **自动重连** - 网络中断时自动重连机制
5. **连接监控** - 实时监控数据库连接状态

## 配置

### 环境变量配置

在 `.env` 文件中配置以下环境变量：

```bash
# NebulaGraph Configuration
NEBULA_HOST = 127.0.0.1
NEBULA_PORT = 9669
NEBULA_USERNAME = root
NEBULA_PASSWORD = nebula
NEBULA_SPACE = codebase
```

### 启动Nebula服务

使用Docker启动Nebula服务：

```bash
docker run -d --name nebula \
  -p 9669:9669 \
  -p 19669:19669 \
  -p 19670:19670 \
  vesoft/nebula-graph:latest
```

## API端点

### 1. 检查Nebula状态

```
GET /api/v1/nebula/status
```

返回Nebula数据库的连接状态和统计信息。

### 2. 测试Nebula连接

```
POST /api/v1/nebula/test-connection
```

测试与Nebula数据库的连接。

### 3. 测试Nebula重连

```
POST /api/v1/nebula/test-reconnect
```

测试Nebula数据库的重连功能。

## 使用示例

### JavaScript/TypeScript客户端示例

```javascript
// 检查Nebula状态
fetch('/api/v1/nebula/status')
  .then(response => response.json())
  .then(data => {
    console.log('Nebula status:', data);
  });

// 测试连接
fetch('/api/v1/nebula/test-connection', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
})
  .then(response => response.json())
  .then(data => {
    console.log('Connection test result:', data);
  });
```

## 架构说明

### 核心组件

1. **NebulaService** - 核心服务类，提供图数据库操作接口
2. **NebulaConnectionManager** - 连接管理器，处理数据库连接
3. **NebulaSpaceManager** - 空间管理器，管理项目图空间
4. **NebulaQueryBuilder** - 查询构建器，构建nGQL查询语句
5. **NebulaConnectionMonitor** - 连接监控器，监控数据库连接状态

### 数据模型

#### 节点类型

1. **File** - 文件节点
   - name: 文件名
   - path: 文件路径
   - type: 文件类型
   - size: 文件大小
   - language: 编程语言
   - hash: 文件哈希值

2. **Function** - 函数节点
   - name: 函数名
   - signature: 函数签名
   - parameters: 参数列表
   - returnType: 返回类型
   - visibility: 可见性
   - isStatic: 是否静态
   - isAsync: 是否异步

3. **Class** - 类节点
   - name: 类名
   - type: 类型
   - extends: 继承关系
   - implements: 实现关系
   - isAbstract: 是否抽象
   - isFinal: 是否最终类

#### 关系类型

1. **CONTAINS** - 包含关系（文件包含函数）
2. **CALLS** - 调用关系（函数调用函数）
3. **EXTENDS** - 继承关系（类继承类）
4. **IMPLEMENTS** - 实现关系（类实现接口）
5. **IMPORTS** - 导入关系（文件导入模块）
6. **EXPORTS** - 导出关系（文件导出元素）
7. **REFERENCES** - 引用关系（元素引用元素）
8. **MODIFIES** - 修改关系（函数修改变量）
9. **DECLARES** - 声明关系（类声明函数）
10. **OVERRIDES** - 重写关系（函数重写函数）

## 故障排除

### 常见问题

1. **连接失败**
   - 检查Nebula服务是否正在运行
   - 验证环境变量配置是否正确
   - 检查网络连接

2. **查询超时**
   - 优化查询语句
   - 增加索引
   - 调整查询超时设置

3. **空间不存在**
   - 确保项目已正确索引
   - 检查空间创建过程是否出错

### 日志查看

查看应用日志以获取更多调试信息：

```bash
# 查看主应用日志
tail -f logs/app.log

# 查看Nebula相关日志
grep -i nebula logs/app.log
```

## 性能优化

### 索引优化

Nebula服务会自动为常用的查询字段创建索引：

1. File节点的path和name字段
2. Function节点的name字段
3. Class节点的name字段
4. 各种关系类型的索引

### 查询优化

1. 尽量使用索引字段进行查询
2. 避免深度遍历查询
3. 使用LIMIT限制返回结果数量
4. 合理使用WHERE条件过滤数据

## 监控和维护

### 连接监控

NebulaConnectionMonitor会定期检查数据库连接状态，并在连接断开时自动重连。

### 健康检查

通过 `/health` 端点可以检查服务整体健康状态。

### 性能监控

通过日志和监控指标可以了解数据库性能状况。