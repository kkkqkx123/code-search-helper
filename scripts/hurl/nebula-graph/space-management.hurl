# NebulaGraph 空间管理操作
# 测试图空间的创建、查询和删除操作

# 1. 创建项目空间
POST http://localhost:3010/api/v1/graph/space/test-project/create
Content-Type: application/json

{
  "partitionNum": 10,
  "replicaFactor": 1,
  "vidType": "FIXED_STRING(30)"
}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 2. 获取空间信息
GET http://localhost:3010/api/v1/graph/space/test-project/info
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 3. 获取图统计信息
GET http://localhost:3010/api/v1/graph/stats/test-project
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 4. 清空项目空间
POST http://localhost:3010/api/v1/graph/space/test-project/clear
Content-Type: application/json

{}
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 5. 删除项目空间
POST http://localhost:3010/api/v1/graph/space/test-project/delete
Content-Type: application/json

{}
HTTP 200
[Asserts]
jsonpath "$.success" == true