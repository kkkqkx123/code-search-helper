# 数据库配置使用指南和最佳实践

## 快速开始

### 1. 基本配置设置

对于大多数使用场景，只需要配置基本的连接参数：

```bash
# Qdrant 向量数据库
QDRANT_HOST=localhost
QDRANT_PORT=6333

# Nebula 图数据库（可选）
NEBULA_ENABLED=false
NEBULA_HOST=localhost
NEBULA_PORT=9669
NEBULA_USERNAME=root
NEBULA_PASSWORD=nebula
```

### 2. 开发环境配置

开发环境推荐配置：

```bash
# 开发环境 - 启用详细日志
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_PERFORMANCE_LOGGING_ENABLED=true
QDRANT_CACHE_STATS_ENABLED=true

NEBULA_ENABLED=true
NEBULA_HOST=localhost
NEBULA_PORT=9669
NEBULA_USERNAME=root
NEBULA_PASSWORD=nebula
NEBULA_PERFORMANCE_LOGGING_ENABLED=true

# 通用配置
INFRA_LOG_LEVEL=debug
INFRA_CACHE_ENABLED=true
INFRA_MONITORING_ENABLED=true
```

### 3. 生产环境配置

生产环境推荐配置：

```bash
# 生产环境 - 性能优化
QDRANT_HOST=your-production-qdrant-host
QDRANT_PORT=6333
QDRANT_API_KEY=your-production-api-key
QDRANT_USE_HTTPS=true
QDRANT_PERFORMANCE_LOGGING_ENABLED=false

# 缓存优化
QDRANT_CACHE_TTL=300000
QDRANT_CACHE_MAX_ENTRIES=50000

# 批处理优化
QDRANT_BATCH_CONCURRENCY=10
QDRANT_BATCH_SIZE_DEFAULT=100
QDRANT_BATCH_SIZE_MAX=1000

NEBULA_ENABLED=true
NEBULA_HOST=your-production-nebula-host
NEBULA_PORT=9669
NEBULA_USERNAME=nebula_user
NEBULA_PASSWORD=secure_password

# 连接池优化
NEBULA_POOL_MIN_CONNECTIONS=5
NEBULA_POOL_MAX_CONNECTIONS=20

# 通用配置
INFRA_LOG_LEVEL=info
INFRA_CACHE_ENABLED=true
INFRA_MONITORING_ENABLED=true
```

## 配置场景指南

### 场景 1: 单机开发环境

**适用场景**: 本地开发和测试

**配置特点**:
- 使用本地数据库实例
- 启用详细日志和监控
- 较小的缓存和批次大小

```bash
# .env.development
# Qdrant 配置
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_CACHE_TTL=30000
QDRANT_CACHE_MAX_ENTRIES=10000
QDRANT_BATCH_SIZE_DEFAULT=50
QDRANT_PERFORMANCE_LOGGING_ENABLED=true

# Nebula 配置
NEBULA_ENABLED=true
NEBULA_HOST=localhost
NEBULA_PORT=9669
NEBULA_USERNAME=root
NEBULA_PASSWORD=nebula
NEBULA_POOL_MIN_CONNECTIONS=2
NEBULA_POOL_MAX_CONNECTIONS=5
NEBULA_PERFORMANCE_LOGGING_ENABLED=true

# 通用配置
INFRA_LOG_LEVEL=debug
INFRA_CACHE_ENABLED=true
INFRA_MONITORING_ENABLED=true
INFRA_HEALTH_CHECKS_ENABLED=true
```

### 场景 2: 小型生产环境

**适用场景**: 小团队或小型项目

**配置特点**:
- 中等规模的资源配置
- 基本的性能优化
- 适度的监控和日志

