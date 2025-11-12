# MemoryMonitorService 优化方案

## 概述

基于对 `MemoryMonitorService` 使用情况的分析，本文档提供具体的优化方案，旨在提高代码复用性、统一内存监控逻辑，并解决当前存在的问题。

## 1. 优先级排序

### 高优先级
1. 修复 `GuardCoordinator` 未充分利用 `MemoryMonitorService` 的问题
2. 统一接口使用，避免直接依赖具体实现类

### 中优先级
3. 简化 `MemoryGuard`，减少重复的内存监控逻辑
4. 增强事件系统，实现更灵活的内存管理

### 低优先级
5. 优化性能，减少不必要的内存检查
6. 增加更多监控指标和告警机制

## 2. 具体优化方案

### 2.1 修复 GuardCoordinator 未充分利用问题

#### 当前问题
```typescript
// GuardCoordinator.ts - 当前实现
export class GuardCoordinator implements IGuardCoordinator {
  private memoryMonitorService: MemoryMonitorService; // 使用具体类
  
  checkMemoryUsage(): MemoryStatus {
    // 简化实现，未使用 MemoryMonitorService 的功能
    const memUsage = process.memoryUsage();
    const usagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    return {
      isWithinLimit: usagePercent < 80,
      usagePercent,
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      arrayBuffers: memUsage.arrayBuffers || 0
    };
  }
}
```

#### 优化方案
```typescript
// GuardCoordinator.ts - 优化后实现
import { IMemoryMonitorService } from '../../../service/memory/interfaces/IMemoryMonitorService';

export class GuardCoordinator implements IGuardCoordinator {
  private memoryMonitorService: IMemoryMonitorService; // 使用接口
  
  constructor(
    memoryMonitorService: IMemoryMonitorService, // 修改为接口
    // ... 其他参数
  ) {
    this.memoryMonitorService = memoryMonitorService;
  }
  
  checkMemoryUsage(): MemoryStatus {
    // 充分利用 MemoryMonitorService 的功能
    const memoryStatus = this.memoryMonitorService.getMemoryStatus();
    const memUsage = process.memoryUsage(); // 获取 arrayBuffers
    
    return {
      isWithinLimit: memoryStatus.heapUsedPercent < 0.8,
      usagePercent: memoryStatus.heapUsedPercent * 100,
      heapUsed: memoryStatus.heapUsed,
      heapTotal: memoryStatus.heapTotal,
      external: memoryStatus.external,
      arrayBuffers: memUsage.arrayBuffers || 0
    };
  }
  
  getMemoryStats(): MemoryStats {
    // 使用 MemoryMonitorService 的统计功能
    const memoryStats = this.memoryMonitorService.getMemoryStats();
    return {
      current: {
        heapUsed: memoryStats.current.heapUsed,
        heapTotal: memoryStats.current.heapTotal,
        external: memoryStats.current.external,
        rss: memoryStats.current.rss,
        arrayBuffers: 0 // 需要从 process.memoryUsage() 获取
      },
      limit: this.memoryLimitMB * 1024 * 1024,
      usagePercent: memoryStats.current.heapUsedPercent * 100,
      isWithinLimit: memoryStats.current.heapUsedPercent < 0.8,
      trend: memoryStats.current.trend,
      averageUsage: memoryStats.current.averageUsage
    };
  }
  
  forceGarbageCollection(): void {
    // 委托给 MemoryMonitorService
    this.memoryMonitorService.forceGarbageCollection();
  }
}
```

### 2.2 简化 MemoryGuard

#### 当前问题
`MemoryGuard` 包含了一些与 `MemoryMonitorService` 重复的功能。

