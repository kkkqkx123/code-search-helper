# Python算法微服务

基于Python实现的统一算法微服务，为TypeScript主服务提供高性能算法支持，整合了图搜索和向量批处理优化功能。

## 🚀 快速开始

### 环境要求

- Python 3.11+
- Redis 7.0+（可选，用于缓存）
- Docker & Docker Compose（可选）

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

#### 开发模式
```bash
# 启动Python算法服务
uvicorn src.main:app --reload --port 8000
```

#### 生产模式
```bash
# 使用Docker Compose
docker-compose up -d
```

### 验证服务

```bash
# 健康检查
curl http://localhost:8000/health

# 服务信息
curl http://localhost:8000/
```

## 📚 API文档

启动服务后访问：http://localhost:8000/docs

### 核心接口

#### 1. 模糊匹配搜索
```http
POST /api/v1/fuzzy-match/search
Content-Type: application/json

{
    "query": "functionName",
    "threshold": 0.8,
    "maxResults": 10
}
```

#### 2. 图搜索查询
```http
POST /api/v1/graph-search/query
Content-Type: application/json

{
    "query": "MATCH (n)-[r]->(m) WHERE n.type = 'function' RETURN n, r, m",
    "optimizationLevel": "high"
}
```

#### 3. 索引构建
```http
POST /api/v1/index/build
Content-Type: application/json

{
    "graphData": {...},
    "indexType": "hierarchical"
}
```

#### 4. 向量批处理优化
```http
POST /api/v1/batch-optimization/calculate-size
Content-Type: application/json

{
    "item_count": 1000,
    "vector_dimension": 1536,
    "database_type": "qdrant",
    "system_resources": {
        "available_memory": 8192,
        "cpu_cores": 8,
        "io_bandwidth": 1000
    }
}
```

## 🔧 TypeScript集成

### 安装客户端依赖

```bash
npm install axios @nestjs/axios
```

### 配置环境变量

```env
PYTHON_ALGORITHM_SERVICE_URL=http://localhost:8000
PYTHON_SERVICE_TIMEOUT=30000
```

### 使用示例

```typescript
import { GraphSearchPythonClient } from './src/typescript-client/GraphSearchPythonClient';

// 在服务中注入
@Injectable()
export class SearchService {
  constructor(
    private readonly pythonClient: GraphSearchPythonClient
  ) {}
  
  async searchCode(query: string) {
    // 调用Python算法服务
    const result = await this.pythonClient.fuzzySearch({
      query,
      threshold: 0.8
    });
    
    return result.matches;
  }
  
  async optimizeBatch(vectorData: any) {
    // 调用向量批处理优化
    const result = await this.pythonClient.batchOptimization({
      item_count: vectorData.length,
      vector_dimension: vectorData[0].length,
      database_type: 'qdrant'
    });
    
    return result.optimal_batch_size;
  }
}
```

## 🏗️ 项目结构

```
py-service/
├── src/
│   ├── api/              # API接口层
│   │   ├── routes/       # 路由定义
│   │   └── middleware/   # 中间件
│   ├── core/             # 核心算法
│   │   ├── fuzzy_match/  # 模糊匹配算法
│   │   ├── graph_index/  # 图索引算法
│   │   ├── query_optimizer/ # 查询优化
│   │   └── batch_optimization/ # 向量批处理优化
│   ├── models/           # 数据模型
│   ├── services/         # 业务服务
│   ├── utils/            # 工具函数
│   └── typescript-client/ # TypeScript客户端
│       └── GraphSearchPythonClient.ts
├── tests/               # 测试代码
├── docs/                # 文档
├── requirements.txt     # Python依赖
└── docker-compose.yml   # 容器化配置
```

## 🧪 测试

### 运行测试

```bash
# 单元测试
pytest tests/unit/

# 集成测试
pytest tests/integration/

# 性能测试
pytest tests/performance/
```

### 性能基准

```bash
# 运行性能基准测试
python -m tests.performance.benchmark
```

## 📊 监控指标

服务暴露以下监控指标：

- API响应时间分布
- 算法执行时间
- 内存和CPU使用率
- 错误率和异常监控
- 查询命中率统计
- 批处理优化效果

访问 http://localhost:8000/metrics 查看Prometheus指标。

## 🔒 安全配置

### API认证

```python
# 在环境变量中配置
API_SECRET_KEY=your-secret-key
JWT_SECRET=your-jwt-secret
```

### 速率限制

```python
# 配置在中间件中
RATE_LIMIT_REQUESTS=100
RATE_LIMIT_WINDOW=60  # 秒
```

## 🚢 部署

### Docker部署

```bash
# 构建镜像
docker build -t python-algorithm-service .

# 运行容器
docker run -p 8000:8000 python-algorithm-service
```

### Kubernetes部署

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

## 🔄 开发工作流

1. **算法开发**：在Python中实现和测试算法
2. **API集成**：通过REST API暴露算法功能
3. **TypeScript调用**：在主服务中集成Python算法
4. **性能优化**：基于监控数据进行算法调优

## 📈 性能目标

| 指标 | 目标值 | 当前状态 |
|------|--------|----------|
| 查询延迟 | <100ms | 待测试 |
| 索引构建速度 | >1000节点/秒 | 待测试 |
| 批处理优化效果 | 提升30-50% | 待测试 |
| 内存使用 | <2GB | 待测试 |
| 准确率 | >90% | 待测试 |

## 🤝 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 📄 许可证

本项目采用MIT许可证。

## 📞 支持

如有问题，请提交Issue或联系开发团队。