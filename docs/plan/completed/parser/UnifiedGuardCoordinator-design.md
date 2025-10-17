# UnifiedGuardCoordinator 详细设计文档

## 📋 类设计概述

`UnifiedGuardCoordinator` 类将合并 `MemoryGuard` 和 `ProcessingGuard` 的功能，提供统一的保护机制协调服务。

## 🏗️ 类结构设计

### 核心接口定义

```typescript
export interface IUnifiedGuardCoordinator {
  // 生命周期管理
  initialize(): void;
  destroy(): void;
  reset(): void;
  
  // 内存保护功能
  startMonitoring(): void;
  stopMonitoring(): void;
  checkMemoryUsage(): MemoryStatus;
  forceCleanup(): Promise<void>;
  gracefulDegradation(): void;
  getMemoryStats(): MemoryStats;
  getMemoryHistory(): MemoryHistory[];
  clearHistory(): void;
  setMemoryLimit(limitMB: number): void;
  forceGarbageCollection(): void;
  
  // 错误保护功能
  shouldUseFallback(): boolean;
  recordError(error: Error, context?: string): void;
  
  // 文件处理协调
  processFile(filePath: string, content: string): Promise<FileProcessingResult>;
  
  // 状态查询
  getStatus(): GuardStatus;
}
```

### 数据结构定义

```typescript
// 内存状态接口
export interface MemoryStatus {
  isWithinLimit: boolean;
  usagePercent: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  arrayBuffers: number;
}

// 内存统计接口
export interface MemoryStats {
  current: NodeJS.MemoryUsage;
  limit: number;
  usagePercent: number;
  isWithinLimit: boolean;
  trend: 'increasing' | 'decreasing' | 'stable';
  averageUsage: number;
}

// 内存历史记录
export interface MemoryHistory {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
}

// 文件处理结果
export interface FileProcessingResult {
  chunks: any[];
  language: string;
  processingStrategy: string;
  fallbackReason?: string;
}

// 保护状态
export interface GuardStatus {
  errorThreshold: {
    errorCount: number;
    maxErrors: number;
    shouldUseFallback: boolean;
    resetInterval: number;
  };
  memoryGuard: MemoryStats;
  isInitialized: boolean;
  isMonitoring: boolean;
}
```

## 🔧 核心实现策略

### 1. 单例模式设计

```typescript
@injectable()
export class UnifiedGuardCoordinator implements IUnifiedGuardCoordinator {
  private static instance: UnifiedGuardCoordinator;
  
  // 私有构造函数，强制使用工厂方法
  private constructor(
    private memoryMonitor: IMemoryMonitorService,
    private errorThresholdManager: ErrorThresholdManager,
    private cleanupManager: CleanupManager,
    private processingStrategySelector: IProcessingStrategySelector,
    private fileProcessingCoordinator: IFileProcessingCoordinator,
    private memoryLimitMB: number = 500,
    private memoryCheckIntervalMs: number = 5000,
    private logger?: LoggerService
  ) {
    // 初始化逻辑
    this.initializeInternal();
  }
  
  // 静态工厂方法
  public static getInstance(
    memoryMonitor: IMemoryMonitorService,
    errorThresholdManager: ErrorThresholdManager,
    cleanupManager: CleanupManager,
    processingStrategySelector: IProcessingStrategySelector,
    fileProcessingCoordinator: IFileProcessingCoordinator,
    memoryLimitMB: number = 500,
    memoryCheckIntervalMs: number = 5000,
    logger?: LoggerService
  ): UnifiedGuardCoordinator {
    if (!UnifiedGuardCoordinator.instance) {
      UnifiedGuardCoordinator.instance = new UnifiedGuardCoordinator(
        memoryMonitor,
        errorThresholdManager,
        cleanupManager,
        processingStrategySelector,
        fileProcessingCoordinator,
        memoryLimitMB,
        memoryCheckIntervalMs,
        logger
      );
    }
    return UnifiedGuardCoordinator.instance;
  }
}
```

### 2. 内存监控统一实现

```typescript
private initializeInternal(): void {
  // 设置内存限制
  this.memoryMonitor.setMemoryLimit?.(this.memoryLimitMB);
  
  // 设置事件处理器
  this.setupEventHandlers();
  
  this.logger?.info('UnifiedGuardCoordinator initialized successfully');
}

private setupEventHandlers(): void {
  // 统一处理内存压力事件
  if (typeof process !== 'undefined' && process.on) {
    process.on('memoryPressure', this.handleMemoryPressure.bind(this));
  }
}

private handleMemoryPressure(event: any): void {
  this.logger?.warn('Memory pressure detected', event);
  
  // 统一清理逻辑
  this.forceCleanup().catch(error => {
    this.logger?.error(`Failed to handle memory pressure: ${error}`);
  });
  
  // 记录错误
  this.recordError(
    new Error('Memory pressure detected'),
    'memory-pressure'
  );
}
```

