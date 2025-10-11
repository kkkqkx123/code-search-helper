
# MemoryMonitorService 重构计划

## 1. 现状分析

当前项目中存在三个与内存监控相关的服务，存在功能重叠和职责不清晰的问题：

1. **`MemoryMonitorService`** (`src/service/memory/MemoryMonitorService.ts`)
   - 专门的内存监控和保护服务
   - 具有三级阈值和自动清理机制
   - 目前已注册到依赖注入容器但未被使用

2. **`MemoryGuard`** (`src/service/parser/universal/MemoryGuard.ts`)
   - 通用文件处理的内存保护机制
   - 具有固定内存限制和历史记录
   - 已被 `ProcessingGuard` 使用

3. **`PerformanceOptimizerService`** (`src/infrastructure/batching/PerformanceOptimizerService.ts`)
   - 性能优化服务
   - 包含内存监控功能
   - 已被多个服务使用，包括 `IndexService` 和 `IndexingLogicService`

## 2. 功能重叠分析

### 2.1 内存监控功能重叠
- 三个服务都具备内存使用监控功能
- 都会检查 `process.memoryUsage()` 并记录内存使用情况
- 都具有内存使用百分比计算功能

### 2.2 清理机制重叠
- `MemoryMonitorService` 和 `MemoryGuard` 都具有垃圾回收功能
- `MemoryMonitorService` 和 `PerformanceOptimizerService` 都会清理历史记录防止内存泄漏
- `MemoryGuard` 和 `PerformanceOptimizerService` 都具有强制清理功能

### 2.3 配置管理重叠
- `MemoryMonitorService` 使用环境变量配置阈值
- `MemoryGuard` 使用注入的内存限制参数
- `PerformanceOptimizerService` 使用配置服务管理性能阈值

## 3. 详细功能分析

### 3.1 MemoryMonitorService (src/service/memory/MemoryMonitorService.ts)

#### 当前功能
- **三级内存阈值监控**:
  - 警告阈值 (默认70%): 执行轻量级清理
  - 严重阈值 (默认85%): 执行深度清理
  - 紧急阈值 (默认95%): 执行紧急清理
- **自动清理机制**:
  - 轻量级清理: 清理嵌入缓存
  - 深度清理: 清理嵌入缓存 + 垃圾回收
  - 紧急清理: 强制清理嵌入缓存 + 多次垃圾回收
- **手动控制接口**:
  - `triggerCleanup(level)`: 手动触发清理
  - `getMemoryUsage()`: 获取内存使用情况
  - `updateConfig(config)`: 更新配置
- **冷却机制**: 防止频繁清理 (默认30秒冷却时间)
- **依赖服务**: LoggerService, ErrorHandlerService, EmbeddingCacheService, ConfigService

#### 当前使用情况
- 已在 `src/core/registrars/BusinessServiceRegistrar.ts` 中注册为单例服务
- 目前没有被任何组件实际使用

### 3.2 MemoryGuard (src/service/parser/universal/MemoryGuard.ts)

#### 当前功能
- **固定内存限制监控** (默认500MB)
- **内存历史记录和趋势分析**:
  - 记录最近100次内存使用情况
  - 计算内存使用趋势 (增加/减少/稳定)
  - 计算平均内存使用量
- **强制清理功能**:
  - 清理TreeSitter缓存
  - 清理其他LRU缓存
  - 强制垃圾回收
- **优雅降级机制**: 内存超限时触发事件
- **内存使用统计**: 提供详细的内存使用信息
- **依赖服务**: LoggerService, MemoryLimitMB, MemoryCheckIntervalMs

#### 当前使用情况
- 被用于 `src/service/parser/universal/ProcessingGuard.ts`
- 为文件处理提供内存保护

### 3.3 PerformanceOptimizerService (src/infrastructure/batching/PerformanceOptimizerService.ts)

#### 当前功能
- **性能指标监控**:
  - 记录操作执行时间
  - 计算成功率和性能统计
- **批处理优化**:
  - 根据性能调整批处理大小
  - 自适应批处理机制
- **内存监控功能**:
  - 每30秒记录内存使用情况
  - 保留最近100次记录
  - 内存使用超过90%时发出警告
- **内存优化**:
  - 手动垃圾回收
  - 清理历史记录防止内存泄漏
  - 根据内存使用调整批处理大小

- **重试机制**: 带有指数退避的重试逻辑
- **依赖服务**: LoggerService, ErrorHandlerService, ConfigService

#### 当前使用情况
- 被多个服务使用，包括:
  - `src/service/index/IndexService.ts`
  - `src/service/index/IndexingLogicService.ts`
  - 批处理和性能优化场景

## 4. 重构建议

### 4.1 统一内存监控服务

建议将内存监控功能统一到一个服务中，具体方案如下：

1. **保留 `MemoryMonitorService` 作为核心内存监控服务**
   - 保持其三级阈值监控机制
   - 保留其自动清理功能
   - 作为全局内存监控的单一入口
   - 添加通用内存状态查询接口供其他服务使用

