# NebulaGraph 搜索和分析操作
# 测试图搜索、依赖分析和调用图分析

# 1. 图语义搜索
POST http://localhost:3010/api/v1/graph/search
Content-Type: application/json

{
  "query": "function main",
  "projectId": "test-project",
  "limit": 20,
  "filters": {
    "nodeTypes": ["Function", "Class"],
    "relationshipTypes": ["CALLS"]
  }
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 2. 获取搜索建议
GET http://localhost:3010/api/v1/graph/search/suggestions?query=func&projectId=test-project&limit=10
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 3. 文件依赖分析
POST http://localhost:3010/api/v1/graph/analysis/dependencies
Content-Type: application/json

{
  "filePath": "src/main.ts",
  "projectId": "test-project",
  "includeTransitive": true,
  "includeCircular": true
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 4. 循环依赖检测
GET http://localhost:3010/api/v1/graph/analysis/circular/test-project
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 5. 函数调用图分析
POST http://localhost:3010/api/v1/graph/analysis/callgraph
Content-Type: application/json

{
  "functionName": "calculateTotal",
  "projectId": "test-project",
  "depth": 3,
  "direction": "both"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 6. 影响范围分析
POST http://localhost:3010/api/v1/graph/analysis/impact
Content-Type: application/json

{
  "nodeId": "critical-function",
  "projectId": "test-project",
  "analysisType": "both",
  "maxDepth": 5
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 7. 项目概览
GET http://localhost:3010/api/v1/graph/analysis/overview/test-project
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 8. 结构指标
GET http://localhost:3010/api/v1/graph/analysis/metrics/test-project
HTTP 200
[Asserts]
jsonpath "$.success" == true