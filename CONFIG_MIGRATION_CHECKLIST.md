# 配置统一迁移执行清单

## 执行前检查

- [ ] 已读完 `CONFIG_ARCHITECTURE_ANALYSIS.md` 了解现状
- [ ] 已读完 `CONFIG_UNIFICATION_IMPLEMENTATION.md` 了解方案
- [ ] 已备份所有关键文件
- [ ] 代码已提交到 git，创建新分支

```bash
git checkout -b refactor/unified-config
```

---

## Phase 1: 文件修改 (预计 2-3 小时)

### Step 1.1: 扩展 QdrantConfigService
- [ ] 打开 `src/config/service/QdrantConfigService.ts`
- [ ] 添加缓存、性能、批处理配置块到接口
- [ ] 实现新配置的环境变量读取
- [ ] 更新 Joi 验证 schema
- [ ] 更新 getDefaultConfig() 包含新配置

**检验**:
```bash
npm run typecheck -- src/config/service/QdrantConfigService.ts
# 应无错误
```

### Step 1.2: 扩展 NebulaConfigService
- [ ] 打开 `src/config/service/NebulaConfigService.ts`
- [ ] 添加缓存、性能、批处理配置块到接口
- [ ] **关键**: 修改 parseFloat vs parseInt (性能阈值)
- [ ] 更新 Joi 验证 schema
- [ ] 更新 getDefaultConfig() 包含新配置

**检验**:
```bash
npm run typecheck -- src/config/service/NebulaConfigService.ts
# 应无错误
```

### Step 1.3: 简化 InfrastructureConfigService
- [ ] 打开 `src/infrastructure/config/InfrastructureConfigService.ts`
- [ ] 删除 `loadInfrastructureConfigFromEnv()` 中的所有 `qdrant.*` 配置（除了 vector）
- [ ] 删除 `loadInfrastructureConfigFromEnv()` 中的所有 `nebula.*` 配置（除了 graph）
- [ ] 删除 `getDatabaseConfig()` 方法
- [ ] 删除 `loadConfigFromMainConfig()` 中关于 Qdrant 的部分
- [ ] 更新 `getSafeDefaultConfig()` 移除数据库配置
- [ ] 更新 `getMinimalConfig()` 移除数据库配置

**检验**:
```bash
npm run typecheck -- src/infrastructure/config/InfrastructureConfigService.ts
# 应无错误
```

### Step 1.4: 更新 QdrantInfrastructure
- [ ] 打开 `src/database/qdrant/QdrantInfrastructure.ts`
- [ ] 添加 `@inject(TYPES.QdrantConfigService) qdrantConfigService`
- [ ] 改 `this.configService.getConfig().qdrant.*` 为 `this.qdrantConfigService.getConfig().*`
- [ ] 改 `this.configService.getCommonConfig()` 为 `this.infrastructureConfigService.getCommonConfig()`

**检验**:
```bash
npm run typecheck -- src/database/qdrant/QdrantInfrastructure.ts
```

### Step 1.5: 更新 Nebula 相关服务
- [ ] 查找所有使用 `InfrastructureConfigService.getDatabaseConfig(DatabaseType.NEBULA)` 的地方
  ```bash
  grep -r "getDatabaseConfig.*NEBULA" src/ --include="*.ts"
  ```
- [ ] 替换为 `NebulaConfigService.getConfig()`
- [ ] 更新依赖注入

**检验**:
```bash
npm run typecheck
# 应该看到关于 getDatabaseConfig 不存在的错误（如果还有其他地方使用）
```

### Step 1.6: 更新 InfrastructureManager
- [ ] 打开 `src/infrastructure/InfrastructureManager.ts`
- [ ] 移除任何 `getDatabaseConfig()` 调用
- [ ] 更新使用通用配置的部分

---

## Phase 2: 环境变量更新 (预计 30 分钟)

### Step 2.1: 备份并编辑 .env
- [ ] 备份: `cp .env .env.backup`
- [ ] 打开 `.env` 文件

### Step 2.2: 删除旧的 INFRA_* 数据库配置
搜索并删除以下行：
```bash
# 检查行数
grep -c "^INFRA_QDRANT_" .env
grep -c "^INFRA_NEBULA_" .env

# 应该删除所有 INFRA_QDRANT_CACHE_, INFRA_QDRANT_PERFORMANCE_, INFRA_QDRANT_BATCH_*
# 应该删除所有 INFRA_NEBULA_CACHE_, INFRA_NEBULA_PERFORMANCE_, INFRA_NEBULA_BATCH_*
# 应该删除所有 INFRA_NEBULA_CONNECTION_POOL_*
```

- [ ] 删除 INFRA_QDRANT_* (缓存、性能、批处理)
- [ ] 删除 INFRA_NEBULA_* (缓存、性能、批处理、连接池)

### Step 2.3: 添加新的 QDRANT_* 配置

找到 `# Qdrant Configuration` 部分，在其下添加：