```bash
# .env.production-small
# Qdrant 配置
QDRANT_HOST=qdrant.example.com
QDRANT_PORT=6333
QDRANT_API_KEY=your-api-key
QDRANT_USE_HTTPS=true
QDRANT_CACHE_TTL=120000
QDRANT_CACHE_MAX_ENTRIES=25000
QDRANT_BATCH_SIZE_DEFAULT=75
QDRANT_BATCH_CONCURRENCY=8
QDRANT_PERFORMANCE_LOGGING_ENABLED=false

# Nebula 配置
NEBULA_ENABLED=true
NEBULA_HOST=nebula.example.com
NEBULA_PORT=9669
NEBULA_USERNAME=nebula_user
NEBULA_PASSWORD=secure_password
NEBULA_POOL_MIN_CONNECTIONS=3
NEBULA_POOL_MAX_CONNECTIONS=10
NEBULA_PERFORMANCE_LOGGING_ENABLED=false

# 通用配置
INFRA_LOG_LEVEL=info
INFRA_CACHE_ENABLED=true
INFRA_MONITORING_ENABLED=true
INFRA_HEALTH_CHECKS_ENABLED=true
```

### 场景 3: 大型生产环境

**适用场景**: 大型企业或高并发应用

**配置特点**:
- 大规模资源配置
- 高性能优化
- 完善的监控和容错

```bash
# .env.production-large
# Qdrant 配置
QDRANT_HOST=qdrant-cluster.example.com
QDRANT_PORT=6333
QDRANT_API_KEY=your-production-api-key
QDRANT_USE_HTTPS=true
QDRANT_TIMEOUT=60000
QDRANT_CACHE_TTL=600000
QDRANT_CACHE_MAX_ENTRIES=100000
QDRANT_BATCH_SIZE_DEFAULT=200
QDRANT_BATCH_SIZE_MAX=2000
QDRANT_BATCH_CONCURRENCY=20
QDRANT_BATCH_MEMORY_THRESHOLD=0.85
QDRANT_PERFORMANCE_LOGGING_ENABLED=false

# Nebula 配置
NEBULA_ENABLED=true
NEBULA_HOST=nebula-cluster.example.com
NEBULA_PORT=9669
NEBULA_USERNAME=nebula_user
NEBULA_PASSWORD=secure_password
NEBULA_TIMEOUT=60000
NEBULA_POOL_MIN_CONNECTIONS=10
NEBULA_POOL_MAX_CONNECTIONS=50
NEBULA_POOL_ACQUIRE_TIMEOUT=60000
NEBULA_PERFORMANCE_LOGGING_ENABLED=false

# 容错配置
NEBULA_FAULT_TOLERANCE_MAX_RETRIES=5
NEBULA_FAULT_TOLERANCE_EXPONENTIAL_BACKOFF=true
NEBULA_FAULT_TOLERANCE_CIRCUIT_BREAKER_ENABLED=true
NEBULA_FAULT_TOLERANCE_CIRCUIT_BREAKER_THRESHOLD=10

# 通用配置
INFRA_LOG_LEVEL=warn
INFRA_CACHE_ENABLED=true
INFRA_MONITORING_ENABLED=true
INFRA_HEALTH_CHECKS_ENABLED=true
INFRA_HEALTH_CHECK_INTERVAL=60000
```

### 场景 4: 多租户环境

**适用场景**: SaaS 应用或多项目部署

**配置特点**:
- 项目隔离配置
- 动态命名策略
- 资源限制和配额

```bash
# .env.multi-tenant
# Qdrant 配置 - 启用项目隔离
QDRANT_HOST=qdrant.example.com
QDRANT_PORT=6333
QDRANT_API_KEY=your-api-key
QDRANT_USE_HTTPS=true
# 不设置 QDRANT_COLLECTION，启用动态命名

# 缓存配置 - 按项目分配
QDRANT_CACHE_TTL=300000
QDRANT_CACHE_MAX_ENTRIES=50000

# Nebula 配置 - 启用项目隔离
NEBULA_ENABLED=true
NEBULA_HOST=nebula.example.com
NEBULA_PORT=9669
NEBULA_USERNAME=nebula_user
NEBULA_PASSWORD=secure_password
# 不设置 NEBULA_SPACE，启用动态命名

# 连接池配置 - 多租户优化
NEBULA_POOL_MIN_CONNECTIONS=5
NEBULA_POOL_MAX_CONNECTIONS=30

# 通用配置
INFRA_LOG_LEVEL=info
INFRA_CACHE_ENABLED=true
INFRA_MONITORING_ENABLED=true

# 项目管理
PROJECT_ALLOW_REINDEX=true
```