### 3. 统一的内存检查逻辑

```typescript
public checkMemoryUsage(): MemoryStatus {
  try {
    const memoryStatus = this.memoryMonitor.getMemoryStatus();
    const heapUsed = memoryStatus.heapUsed;
    const heapTotal = memoryStatus.heapTotal;
    const external = memoryStatus.external;
    const memUsage = process.memoryUsage();
    const arrayBuffers = memUsage.arrayBuffers || 0;

    const memoryLimitBytes = this.memoryLimitMB * 1024 * 1024;
    const isWithinLimit = heapUsed <= memoryLimitBytes;
    const usagePercent = (heapUsed / memoryLimitBytes) * 100;

    // 内存超限处理
    if (!isWithinLimit) {
      this.logger?.warn(`Memory usage exceeds limit: ${this.formatBytes(heapUsed)} > ${this.formatBytes(memoryLimitBytes)} (${usagePercent.toFixed(1)}%)`);
      
      // 触发统一清理
      this.forceCleanup().catch(error => {
        this.logger?.error(`Cleanup failed during memory check: ${error}`);
      });

      // 如果仍然超过限制，触发降级处理
      if (!this.memoryMonitor.isWithinLimit?.()) {
        this.logger?.warn('Memory still exceeds limit after cleanup, triggering graceful degradation');
        this.gracefulDegradation();
      }
    } else if (usagePercent > 80) {
      this.logger?.warn(`High memory usage detected: ${usagePercent.toFixed(1)}%`);
    }

    return {
      isWithinLimit,
      usagePercent,
      heapUsed,
      heapTotal,
      external,
      arrayBuffers
    };
  } catch (error) {
    this.logger?.error(`Error checking memory usage: ${error}`);
    return this.getDefaultMemoryStatus();
  }
}
```

### 4. 统一的清理机制

```typescript
public async forceCleanup(): Promise<void> {
  try {
    this.logger?.info('Performing unified memory cleanup...');

    if (this.cleanupManager) {
      const cleanupContext: ICleanupContext = {
        triggerReason: 'memory_limit_exceeded',
        memoryUsage: {
          heapUsed: process.memoryUsage().heapUsed,
          heapTotal: process.memoryUsage().heapTotal,
          external: process.memoryUsage().external,
          arrayBuffers: process.memoryUsage().arrayBuffers
        },
        timestamp: new Date()
      };

      const result = await this.cleanupManager.performCleanup(cleanupContext);
      
      if (result.success) {
        this.logger?.info(`Cleanup completed successfully, freed ${this.formatBytes(result.memoryFreed)} bytes, cleaned caches: ${result.cleanedCaches.join(', ')}`);
        
        // 记录清理后的内存使用情况
        const afterCleanup = this.checkMemoryUsage();
        this.logger?.info(`Memory cleanup completed. Current usage: ${this.formatBytes(afterCleanup.heapUsed)} (${afterCleanup.usagePercent.toFixed(1)}%)`);
      } else {
        this.logger?.error(`Cleanup failed: ${result.error?.message}`);
      }
    } else {
      this.logger?.warn('CleanupManager not available, cleanup skipped');
    }
  } catch (error) {
    this.logger?.error(`Error during unified cleanup: ${error}`);
  }
}
```

### 5. 统一的文件处理流程

