# 实施计划：文件修改清单和集中式管理建议

## 📋 概述

本文档提供具体的实施计划，包括需要修改的文件清单、方法名称规范，以及建议集中式管理的分散处理逻辑。

## 🔧 需要修改的文件清单

### 1. 智能批量处理实施

#### 1.1 核心文件修改

**文件：`src/service/hot-reload/ChangeDetectionService.ts`**
```typescript
// 需要添加的属性
private changeAccumulator: Map<string, FileChangeEvent[]> = new Map();
private batchConfig: Map<string, BatchConfig> = new Map();

// 需要修改的方法
private async handleFileChanged(fileInfo: FileInfo): Promise<void>
private async handleFileAdded(fileInfo: FileInfo): Promise<void>
private async handleFileDeleted(fileInfo: FileInfo): Promise<void>

// 需要新增的方法
private accumulateChange(projectPath: string, event: FileChangeEvent): void
private scheduleBatchProcessing(projectPath: string): void
private calculateOptimalDelay(changeCount: number): number
private async processBatchedChanges(projectPath: string): Promise<void>
private groupChangesByType(changes: FileChangeEvent[]): ChangeGroups
```

**文件：`src/service/batch/BatchProcessingService.ts`**
```typescript
// 需要新增的方法
async processHotReloadChanges(
  projectId: string,
  changes: FileChangeEvent[],
  options?: HotReloadBatchOptions
): Promise<BatchProcessingResult>

// 需要新增的接口
interface HotReloadBatchOptions {
  maxConcurrency?: number;
  batchSize?: number;
  priority?: 'high' | 'medium' | 'low';
}
```

**文件：`src/service/batch/BatchStrategyFactory.ts`**
```typescript
// 需要新增的策略
private createHotReloadStrategy(context: BatchContext): BatchStrategy

// 需要新增的配置
interface HotReloadBatchConfig extends BatchConfig {
  maxBatchSize: number;
  mediumBatchSize: number;
  minDelay: number;
  mediumDelay: number;
  maxDelay: number;
}
```

#### 1.2 配置文件修改

**文件：`src/config/batch-config.ts`**
```typescript
// 需要添加的配置
export const HOT_RELOAD_BATCH_CONFIG = {
  maxBatchSize: 50,
  mediumBatchSize: 20,
  minDelay: 100,
  mediumDelay: 1000,
  maxDelay: 5000,
  defaultConcurrency: 3
};
```

### 2. 缓存优化实施

#### 2.1 核心文件修改

**文件：`src/infrastructure/caching/CacheService.ts`**
```typescript
// 需要新增的方法
async getParserResult<T>(key: string): Promise<T | null>
async setParserResult<T>(key: string, value: T, ttl?: number): Promise<void>
async getProcessingContext<T>(key: string): Promise<T | null>
async setProcessingContext<T>(key: string, value: T, ttl?: number): Promise<void>
async invalidateModuleCache(moduleName: string): Promise<void>

// 需要新增的常量
private readonly PARSER_CACHE_PREFIX = 'parser:';
private readonly CONTEXT_CACHE_PREFIX = 'context:';
private readonly DEFAULT_PARSER_TTL = 60000; // 1分钟
private readonly DEFAULT_CONTEXT_TTL = 300000; // 5分钟
```

**文件：`src/service/parser/ProcessingCoordinator.ts`**
```typescript
// 需要修改的方法
private async createContext(
  content: string,
  language: string,
  filePath: string,
  projectPath: string
): Promise<ProcessingContext>

private async postProcess(
  result: ProcessingResult,
  context: ProcessingContext
): Promise<ProcessingResult>

// 需要新增的方法
private generateContextKey(
  content: string,
  language: string,
  filePath: string
): string

private generateResultKey(
  content: string,
  language: string,
  filePath: string,
  options: ProcessingOptions
): string
```

**文件：`src/service/parser/CodeParser.ts`**
```typescript
// 需要修改的方法
async parseCode(
  content: string,
  language: string,
  filePath: string,
  options?: ParseOptions
): Promise<ParseResult>

// 需要新增的方法
private generateParseCacheKey(
  content: string,
  language: string,
  filePath: string,
  options?: ParseOptions
): string
```

#### 2.2 缓存配置文件