#### 优化方案
```typescript
// MemoryGuard.ts - 优化后实现
export class MemoryGuard {
  constructor(
    @inject(TYPES.MemoryMonitorService) memoryMonitor: IMemoryMonitorService,
    @inject(TYPES.MemoryLimitMB) memoryLimitMB: number = 500,
    @inject(TYPES.MemoryCheckIntervalMs) checkIntervalMs: number = 5000,
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.CleanupManager) cleanupManager?: CleanupManager
  ) {
    this.memoryMonitor = memoryMonitor;
    this.memoryLimit = memoryLimitMB * 1024 * 1024;
    
    // 设置内存限制到内存监控服务
    this.memoryMonitor.setMemoryLimit?.(memoryLimitMB);
    
    // 添加内存事件监听器
    this.memoryMonitor.addEventListener('memoryPressure', this.handleMemoryPressure.bind(this));
  }
  
  private handleMemoryPressure(event: IMemoryMonitorEvent): void {
    if (event.type === 'memoryPressure') {
      this.logger?.warn('Memory pressure detected', event.details);
      
      // 根据压力级别执行相应操作
      switch (event.details.level) {
        case 'warning':
          // 轻度压力，记录日志
          break;
        case 'critical':
          // 严重压力，触发清理
          this.forceCleanup();
          break;
        case 'emergency':
          // 紧急压力，触发清理和降级
          this.forceCleanup();
          this.gracefulDegradation();
          break;
      }
    }
  }
  
  checkMemoryUsage(): {...} {
    // 简化实现，主要委托给 MemoryMonitorService
    const memoryStatus = this.memoryMonitor.getMemoryStatus();
    const isWithinLimit = memoryStatus.heapUsed <= this.memoryLimit;
    const usagePercent = (memoryStatus.heapUsed / this.memoryLimit) * 100;
    
    if (!isWithinLimit) {
      // 触发内存压力事件
      this.memoryMonitor.emitEvent?.('memoryPressure', {
        type: 'memoryPressure',
        timestamp: new Date(),
        memoryStatus,
        details: { 
          level: usagePercent > 95 ? 'emergency' : usagePercent > 90 ? 'critical' : 'warning'
        }
      });
    }
    
    return {
      isWithinLimit,
      usagePercent,
      heapUsed: memoryStatus.heapUsed,
      heapTotal: memoryStatus.heapTotal,
      external: memoryStatus.external,
      arrayBuffers: 0 // 需要从 process.memoryUsage() 获取
    };
  }
}
```

### 2.3 增强 MemoryMonitorService 事件系统

#### 当前问题
事件系统存在但未被充分利用。

#### 优化方案
```typescript
// MemoryMonitorService.ts - 增强事件系统
export class MemoryMonitorService implements IMemoryMonitorService {
  // ... 现有代码
  
  private handleWarningMemory(memoryUsage: NodeJS.MemoryUsage, heapUsedPercent: number): void {
    // ... 现有代码
    
    // 触发内存压力事件
    this.emitEvent('memoryPressure', {
      type: 'memoryPressure',
      timestamp: new Date(),
      memoryStatus: this.getMemoryStatus(),
      details: { level: 'warning' }
    });
  }
  
  private handleCriticalMemory(memoryUsage: NodeJS.MemoryUsage, heapUsedPercent: number): void {
    // ... 现有代码
    
    // 触发内存压力事件
    this.emitEvent('memoryPressure', {
      type: 'memoryPressure',
      timestamp: new Date(),
      memoryStatus: this.getMemoryStatus(),
      details: { level: 'critical' }
    });
  }
  
  private handleEmergencyMemory(memoryUsage: NodeJS.MemoryUsage, heapUsedPercent: number): void {
    // ... 现有代码
    
    // 触发内存压力事件
    this.emitEvent('memoryPressure', {
      type: 'memoryPressure',
      timestamp: new Date(),
      memoryStatus: this.getMemoryStatus(),
      details: { level: 'emergency' }
    });
  }
}
```

### 2.4 统一依赖注入配置

