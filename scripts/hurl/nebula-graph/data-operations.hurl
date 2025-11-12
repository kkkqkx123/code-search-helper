# NebulaGraph 数据操作
# 测试节点和边的批量插入、删除操作

# 1. 批量插入节点
POST http://localhost:3010/api/v1/graph/nodes
Content-Type: application/json

{
  "projectId": "test-project",
  "nodes": [
    {
      "id": "file-1",
      "type": "File",
      "properties": {
        "name": "main.ts",
        "path": "/src/main.ts",
        "size": 1024,
        "language": "typescript"
      }
    },
    {
      "id": "function-1",
      "type": "Function",
      "properties": {
        "name": "main",
        "signature": "main(): void",
        "lineNumber": 10,
        "complexity": 1
      }
    },
    {
      "id": "class-1",
      "type": "Class",
      "properties": {
        "name": "App",
        "lineNumber": 1,
        "methods": ["main", "init"]
      }
    }
  ]
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 2. 批量插入边
POST http://localhost:3010/api/v1/graph/edges
Content-Type: application/json

{
  "projectId": "test-project",
  "edges": [
    {
      "source": "file-1",
      "target": "function-1",
      "type": "CONTAINS",
      "properties": {
        "lineNumber": 10,
        "accessType": "public"
      }
    },
    {
      "source": "file-1",
      "target": "class-1",
      "type": "CONTAINS",
      "properties": {
        "lineNumber": 1,
        "accessType": "public"
      }
    },
    {
      "source": "function-1",
      "target": "class-1",
      "type": "CALLS",
      "properties": {
        "callType": "method",
        "frequency": 1
      }
    }
  ]
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 3. 批量删除节点
DELETE http://localhost:3010/api/v1/graph/nodes
Content-Type: application/json

{
  "projectId": "test-project",
  "nodeIds": ["function-1", "class-1"],
  "cascade": true
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 4. 验证数据删除后的查询
POST http://localhost:3010/api/v1/graph/query
Content-Type: application/json

{
  "query": "MATCH (n) WHERE n.id IN ['function-1', 'class-1'] RETURN n",
  "projectId": "test-project",
  "parameters": {}
}
HTTP 200
[Asserts]
jsonpath "$.success" == true