## 性能调优指南

### 1. 缓存优化

#### Qdrant 缓存调优

```bash
# 高频访问场景
QDRANT_CACHE_TTL=600000          # 10分钟
QDRANT_CACHE_MAX_ENTRIES=100000  # 更大的缓存
QDRANT_CACHE_CLEANUP_INTERVAL=300000  # 5分钟清理一次

# 内存受限环境
QDRANT_CACHE_TTL=60000           # 1分钟
QDRANT_CACHE_MAX_ENTRIES=5000    # 较小的缓存
QDRANT_CACHE_CLEANUP_INTERVAL=120000  # 2分钟清理一次
```

#### Nebula 缓存调优

```bash
# 图查询密集场景
NEBULA_CACHE_TTL=300000          # 5分钟
NEBULA_CACHE_MAX_ENTRIES=75000   # 大缓存

# 内存受限环境
NEBULA_CACHE_TTL=30000           # 30秒
NEBULA_CACHE_MAX_ENTRIES=10000   # 小缓存
```

### 2. 批处理优化

#### 高吞吐量配置

```bash
# Qdrant 批处理
QDRANT_BATCH_CONCURRENCY=20      # 高并发
QDRANT_BATCH_SIZE_DEFAULT=200    # 大批次
QDRANT_BATCH_SIZE_MAX=2000       # 最大批次
QDRANT_BATCH_MEMORY_THRESHOLD=0.90  # 高内存使用

# Nebula 批处理
NEBULA_BATCH_CONCURRENCY=15
NEBULA_BATCH_SIZE_DEFAULT=150
NEBULA_BATCH_SIZE_MAX=1500
NEBULA_BATCH_MEMORY_THRESHOLD=0.90
```

#### 低延迟配置

```bash
# Qdrant 批处理
QDRANT_BATCH_CONCURRENCY=5       # 低并发
QDRANT_BATCH_SIZE_DEFAULT=25     # 小批次
QDRANT_BATCH_SIZE_MAX=100        # 限制最大批次
QDRANT_BATCH_MEMORY_THRESHOLD=0.70  # 保守内存使用

# Nebula 批处理
NEBULA_BATCH_CONCURRENCY=3
NEBULA_BATCH_SIZE_DEFAULT=20
NEBULA_BATCH_SIZE_MAX=80
NEBULA_BATCH_MEMORY_THRESHOLD=0.70
```

### 3. 连接池优化

#### 高并发连接池

```bash
# Nebula 连接池
NEBULA_POOL_MIN_CONNECTIONS=10   # 最小连接数
NEBULA_POOL_MAX_CONNECTIONS=50   # 最大连接数
NEBULA_POOL_ACQUIRE_TIMEOUT=30000  # 获取连接超时
NEBULA_POOL_IDLE_TIMEOUT=600000   # 空闲超时
NEBULA_POOL_HEALTH_CHECK_INTERVAL=15000  # 健康检查间隔
```

#### 资源受限连接池

```bash
# Nebula 连接池
NEBULA_POOL_MIN_CONNECTIONS=2    # 最小连接数
NEBULA_POOL_MAX_CONNECTIONS=8    # 最大连接数
NEBULA_POOL_ACQUIRE_TIMEOUT=10000  # 获取连接超时
NEBULA_POOL_IDLE_TIMEOUT=300000   # 空闲超时
NEBULA_POOL_HEALTH_CHECK_INTERVAL=30000  # 健康检查间隔
```

## 监控和调试

### 1. 性能监控配置

