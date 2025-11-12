# NebulaGraph 查询操作
# 测试图查询、路径搜索和遍历操作

# 1. 执行自定义查询
POST http://localhost:3010/api/v1/graph/query
Content-Type: application/json

{
  "query": "MATCH (n) RETURN n LIMIT 10",
  "projectId": "test-project",
  "parameters": {}
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 2. 查找相关节点
POST http://localhost:3010/api/v1/graph/related
Content-Type: application/json

{
  "nodeId": "test-node-1",
  "projectId": "test-project",
  "relationshipTypes": ["CALLS", "DEPENDS_ON"],
  "direction": "both",
  "depth": 2,
  "limit": 20
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 3. 查找最短路径
POST http://localhost:3010/api/v1/graph/path/shortest
Content-Type: application/json

{
  "sourceId": "node1",
  "targetId": "node2",
  "projectId": "test-project",
  "edgeTypes": ["CALLS", "DEPENDS_ON"],
  "maxDepth": 5
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 4. 查找所有路径
POST http://localhost:3010/api/v1/graph/path/all
Content-Type: application/json

{
  "sourceId": "node1",
  "targetId": "node2",
  "projectId": "test-project",
  "maxDepth": 3
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 5. 图遍历查询
POST http://localhost:3010/api/v1/graph/traversal
Content-Type: application/json

{
  "startNodeId": "root-node",
  "projectId": "test-project",
  "direction": "outgoing",
  "maxDepth": 3,
  "edgeTypes": ["CONTAINS", "CALLS"],
  "limit": 50
}
HTTP 200
[Asserts]
jsonpath "$.success" == true