2. **重构 `MemoryGuard` 为特定场景的内存保护器**
   - 移除通用内存监控功能，保留特定于文件处理的保护机制
   - 依赖 `MemoryMonitorService` 获取内存状态
   - 专注于文件处理场景的内存保护
   - 保留TreeSitter缓存清理等特定功能

3. **简化 `PerformanceOptimizerService` 的内存功能**
   - 移除独立的内存监控逻辑
   - 依赖 `MemoryMonitorService` 获取内存状态
   - 专注于批处理大小的性能优化
   - 保留性能指标监控功能

### 4.2 具体重构步骤

#### 步骤1: 增强 MemoryMonitorService 的通用性
```typescript
// 在 MemoryMonitorService 中添加通用内存状态查询接口
export interface IMemoryStatus {
  heapUsed: number;
  heapTotal: number;
  heapUsedPercent: number;
  rss: number;
  external: number;
  isWarning: boolean;
  isCritical: boolean;
  isEmergency: boolean;
  trend: 'increasing' | 'decreasing' | 'stable';
  averageUsage: number;
}

getMemoryStatus(): IMemoryStatus;
```

#### 步骤2: 修改 MemoryGuard 依赖 MemoryMonitorService
```typescript
// 修改 MemoryGuard 构造函数，注入 MemoryMonitorService
constructor(
  @inject(TYPES.MemoryMonitorService) private memoryMonitor: MemoryMonitorService,
  @inject(TYPES.MemoryLimitMB) memoryLimitMB: number = 500,
  @inject(TYPES.LoggerService) logger: LoggerService
) {
  // ...
}
```

#### 步骤3: 修改 PerformanceOptimizerService
- 移除 `startMemoryMonitoring`、`recordMemoryUsage` 等方法
- 通过 `MemoryMonitorService` 获取内存状态
- 保留批处理大小调整逻辑

### 4.3 配置统一

将内存相关的配置统一管理：

1. 通过 `ConfigService` 统一管理内存阈值
2. 使用统一的环境变量前缀（如 `MEMORY_*`）
3. 提供配置验证和默认值管理

## 5. 实现计划

### 第一阶段：设计和接口定义
- 定义统一的内存监控接口 `IMemoryStatus`
- 确定各服务的职责边界
- 更新依赖注入类型定义
- 设计统一的配置管理方案

### 第二阶段：MemoryMonitorService 增强
- 添加通用内存状态查询接口
- 添加内存趋势分析功能
- 改进内存使用统计功能
- 增强错误处理机制
- 添加配置验证和默认值管理

### 第三阶段：MemoryGuard 重构
- 修改依赖关系，注入 `MemoryMonitorService`
- 移除重复的内存监控逻辑
- 保留特定场景的保护功能
- 更新相关测试用例

### 第四阶段：PerformanceOptimizerService 重构
- 移除重复的内存监控功能
- 优化批处理逻辑以利用统一的内存状态
- 更新依赖注入配置
- 更新相关测试用例

### 第五阶段：集成和测试
- 更新 `src/core/registrars/BusinessServiceRegistrar.ts`
- 编写集成测试验证重构后的功能
- 确保性能不受影响
- 验证内存监控的准确性
- 更新文档和使用示例

## 6. 预期收益

1. **消除功能重叠**：减少代码重复，提高维护性
2. **职责清晰**：每个服务有明确的职责边界
3. **统一监控**：提供一致的内存监控视图
4. **易于扩展**：为未来的内存优化功能提供统一基础
5
. **性能提升**：减少重复的内存检查操作

## 7. 风险和注意事项

1. **兼容性**：确保重构不影响现有功能
   - `ProcessingGuard` 对 `MemoryGuard` 的依赖
   - `IndexService` 和 `IndexingLogicService` 对 `PerformanceOptimizerService` 的依赖

2. **性能**：避免集中式监控成为性能瓶颈
   - 确保内存监控频率合理
   - 避免过多的同步操作

3. **依赖循环**：确保服务间的依赖关系清晰
   - 避免循环依赖
   - 明确各服务的职责边界

4. **测试覆盖**：确保重构后所有场景都得到充分测试
   - 单元测试
   - 集成测试
   - 性能测试

## 8. 迁移计划

### 8.1 向后兼容性
- 保持现有的公共API接口不变
- 提供废弃警告，引导开发者使用新接口
- 在适当版本中移除废弃功能

### 8.2 渐进式迁移
1. 首先增强 `MemoryMonitorService`，添加新的接口
2. 修改 `MemoryGuard` 和 `PerformanceOptimizerService` 使用新接口
3. 逐步移除重复功能
4. 最后更新依赖注入配置

### 8.3 监控和验证
- 添加日志记录，跟踪重构后的性能变化
- 监控内存使用情况，确保没有内存泄漏
- 收集用户反馈，及时调整方案