```bash
# 启用详细监控
QDRANT_PERFORMANCE_INTERVAL=10000      # 10秒间隔
QDRANT_PERFORMANCE_LOGGING_ENABLED=true
QDRANT_PERFORMANCE_QUERY_TIMEOUT=3000  # 3秒查询超时
QDRANT_PERFORMANCE_MEMORY_THRESHOLD=85 # 85%内存阈值
QDRANT_PERFORMANCE_RESPONSE_THRESHOLD=1000  # 1秒响应阈值

NEBULA_PERFORMANCE_INTERVAL=5000       # 5秒间隔
NEBULA_PERFORMANCE_LOGGING_ENABLED=true
NEBULA_PERFORMANCE_QUERY_TIMEOUT=2000  # 2秒查询超时
NEBULA_PERFORMANCE_MEMORY_THRESHOLD=0.85  # 85%内存阈值
NEBULA_PERFORMANCE_RESPONSE_THRESHOLD=1500  # 1.5秒响应阈值
```

### 2. 调试配置

```bash
# 调试模式
INFRA_LOG_LEVEL=debug
QDRANT_PERFORMANCE_LOGGING_ENABLED=true
NEBULA_PERFORMANCE_LOGGING_ENABLED=true
QDRANT_CACHE_STATS_ENABLED=true
NEBULA_CACHE_STATS_ENABLED=true

# 健康检查
INFRA_HEALTH_CHECKS_ENABLED=true
INFRA_HEALTH_CHECK_INTERVAL=10000  # 10秒检查间隔
```

### 3. 错误处理配置

```bash
# 容错配置
NEBULA_FAULT_TOLERANCE_MAX_RETRIES=5
NEBULA_FAULT_TOLERANCE_RETRY_DELAY=2000
NEBULA_FAULT_TOLERANCE_EXPONENTIAL_BACKOFF=true
NEBULA_FAULT_TOLERANCE_CIRCUIT_BREAKER_ENABLED=true
NEBULA_FAULT_TOLERANCE_CIRCUIT_BREAKER_THRESHOLD=5
NEBULA_FAULT_TOLERANCE_CIRCUIT_BREAKER_TIMEOUT=10000
NEBULA_FAULT_TOLERANCE_FALLBACK_STRATEGY=cache

# 批处理重试
QDRANT_BATCH_RETRY_ATTEMPTS=5
QDRANT_BATCH_RETRY_DELAY=2000
NEBULA_BATCH_RETRY_ATTEMPTS=5
NEBULA_BATCH_RETRY_DELAY=2000
```

## 安全配置

### 1. 连接安全

```bash
# Qdrant 安全配置
QDRANT_USE_HTTPS=true
QDRANT_API_KEY=your-secure-api-key
QDRANT_TIMEOUT=30000

# Nebula 安全配置
NEBULA_USERNAME=nebula_user
NEBULA_PASSWORD=secure_password
NEBULA_TIMEOUT=30000
```

### 2. 网络配置

```bash
# 内网部署
QDRANT_HOST=10.0.1.100
NEBULA_HOST=10.0.1.101

# 外网访问（带 SSL）
QDRANT_HOST=qdrant.example.com
QDRANT_USE_HTTPS=true
NEBULA_HOST=nebula.example.com
```

## 配置验证

### 1. 配置检查脚本

创建配置验证脚本 `check-config.js`:

```javascript
const requiredConfigs = {
  qdrant: ['QDRANT_HOST', 'QDRANT_PORT'],
  nebula: ['NEBULA_HOST', 'NEBULA_PORT', 'NEBULA_USERNAME', 'NEBULA_PASSWORD']
};

function validateConfig() {
  const errors = [];
  
  for (const [service, configs] of Object.entries(requiredConfigs)) {
    for (const config of configs) {
      if (!process.env[config]) {
        errors.push(`Missing required config: ${config}`);
      }
    }
  }
  
  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
  }
  
  console.log('Configuration validation passed');
}

validateConfig();
```

### 2. 配置测试

```bash
# 运行配置验证
node check-config.js

# 运行配置相关测试
npm test -- --testPathPattern="config"

# 类型检查
npm run typecheck
```

## 故障排除

### 常见配置问题

#### 1. 连接超时

**症状**: 数据库连接超时错误

