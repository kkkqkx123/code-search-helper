# NebulaGraph 健康检查
# 测试图数据库服务的健康状态和连接性

# 1. 检查服务健康状态
GET http://localhost:3010/api/v1/graph/stats/health
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 2. 检查服务状态
GET http://localhost:3010/api/v1/graph/stats/status
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 3. 检查缓存统计
GET http://localhost:3010/api/v1/graph/stats/cache
HTTP 200
[Asserts]
jsonpath "$.success" == true

# 4. 检查性能指标
GET http://localhost:3010/api/v1/graph/stats/performance
HTTP 200
[Asserts]
jsonpath "$.success" == true