```bash
# Qdrant Cache Configuration
QDRANT_CACHE_TTL=30000
QDRANT_CACHE_MAX_ENTRIES=10000
QDRANT_CACHE_CLEANUP_INTERVAL=60000
QDRANT_CACHE_STATS_ENABLED=true

# Qdrant Performance Configuration
QDRANT_PERFORMANCE_INTERVAL=30000
QDRANT_PERFORMANCE_RETENTION=86400000
QDRANT_PERFORMANCE_LOGGING_ENABLED=true
QDRANT_PERFORMANCE_QUERY_TIMEOUT=5000
QDRANT_PERFORMANCE_MEMORY_THRESHOLD=80
QDRANT_PERFORMANCE_RESPONSE_THRESHOLD=500

# Qdrant Batch Configuration
QDRANT_BATCH_CONCURRENCY=5
QDRANT_BATCH_SIZE_DEFAULT=50
QDRANT_BATCH_SIZE_MAX=500
QDRANT_BATCH_SIZE_MIN=10
QDRANT_BATCH_MEMORY_THRESHOLD=0.80
QDRANT_BATCH_PROCESSING_TIMEOUT=3000
QDRANT_BATCH_RETRY_ATTEMPTS=3
QDRANT_BATCH_RETRY_DELAY=1000
QDRANT_BATCH_ADAPTIVE_ENABLED=true
QDRANT_BATCH_PERFORMANCE_THRESHOLD=1000
QDRANT_BATCH_ADJUSTMENT_FACTOR=0.1
```

### Step 2.4: 添加新的 NEBULA_* 配置

找到 `# Nebula Configuration` 部分，在其下添加：

```bash
# Nebula Cache Configuration
NEBULA_CACHE_TTL=30000
NEBULA_CACHE_MAX_ENTRIES=10000
NEBULA_CACHE_CLEANUP_INTERVAL=60000
NEBULA_CACHE_STATS_ENABLED=true

# Nebula Performance Configuration
NEBULA_PERFORMANCE_INTERVAL=30000
NEBULA_PERFORMANCE_RETENTION=8640000
NEBULA_PERFORMANCE_LOGGING_ENABLED=true
NEBULA_PERFORMANCE_QUERY_TIMEOUT=1000
NEBULA_PERFORMANCE_MEMORY_THRESHOLD=0.80
NEBULA_PERFORMANCE_RESPONSE_THRESHOLD=2000

# Nebula Batch Configuration
NEBULA_BATCH_CONCURRENCY=5
NEBULA_BATCH_SIZE_DEFAULT=50
NEBULA_BATCH_SIZE_MAX=500
NEBULA_BATCH_SIZE_MIN=10
NEBULA_BATCH_MEMORY_THRESHOLD=0.80
NEBULA_BATCH_PROCESSING_TIMEOUT=300000
NEBULA_BATCH_RETRY_ATTEMPTS=3
NEBULA_BATCH_RETRY_DELAY=1000
NEBULA_BATCH_ADAPTIVE_ENABLED=true
NEBULA_BATCH_PERFORMANCE_THRESHOLD=1000
NEBULA_BATCH_ADJUSTMENT_FACTOR=0.1
```

### Step 2.5: 验证 .env 文件
- [ ] 检查没有重复的配置行
  ```bash
  cat .env | sort | uniq -d  # 应该无输出
  ```
- [ ] 验证关键配置存在
  ```bash
  grep "QDRANT_CACHE_TTL" .env
  grep "NEBULA_POOL_MIN_CONNECTIONS" .env
  ```

---

## Phase 3: 更新依赖注入 (预计 30 分钟)

### Step 3.1: 检查 DI 容器绑定
- [ ] 打开 `src/core/registrars/InfrastructureServiceRegistrar.ts`
- [ ] 确保 `QdrantConfigService` 绑定存在
- [ ] 确保 `NebulaConfigService` 绑定存在
- [ ] 检查 `InfrastructureConfigService` 绑定

### Step 3.2: 检查所有 @inject 点
- [ ] 搜索所有 `@inject(TYPES.InfrastructureConfigService)` 
  ```bash
  grep -r "@inject.*InfrastructureConfigService" src/database/ --include="*.ts"
  ```
- [ ] 确认每个都已更新或不需要修改

---

## Phase 4: 编译和测试 (预计 1 小时)

### Step 4.1: 类型检查
- [ ] 运行类型检查
  ```bash
  npm run typecheck
  ```
- [ ] 应无 TS 错误

### Step 4.2: 代码风格检查
- [ ] 运行 ESLint
  ```bash
  npm run lint
  ```
- [ ] 修复任何 linting 警告

### Step 4.3: 构建
- [ ] 构建项目
  ```bash
  npm run build
  ```
- [ ] 应成功编译

### Step 4.4: 单元测试
- [ ] 运行配置相关的单元测试
  ```bash
  npm test -- --testPathPattern="(Qdrant|Nebula|Infrastructure)Config" --watch=false
  ```
- [ ] 所有测试应通过

### Step 4.5: 集成测试
- [ ] 运行完整测试套件
  ```bash
  npm test -- --watch=false --coverage
  ```
