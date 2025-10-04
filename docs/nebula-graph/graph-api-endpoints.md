# Graph API 端点文档

本文档详细介绍了代码库索引与检索服务的Graph API端点，这些端点提供了对代码库图数据的管理、查询、分析和统计功能。

## 📋 API 端点列表

### 1. 图数据管理 API

#### 项目空间管理
- `POST /api/v1/graph/space/:projectId/create` - 创建项目空间
- `POST /api/v1/graph/space/:projectId/delete` - 删除项目空间
- `POST /api/v1/graph/space/:projectId/clear` - 清空项目空间
- `GET /api/v1/graph/space/:projectId/info` - 获取空间信息

#### 图数据操作
- `POST /api/v1/graph/nodes` - 批量插入节点
- `POST /api/v1/graph/edges` - 批量插入边
- `DELETE /api/v1/graph/nodes` - 批量删除节点

### 2. 图查询 API

#### 自定义查询
- `POST /api/v1/graph/query` - 执行自定义图查询

#### 关系查询
- `POST /api/v1/graph/related` - 查询相关节点
- `POST /api/v1/graph/path/shortest` - 最短路径搜索
- `POST /api/v1/graph/path/all` - 所有路径搜索
- `POST /api/v1/graph/traversal` - 图遍历查询

#### 搜索查询
- `POST /api/v1/graph/search` - 图语义搜索
- `GET /api/v1/graph/search/suggestions` - 搜索建议

### 3. 图分析 API

#### 依赖分析
- `POST /api/v1/graph/analysis/dependencies` - 文件依赖分析
- `GET /api/v1/graph/analysis/circular/:projectId` - 循环依赖检测

#### 调用图分析
- `POST /api/v1/graph/analysis/callgraph` - 函数调用图
- `POST /api/v1/graph/analysis/impact` - 影响范围分析

#### 代码结构分析
- `GET /api/v1/graph/analysis/overview/:projectId` - 项目概览
- `GET /api/v1/graph/analysis/metrics/:projectId` - 结构指标

### 4. 图统计 API

#### 图统计信息
- `GET /api/v1/graph/stats/:projectId` - 图统计信息
- `GET /api/v1/graph/stats/cache` - 缓存统计
- `GET /api/v1/graph/stats/performance` - 性能指标

#### 监控端点
- `GET /api/v1/graph/stats/health` - 健康检查
- `GET /api/v1/graph/stats/status` - 服务状态

## 🛠️ 使用示例

### 创建项目空间
```bash
curl -X POST http://localhost:3010/api/v1/graph/space/my-project/create \
  -H "Content-Type: application/json" \
  -d '{
    "partitionNum": 10,
    "replicaFactor": 1,
    "vidType": "FIXED_STRING(30)"
  }'
```

### 执行自定义查询
```bash
curl -X POST http://localhost:3010/api/v1/graph/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "MATCH (n) RETURN n LIMIT 10",
    "projectId": "my-project"
  }'
```

### 文件依赖分析
```bash
curl -X POST http://localhost:3010/api/v1/graph/analysis/dependencies \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "src/main.ts",
    "projectId": "my-project",
    "includeTransitive": true,
    "includeCircular": true
  }'
```

### 函数调用图分析
```bash
curl -X POST http://localhost:3010/api/v1/graph/analysis/callgraph \
  -H "Content-Type: application/json" \
  -d '{
    "functionName": "calculateTotal",
    "projectId": "my-project",
    "depth": 3,
    "direction": "both"
  }'
```

## 📊 响应格式

所有API端点返回统一的响应格式：

```json
{
  "success": true,
  "data": {},
  "executionTime": 123
}
```

或错误响应：

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Error message"
}
```

## 🔐 安全考虑

- 所有查询都会经过安全性验证，防止危险的nGQL语句
- 项目ID格式验证，只允许字母、数字、连字符和下划线
- 查询长度限制，防止过长的查询语句
- 访问控制将在后续版本中实现

## 🚀 性能优化

- 查询结果缓存机制
- 批量操作支持
- 性能监控和指标收集
- 内存使用优化

## 🧪 测试端点

可以使用以下命令测试API是否正常运行：

```bash
# 测试健康检查
curl http://localhost:3010/api/v1/graph/stats/health

# 测试服务状态
curl http://localhost:3010/api/v1/graph/stats/status