**解决方案**:
```bash
# 增加超时时间
QDRANT_TIMEOUT=60000
NEBULA_TIMEOUT=60000

# 检查网络连接
QDRANT_HOST=correct-hostname
NEBULA_HOST=correct-hostname
```

#### 2. 内存不足

**症状**: 内存溢出或性能下降

**解决方案**:
```bash
# 减少缓存大小
QDRANT_CACHE_MAX_ENTRIES=5000
NEBULA_CACHE_MAX_ENTRIES=5000

# 降低内存阈值
QDRANT_BATCH_MEMORY_THRESHOLD=0.70
NEBULA_BATCH_MEMORY_THRESHOLD=0.70

# 减少批次大小
QDRANT_BATCH_SIZE_DEFAULT=25
NEBULA_BATCH_SIZE_DEFAULT=25
```

#### 3. 性能问题

**症状**: 响应时间过长

**解决方案**:
```bash
# 启用性能监控
QDRANT_PERFORMANCE_LOGGING_ENABLED=true
NEBULA_PERFORMANCE_LOGGING_ENABLED=true

# 调整批处理参数
QDRANT_BATCH_CONCURRENCY=10
NEBULA_BATCH_CONCURRENCY=8

# 优化缓存
QDRANT_CACHE_TTL=300000
NEBULA_CACHE_TTL=300000
```

## 配置模板

### 开发环境模板

```bash
# .env.development.template
# 复制此文件为 .env.development 并修改相应值

# Qdrant 配置
QDRANT_HOST=localhost
QDRANT_PORT=6333
QDRANT_CACHE_TTL=30000
QDRANT_CACHE_MAX_ENTRIES=10000
QDRANT_PERFORMANCE_LOGGING_ENABLED=true

# Nebula 配置
NEBULA_ENABLED=true
NEBULA_HOST=localhost
NEBULA_PORT=9669
NEBULA_USERNAME=root
NEBULA_PASSWORD=nebula
NEBULA_PERFORMANCE_LOGGING_ENABLED=true

# 通用配置
INFRA_LOG_LEVEL=debug
INFRA_CACHE_ENABLED=true
INFRA_MONITORING_ENABLED=true
```

### 生产环境模板

```bash
# .env.production.template
# 复制此文件为 .env.production 并修改相应值

# Qdrant 配置
QDRANT_HOST=your-qdrant-host
QDRANT_PORT=6333
QDRANT_API_KEY=your-api-key
QDRANT_USE_HTTPS=true
QDRANT_CACHE_TTL=300000
QDRANT_CACHE_MAX_ENTRIES=50000
QDRANT_PERFORMANCE_LOGGING_ENABLED=false

# Nebula 配置
NEBULA_ENABLED=true
NEBULA_HOST=your-nebula-host
NEBULA_PORT=9669
NEBULA_USERNAME=nebula_user
NEBULA_PASSWORD=secure_password
NEBULA_PERFORMANCE_LOGGING_ENABLED=false

# 通用配置
INFRA_LOG_LEVEL=info
INFRA_CACHE_ENABLED=true
INFRA_MONITORING_ENABLED=true
```

## 最佳实践总结

### 1. 配置管理

- ✅ 使用环境变量进行配置
- ✅ 为不同环境创建不同的配置文件
- ✅ 定期备份配置文件
- ✅ 使用版本控制管理配置模板

### 2. 性能优化

- ✅ 根据硬件资源调整配置参数
- ✅ 监控系统性能并动态调整
- ✅ 使用缓存减少数据库访问
- ✅ 合理设置批处理参数

### 3. 安全考虑

- ✅ 使用 HTTPS 连接
- ✅ 定期更换 API 密钥和密码
- ✅ 限制数据库访问权限
- ✅ 使用内网地址部署

### 4. 监控和维护

- ✅ 启用性能监控
- ✅ 设置合理的健康检查间隔
- ✅ 配置错误重试机制
- ✅ 定期检查配置有效性

通过遵循这些指南和最佳实践，可以确保数据库配置的稳定性、性能和安全性。