**文件：`src/config/cache-config.ts`**
```typescript
// 需要添加的配置
export const PARSER_CACHE_CONFIG = {
  resultTTL: 60000,        // 解析结果缓存1分钟
  contextTTL: 300000,      // 上下文缓存5分钟
  astTTL: 180000,          // AST缓存3分钟
  maxCacheSize: 1000,      // 最大缓存条目数
  compressionThreshold: 1024 // 压缩阈值
};
```

### 3. 可靠性优化实施

#### 3.1 核心文件修改

**文件：`src/service/batch/BatchProcessingService.ts`**
```typescript
// 需要新增的类
class OperationRetryManager {
  async executeWithAdaptiveRetry<T>(
    operation: () => Promise<T>,
    operationType: string
  ): Promise<T>
  
  private calculateRetryDelay(attempt: number, errorType: ErrorType): number
  private classifyError(error: Error): ErrorType
}

class CircuitBreakerManager {
  async executeWithProtection<T>(
    operation: () => Promise<T>,
    resourceName: string
  ): Promise<T>
  
  private recordSuccess(resourceName: string): void
  private recordFailure(resourceName: string): void
  private getState(resourceName: string): CircuitBreakerState
}

// 需要修改的方法
async executeWithRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  retryOptions?: RetryOptions
): Promise<T>
```

**文件：`src/infrastructure/database/BaseDatabaseService.ts`**
```typescript
// 需要新增的方法
protected async executeWithCircuitBreaker<T>(
  operation: () => Promise<T>,
  operationType: string
): Promise<T>

protected async handleConnectionError(error: Error): Promise<void>

// 需要新增的属性
private circuitBreaker: CircuitBreakerManager;
private retryManager: OperationRetryManager;
```

#### 3.2 错误处理文件

**文件：`src/infrastructure/error/ErrorClassifier.ts`**
```typescript
// 新建文件
export enum ErrorType {
  CONNECTION = 'connection',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  RESOURCE_EXHAUSTED = 'resource_exhausted',
  UNKNOWN = 'unknown'
}

export class ErrorClassifier {
  static classify(error: Error): ErrorType
  static isRetryable(error: Error): boolean
  static getRetryDelay(error: Error, attempt: number): number
}
```

## 🏗️ 建议集中式管理的分散处理逻辑

### 1. 变更检测和批处理协调

**当前分散的问题**：
- ChangeDetectionService中的防抖逻辑
- VectorIndexService中的批处理逻辑
- GraphIndexService中的批处理逻辑
- 各模块独立的批处理配置

**建议集中管理**：
```typescript
// 新建文件：src/service/hot-reload/ChangeCoordinator.ts
export class ChangeCoordinator {
  // 统一的变更累积和调度
  private changeAccumulator: Map<string, FileChangeEvent[]> = new Map();
  private batchSchedulers: Map<string, BatchScheduler> = new Map();
  
  // 统一的批处理策略
  private batchStrategyManager: BatchStrategyManager;
  
  // 统一的变更分发
  async coordinateChanges(projectId: string, changes: FileChangeEvent[]): Promise<void>
  
  // 智能变更分组
  private groupChangesByTarget(changes: FileChangeEvent[]): ChangeGroups
  
  // 优先级调度
  private scheduleByPriority(groups: ChangeGroups): Promise<void>
}
```

### 2. 缓存策略和键管理

**当前分散的问题**：
- 各模块独立的缓存键生成逻辑
- 分散的TTL配置
- 不一致的缓存失效策略

**建议集中管理**：
```typescript
// 新建文件：src/infrastructure/caching/CacheStrategyManager.ts
export class CacheStrategyManager {
  // 统一的缓存键生成
  generateKey(module: string, type: string, identifier: string): string
  
  // 统一的TTL策略
  getTTL(module: string, type: string): number
  
  // 统一的失效策略
  async invalidateRelatedCache(key: string): Promise<void>
  
  // 缓存预热策略
  async preloadRelatedData(key: string): Promise<void>
}

// 新建文件：src/infrastructure/caching/CacheKeyGenerator.ts
export class CacheKeyGenerator {
  static forParser(content: string, language: string, filePath: string): string
  static forContext(projectPath: string, filePath: string, language: string): string
  static forVectorIndex(projectId: string, fileId: string): string
  static forGraphIndex(projectId: string, nodeId: string): string
}
```

### 3. 错误处理和重试策略

**当前分散的问题**：
- 各模块独立的错误处理逻辑
- 分散的重试配置
- 不一致的错误分类