```typescript
public async processFile(filePath: string, content: string): Promise<FileProcessingResult> {
  try {
    // 1. 检查内存状态
    const memoryStatus = this.checkMemoryUsage();
    if (!memoryStatus.isWithinLimit) {
      const memoryLimitBytes = this.memoryLimitMB * 1024 * 1024;
      this.logger?.warn(`Memory limit exceeded before processing: ${memoryStatus.heapUsed} > ${memoryLimitBytes}`);
      
      const fallbackResult = await this.fileProcessingCoordinator.processWithFallback(
        filePath, 
        content, 
        'Memory limit exceeded'
      );
      
      return {
        chunks: fallbackResult.chunks,
        language: 'text',
        processingStrategy: fallbackResult.fallbackStrategy,
        fallbackReason: fallbackResult.reason
      };
    }

    // 2. 检查错误阈值
    if (this.errorThresholdManager.shouldUseFallback()) {
      this.logger?.warn('Error threshold reached, using fallback processing');
      
      const fallbackResult = await this.fileProcessingCoordinator.processWithFallback(
        filePath, 
        content, 
        'Error threshold exceeded'
      );
      
      return {
        chunks: fallbackResult.chunks,
        language: 'text',
        processingStrategy: fallbackResult.fallbackStrategy,
        fallbackReason: fallbackResult.reason
      };
    }

    // 3. 使用专门的策略选择器进行语言检测和策略选择
    const languageInfo = await this.processingStrategySelector.detectLanguageIntelligently(filePath, content);
    const strategyContext = {
      filePath,
      content,
      languageInfo,
      timestamp: new Date()
    };
    
    const strategy = await this.processingStrategySelector.selectProcessingStrategy(strategyContext);

    // 4. 使用专门的文件处理协调器执行处理
    const context = {
      filePath,
      content,
      strategy,
      language: languageInfo.language,
      timestamp: new Date()
    };
    
    const result = await this.fileProcessingCoordinator.processFile(context);

    return {
      chunks: result.chunks,
      language: languageInfo.language,
      processingStrategy: result.processingStrategy,
      fallbackReason: result.metadata?.fallbackReason
    };
  } catch (error) {
    this.logger?.error(`Error in unified file processing: ${error}`);
    this.errorThresholdManager.recordError(error as Error, `processFile: ${filePath}`);

    const fallbackResult = await this.fileProcessingCoordinator.processWithFallback(
      filePath, 
      content, 
      `Processing error: ${(error as Error).message}`
    );
    
    return {
      chunks: fallbackResult.chunks,
      language: 'text',
      processingStrategy: fallbackResult.fallbackStrategy,
      fallbackReason: fallbackResult.reason
    };
  }
}
```

## 🔄 向后兼容策略

### ProcessingGuardAdapter 设计

```typescript
/**
 * 向后兼容适配器
 * 保持 ProcessingGuard 接口不变，内部委托给 UnifiedGuardCoordinator
 */
export class ProcessingGuardAdapter {
  private static instance: ProcessingGuardAdapter;
  private unifiedCoordinator: UnifiedGuardCoordinator;

  private constructor(
    logger?: LoggerService,
    errorThresholdManager?: ErrorThresholdManager,
    memoryGuard?: MemoryGuard,
    processingStrategySelector?: IProcessingStrategySelector,
    fileProcessingCoordinator?: IFileProcessingCoordinator
  ) {
    // 转换参数为 UnifiedGuardCoordinator 需要的格式
    const memoryMonitor = memoryGuard?.getMemoryMonitor() || this.createDefaultMemoryMonitor();
    
    this.unifiedCoordinator = UnifiedGuardCoordinator.getInstance(
      memoryMonitor,
      errorThresholdManager!,
      memoryGuard?.getCleanupManager() || this.createDefaultCleanupManager(),
      processingStrategySelector!,
      fileProcessingCoordinator!,
      500, // 默认内存限制
      5000, // 默认检查间隔
      logger
    );
  }

  // 保持原有的静态工厂方法
  public static getInstance(
    logger?: LoggerService,
    errorThresholdManager?: ErrorThresholdManager,
    memoryGuard?: MemoryGuard,
    processingStrategySelector?: IProcessingStrategySelector,
    fileProcessingCoordinator?: IFileProcessingCoordinator
  ): ProcessingGuardAdapter {
    if (!ProcessingGuardAdapter.instance) {
      ProcessingGuardAdapter.instance = new ProcessingGuardAdapter(
        logger,
        errorThresholdManager,
        memoryGuard,
        processingStrategySelector,
        fileProcessingCoordinator
      );
    }
    return ProcessingGuardAdapter.instance;
  }

  // 委托所有方法到 UnifiedGuardCoordinator
  public initialize(): void {
    this.unifiedCoordinator.initialize();
  }

  public destroy(): void {
    this.unifiedCoordinator.destroy();
  }

  public async processFile(filePath: string, content: string): Promise<any> {
    return this.unifiedCoordinator.processFile(filePath, content);
  }

  // ... 其他委托方法

  private createDefaultMemoryMonitor(): IMemoryMonitorService {
    // 创建默认的内存监控器实现
    return {
      getMemoryStatus: () => ({ /* 默认实现 */ }),
      forceGarbageCollection: () => { /* 默认实现 */ },
      // ... 其他方法
    };
  }

  private createDefaultCleanupManager(): CleanupManager {
    // 创建默认的清理管理器
    return new CleanupManager();
  }
}
```