- [ ] 覆盖率应不低于之前

---

## Phase 5: 手动验证 (预计 30 分钟)

### Step 5.1: 检查 IDE 编译
- [ ] 在 IDE 中应无红色错误波浪线
- [ ] 所有导入应正确解析

### Step 5.2: 验证配置读取

创建临时测试文件 `test-config-migration.ts`:

```typescript
import { QdrantConfigService } from './src/config/service/QdrantConfigService';
import { NebulaConfigService } from './src/config/service/NebulaConfigService';
import { InfrastructureConfigService } from './src/infrastructure/config/InfrastructureConfigService';
import { LoggerService } from './src/utils/LoggerService';
import { ErrorHandlerService } from './src/utils/ErrorHandlerService';

const logger = new LoggerService();
const errorHandler = new ErrorHandlerService(logger);

const qdrantConfig = new QdrantConfigService(logger, errorHandler).getConfig();
console.log('✓ Qdrant config loaded:', {
  host: qdrantConfig.host,
  cache: qdrantConfig.cache?.defaultTTL,
  performance: qdrantConfig.performance?.monitoringInterval,
  batch: qdrantConfig.batch?.maxConcurrentOperations
});

const nebulaConfig = new NebulaConfigService(logger, errorHandler).getConfig();
console.log('✓ Nebula config loaded:', {
  host: nebulaConfig.host,
  connectionPool: nebulaConfig.connectionPool?.minConnections,
  cache: nebulaConfig.cache?.defaultTTL,
  batch: nebulaConfig.batch?.maxConcurrentOperations
});

const infraConfig = new InfrastructureConfigService(logger, {
  get: () => ({ logging: {} })
}).getConfig();
console.log('✓ Infrastructure config loaded:', {
  enableCache: infraConfig.common.enableCache,
  enableMonitoring: infraConfig.common.enableMonitoring
});

console.log('\n✓ 所有配置都已正确加载');
```

运行:
```bash
npx ts-node test-config-migration.ts
```

- [ ] 所有配置都应打印成功消息

### Step 5.3: 启动应用测试

启动开发服务器：
```bash
npm run dev
```

- [ ] 应正常启动，无错误
- [ ] 查看日志是否有配置加载消息
- [ ] 检查 API 是否可用

---

## Phase 6: 清理和提交 (预计 15 分钟)

### Step 6.1: 删除临时文件
- [ ] 删除 `test-config-migration.ts`
- [ ] 删除备份文件（如果验证成功）
  ```bash
  rm .env.backup
  rm src/**/*.backup
  ```

### Step 6.2: 提交代码
- [ ] 查看修改
  ```bash
  git diff --stat
  ```
- [ ] 提交修改
  ```bash
  git add .
  git commit -m "refactor: unify database configuration management

  - Move cache, performance, batch configs from InfrastructureConfigService to database ConfigServices
  - Standardize environment variable prefixes: QDRANT_*, NEBULA_*, INFRA_*
  - Simplify InfrastructureConfigService to only manage common infrastructure configs
  - Update all database services to use ConfigService instead of InfrastructureConfigService
  - Update .env with new config structure
  
  Fixes: Config management unified to single source of truth"
  ```

### Step 6.3: 创建 PR
- [ ] 推送分支并创建 Pull Request
- [ ] 在 PR 描述中引用 `CONFIG_ARCHITECTURE_ANALYSIS.md` 和 `CONFIG_UNIFICATION_IMPLEMENTATION.md`

---

## 问题排查

### 问题 1: TypeScript 编译错误 "getDatabaseConfig is not a function"
**解决**: 
- 检查是否还有地方在调用已删除的方法
  ```bash
  grep -r "getDatabaseConfig" src/ --include="*.ts" | grep -v test | grep -v ".test.ts"
  ```
- 替换为对应 ConfigService 的调用

### 问题 2: 环境变量未被读取
**解决**:
- 检查 .env 文件是否有 typo
- 确保 process.env 读取的前缀与 .env 文件一致
- 在代码中打印日志验证:
  ```typescript
  console.log('QDRANT_CACHE_TTL from env:', process.env.QDRANT_CACHE_TTL);
  ```

### 问题 3: 测试失败
**解决**:
- Mock 对象需要更新以返回完整的配置对象
- 检查测试是否还在期望旧的配置结构

---

## 验收标准

✅ 代码编译无错误
✅ 所有测试通过
✅ ESLint 检查通过
✅ 配置正确加载（所有前缀一致）
✅ 应用启动成功
✅ API 可用且功能正常
✅ 代码审查通过

---

## 预计总耗时

| Phase | 耗时 |
|-------|------|
| 1. 文件修改 | 2-3 小时 |
| 2. 环境变量更新 | 30 分钟 |
| 3. DI 更新 | 30 分钟 |
| 4. 编译和测试 | 1 小时 |
| 5. 手动验证 | 30 分钟 |
| 6. 清理提交 | 15 分钟 |
| **总计** | **5-6 小时** |