**建议集中管理**：
```typescript
// 新建文件：src/infrastructure/reliability/ReliabilityManager.ts
export class ReliabilityManager {
  // 统一的错误处理
  async executeWithReliability<T>(
    operation: () => Promise<T>,
    context: OperationContext
  ): Promise<T>
  
  // 统一的重试策略
  private retryManager: RetryManager
  
  // 统一的熔断器管理
  private circuitBreakerManager: CircuitBreakerManager
  
  // 统一的性能监控
  private performanceMonitor: PerformanceMonitor
}

// 新建文件：src/infrastructure/reliability/OperationContext.ts
export interface OperationContext {
  operationType: string;
  resourceName: string;
  timeout?: number;
  retryOptions?: RetryOptions;
  circuitBreakerOptions?: CircuitBreakerOptions;
}
```

### 4. 配置管理

**当前分散的问题**：
- 各模块独立的配置文件
- 分散的默认值设置
- 不一致的配置验证

**建议集中管理**：
```typescript
// 新建文件：src/config/ModuleConfigManager.ts
export class ModuleConfigManager {
  // 统一的配置获取
  getConfig<T>(module: string, key: string): T
  
  // 统一的配置验证
  validateConfig(module: string, config: any): boolean
  
  // 统一的配置热更新
  updateConfig(module: string, updates: Partial<any>): void
  
  // 统一的配置合并
  mergeConfigs(base: any, override: any): any
}

// 扩展文件：src/config/index.ts
export const HOT_RELOAD_CONFIG = {
  batch: { /* 批处理配置 */ },
  cache: { /* 缓存配置 */ },
  reliability: { /* 可靠性配置 */ }
};

export const PARSER_CONFIG = {
  cache: { /* Parser缓存配置 */ },
  processing: { /* 处理配置 */ },
  reliability: { /* 可靠性配置 */ }
};
```

## 📝 实施步骤和优先级

### 第一阶段（1-2周）：核心批处理优化
1. 修改 `ChangeDetectionService.ts` - 添加变更累积和智能调度
2. 扩展 `BatchProcessingService.ts` - 添加热重载专用批处理方法
3. 创建 `ChangeCoordinator.ts` - 集中管理变更协调逻辑
4. 更新相关配置文件

### 第二阶段（1周）：缓存优化
1. 扩展 `CacheService.ts` - 添加Parser专用缓存方法
2. 修改 `ProcessingCoordinator.ts` - 优化缓存使用
3. 创建 `CacheStrategyManager.ts` - 集中管理缓存策略
4. 更新缓存配置文件

### 第三阶段（2-3周）：可靠性优化
1. 扩展 `BatchProcessingService.ts` - 增强重试机制
2. 创建 `ReliabilityManager.ts` - 集中管理可靠性策略
3. 创建 `ErrorClassifier.ts` - 统一错误分类
4. 更新相关服务的错误处理

## 🔍 方法命名规范

### 避免使用的词汇
- ❌ Enhanced / EnhancedXxx
- ❌ Unified / UnifiedXxx
- ❌ Intelligent / IntelligentXxx
- ❌ Smart / SmartXxx
- ❌ Advanced / AdvancedXxx

### 推荐的命名模式
- ✅ 功能导向：`processBatchedChanges`, `coordinateChanges`
- ✅ 策略导向：`executeWithReliability`, `generateCacheKey`
- ✅ 管理导向：`manageBatchProcessing`, `handleCacheInvalidation`
- ✅ 协调导向：`coordinateModuleUpdates`, `synchronizeIndexes`

### 具体方法名称示例
```typescript
// 批处理相关
processBatchedChanges(projectId: string): Promise<void>
scheduleBatchProcessing(projectPath: string): void
coordinateChanges(projectId: string, changes: FileChangeEvent[]): Promise<void>

// 缓存相关
getParserResult<T>(key: string): Promise<T | null>
setParserResult<T>(key: string, value: T, ttl?: number): Promise<void>
invalidateModuleCache(moduleName: string): Promise<void>
generateCacheKey(module: string, type: string, identifier: string): string

// 可靠性相关
executeWithReliability<T>(operation: () => Promise<T>, context: OperationContext): Promise<T>
handleOperationError(error: Error, context: OperationContext): Promise<void>
classifyOperationError(error: Error): ErrorType
```

通过以上实施计划，可以在保持代码简洁性的同时，显著提升系统的性能和可靠性。