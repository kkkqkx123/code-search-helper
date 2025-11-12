# NebulaGraph HURL 测试配置

本目录包含了用于测试 NebulaGraph HTTP API 的 HURL 配置文件。这些文件可以用于自动化测试、API 调试和性能验证。

## 📁 文件说明

### 配置文件列表

| 文件名 | 描述 | 主要功能 |
|--------|------|----------|
| `health-check.hurl` | 健康检查 | 测试服务状态、缓存和性能指标 |
| `space-management.hurl` | 空间管理 | 测试图空间的创建、查询和删除 |
| `query-operations.hurl` | 查询操作 | 测试图查询、路径搜索和遍历 |
| `search-analysis.hurl` | 搜索分析 | 测试语义搜索、依赖分析和调用图 |
| `data-operations.hurl` | 数据操作 | 测试节点和边的批量插入、删除 |

## 🚀 使用方法

### 前置条件

1. 确保 NebulaGraph 服务正在运行
2. 确保 HTTP API 服务在 `http://localhost:3010` 上可用
3. 确保 NebulaGraph 已启用（`NEBULA_ENABLED=true`）

### 执行单个测试文件

```bash
# 执行健康检查
hurl scripts/hurl/nebula-graph/health-check.hurl

# 执行空间管理测试
hurl scripts/hurl/nebula-graph/space-management.hurl

# 执行查询操作测试
hurl scripts/hurl/nebula-graph/query-operations.hurl

# 执行搜索分析测试
hurl scripts/hurl/nebula-graph/search-analysis.hurl

# 执行数据操作测试
hurl scripts/hurl/nebula-graph/data-operations.hurl
```

### 执行所有测试

```bash
# 使用通配符执行所有测试
hurl scripts/hurl/nebula-graph/*.hurl

# 或者逐个执行
for file in scripts/hurl/nebula-graph/*.hurl; do
    echo "执行 $file"
    hurl "$file"
done
```

### 带参数的执行

```bash
# 显示详细输出
hurl --verbose scripts/hurl/nebula-graph/health-check.hurl

# 包含 HTTP 头部信息
hurl --include scripts/hurl/nebula-graph/health-check.hurl

# 输出到文件
hurl --output test-results.txt scripts/hurl/nebula-graph/health-check.hurl

# 设置超时时间（毫秒）
hurl --max-time 30000 scripts/hurl/nebula-graph/health-check.hurl
```

## 🔧 配置说明

### 环境变量

测试文件中使用了以下默认配置：

- **API 基础 URL**: `http://localhost:3010`
- **API 版本**: `v1`
- **测试项目 ID**: `test-project`

如需修改这些配置，可以：

1. 直接编辑 HURL 文件中的 URL
2. 使用环境变量（需要修改 HURL 文件支持）
3. 创建配置文件并使用 HURL 的变量功能

### 测试数据

测试文件中包含以下测试数据：

- **节点类型**: File, Function, Class
- **边类型**: CONTAINS, CALLS, DEPENDS_ON
- **测试文件**: main.ts
- **测试函数**: main, calculateTotal
- **测试类**: App

## 📊 预期结果

### 成功响应格式

所有 API 端点应该返回以下格式的成功响应：

```json
{
  "success": true,
  "data": {},
  "executionTime": 123
}
```

### 错误响应格式

错误响应应该具有以下格式：

```json
{
  "success": false,
  "error": "Error Type",
  "message": "Error message"
}
```

## 🐛 故障排除

### 常见问题

1. **连接超时**
   - 检查服务是否在 `http://localhost:3010` 上运行
   - 使用 `--max-time` 参数增加超时时间

2. **认证失败**
   - 检查 NebulaGraph 配置中的用户名和密码
   - 确保 `NEBULA_ENABLED=true`

3. **空间不存在**
   - 先运行 `space-management.hurl` 创建测试空间
   - 检查空间名称是否正确

4. **数据格式错误**
   - 检查请求体中的 JSON 格式
   - 确保必需字段都已提供

### 调试技巧

```bash
# 显示完整的 HTTP 请求和响应
hurl --verbose scripts/hurl/nebula-graph/health-check.hurl

# 只显示错误信息
hurl --error-format long scripts/hurl/nebula-graph/health-check.hurl

# 保存响应到文件
hurl --output response.json scripts/hurl/nebula-graph/health-check.hurl
```

## 📈 性能测试

### 重复执行测试

```bash
# 重复执行 10 次
for i in {1..10}; do
    echo "第 $i 次执行"
    hurl scripts/hurl/nebula-graph/health-check.hurl
done
```

### 并发执行

```bash
# 使用 xargs 并发执行（需要安装 GNU parallel）
ls scripts/hurl/nebula-graph/*.hurl | parallel -j 4 hurl
```

## 🔗 相关文档

- [NebulaGraph Console 使用说明](../../../docs/nebula-graph/nebula-console-usage.md)
- [Graph API 端点文档](../../../docs/nebula-graph/graph-api-endpoints.md)
- [HURL 官方文档](https://hurl.dev/)
- [项目配置说明](../../../.env.example)

## 📝 注意事项

1. **数据清理**: 测试会创建和删除数据，建议在测试环境中运行
2. **顺序依赖**: 某些测试依赖于前置操作，建议按顺序执行
3. **资源消耗**: 大量并发测试可能影响服务性能
4. **网络延迟**: 测试结果可能受网络延迟影响
5. **版本兼容**: 确保 HURL 版本与当前系统兼容

## 🤝 贡献指南

如需添加新的测试用例：

1. 创建新的 `.hurl` 文件
2. 遵循现有的命名约定
3. 添加适当的断言和错误处理
4. 更新此 README 文件
5. 测试新用例的有效性