## 🧪 测试策略

### 单元测试覆盖

```typescript
describe('UnifiedGuardCoordinator', () => {
  let coordinator: UnifiedGuardCoordinator;
  let mockMemoryMonitor: jest.Mocked<IMemoryMonitorService>;
  let mockErrorThresholdManager: jest.Mocked<ErrorThresholdManager>;
  let mockCleanupManager: jest.Mocked<CleanupManager>;
  let mockProcessingStrategySelector: jest.Mocked<IProcessingStrategySelector>;
  let mockFileProcessingCoordinator: jest.Mocked<IFileProcessingCoordinator>;
  let mockLogger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    // 设置模拟对象
    mockMemoryMonitor = { /* 模拟实现 */ };
    mockErrorThresholdManager = { /* 模拟实现 */ };
    mockCleanupManager = { /* 模拟实现 */ };
    mockProcessingStrategySelector = { /* 模拟实现 */ };
    mockFileProcessingCoordinator = { /* 模拟实现 */ };
    mockLogger = { /* 模拟实现 */ };

    coordinator = UnifiedGuardCoordinator.getInstance(
      mockMemoryMonitor,
      mockErrorThresholdManager,
      mockCleanupManager,
      mockProcessingStrategySelector,
      mockFileProcessingCoordinator,
      500,
      5000,
      mockLogger
    );
  });

  describe('内存监控功能', () => {
    test('应该正确启动和停止监控', () => {
      coordinator.startMonitoring();
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Memory monitoring started'));
      
      coordinator.stopMonitoring();
      expect(mockLogger.info).toHaveBeenCalledWith('Memory monitoring stopped');
    });

    test('应该在内存超限时触发清理', async () => {
      // 模拟内存超限
      mockMemoryMonitor.getMemoryStatus.mockReturnValue({
        heapUsed: 600 * 1024 * 1024, // 600MB > 500MB limit
        heapTotal: 1024 * 1024 * 1024,
        external: 0,
        isWarning: false,
        isCritical: false,
        isEmergency: false,
        trend: 'increasing',
        averageUsage: 600 * 1024 * 1024,
        timestamp: new Date()
      });

      const result = coordinator.checkMemoryUsage();
      
      expect(result.isWithinLimit).toBe(false);
      expect(mockCleanupManager.performCleanup).toHaveBeenCalled();
    });
  });

  describe('文件处理功能', () => {
    test('应该在错误阈值达到时使用降级处理', async () => {
      mockErrorThresholdManager.shouldUseFallback.mockReturnValue(true);
      
      const result = await coordinator.processFile('/test/file.js', 'console.log("test");');
      
      expect(result.processingStrategy).toBe('fallback-line');
      expect(mockFileProcessingCoordinator.processWithFallback).toHaveBeenCalled();
    });

    test('应该正常处理文件当条件满足时', async () => {
      mockErrorThresholdManager.shouldUseFallback.mockReturnValue(false);
      
      const result = await coordinator.processFile('/test/file.js', 'console.log("test");');
      
      expect(result.processingStrategy).toBeDefined();
      expect(mockFileProcessingCoordinator.processFile).toHaveBeenCalled();
    });
  });
});
```

### 集成测试

```typescript
describe('UnifiedGuardCoordinator 集成测试', () => {
  test('应该正确处理内存压力和错误阈值的组合场景', async () => {
    // 模拟内存压力
    // 模拟错误阈值触发
    // 验证清理和降级逻辑的正确性
  });

  test('应该保持向后兼容性', async () => {
    // 使用 ProcessingGuardAdapter 测试
    // 验证所有原有接口正常工作
  });
});
```

## 📊 迁移验证清单

### 功能验证
- [ ] 内存监控功能正常工作
- [ ] 错误阈值管理正常
- [ ] 文件处理流程完整
- [ ] 清理机制正确触发
- [ ] 降级策略正确执行
- [ ] 事件处理无遗漏

### 性能验证
- [ ] 内存使用无显著增加
- [ ] 处理性能无退化
- [ ] 响应时间在可接受范围内

### 兼容性验证
- [ ] ProcessingGuardAdapter 完全兼容
- [ ] 现有代码无需修改
- [ ] 所有测试用例通过

这个详细的设计文档提供了完整的实现蓝图，确保重构过程有据可依，功能完整，并且保持向后兼容性。