#### 优化方案
```typescript
// BusinessServiceRegistrar.ts - 统一配置
export class BusinessServiceRegistrar {
  registerServices(container: Container): void {
    // ... 其他服务注册
    
    // 内存监控服务
    container.bind<IMemoryMonitorService>(TYPES.MemoryMonitorService).to(MemoryMonitorService).inSingletonScope();
    
    // MemoryGuard 参数
    container.bind<number>(TYPES.MemoryLimitMB).toConstantValue(500);
    container.bind<number>(TYPES.MemoryCheckIntervalMs).toConstantValue(5000);
    
    // 注册 GuardCoordinator
    container.bind<GuardCoordinator>(TYPES.UnifiedGuardCoordinator).toDynamicValue(context => {
      const memoryMonitorService = context.get<IMemoryMonitorService>(TYPES.MemoryMonitorService);
      const errorThresholdInterceptor = context.get<ErrorThresholdInterceptor>(TYPES.ErrorThresholdManager);
      const cleanupManager = context.get<CleanupManager>(TYPES.CleanupManager);
      const serviceContainer = context.get<IServiceContainer>(TYPES.ServiceContainer);
      const memoryLimitMB = context.get<number>(TYPES.MemoryLimitMB);
      const memoryCheckIntervalMs = context.get<number>(TYPES.MemoryCheckIntervalMs);
      const logger = context.container.isBound(TYPES.LoggerService) 
        ? context.get<LoggerService>(TYPES.LoggerService) 
        : undefined;
      
      return GuardCoordinator.getInstance(
        memoryMonitorService,
        errorThresholdInterceptor,
        cleanupManager,
        serviceContainer,
        memoryLimitMB,
        memoryCheckIntervalMs,
        logger
      );
    }).inSingletonScope();
  }
}
```

## 3. 实施计划

### 阶段一：修复关键问题（1-2天）
1. 修改 `GuardCoordinator` 使用 `IMemoryMonitorService` 接口
2. 更新 `GuardCoordinator` 的内存相关方法，充分利用 `MemoryMonitorService`
3. 更新依赖注入配置

### 阶段二：简化重复逻辑（2-3天）
1. 简化 `MemoryGuard`，委托更多功能给 `MemoryMonitorService`
2. 增强 `MemoryMonitorService` 事件系统
3. 更新相关测试

### 阶段三：优化和增强（3-5天）
1. 性能优化
2. 添加更多监控指标
3. 完善文档和示例

## 4. 测试策略

### 4.1 单元测试
- 测试 `GuardCoordinator` 使用 `MemoryMonitorService` 的功能
- 测试事件系统的正确性
- 测试内存压力响应机制

### 4.2 集成测试
- 验证各服务之间的协作
- 测试内存压力场景下的行为
- 验证配置更新功能

### 4.3 性能测试
- 测试内存监控的性能影响
- 验证内存清理效果
- 测试高负载下的稳定性

## 5. 风险评估

### 5.1 技术风险
- **低风险**: 主要是代码重构，不涉及核心逻辑变更
- **兼容性**: 需要确保现有功能不受影响

### 5.2 实施风险
- **测试覆盖**: 需要充分测试，确保重构不引入新问题
- **依赖关系**: 需要仔细管理服务间的依赖关系

## 6. 成功指标

1. **代码复用率提高**: 减少重复的内存监控代码
2. **接口统一性**: 所有服务都使用 `IMemoryMonitorService` 接口
3. **功能完整性**: `GuardCoordinator` 充分利用 `MemoryMonitorService` 功能
4. **性能保持**: 优化后性能不低于当前水平
5. **测试覆盖**: 新功能和重构部分有充分的测试覆盖

## 7. 总结

通过这些优化方案，我们可以：
- 提高代码复用性和一致性
- 简化服务间的依赖关系
- 增强内存监控的灵活性和可扩展性
- 为未来的功能扩展奠定良好基础

建议按照实施计划逐步进行，确保每个阶段都经过充分测试和验证。