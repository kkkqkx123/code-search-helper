import { Container } from 'inversify';
import { TYPES } from '../types';
import { MemoryMonitorService } from '../service/memory/MemoryMonitorService';
import { MemoryGuard } from '../service/parser/guard/MemoryGuard';
import { PerformanceOptimizerService } from '../infrastructure/batching/PerformanceOptimizerService';
import { LoggerService } from '../utils/LoggerService';
import { ErrorHandlerService } from '../utils/ErrorHandlerService';
import { ConfigService } from '../config/ConfigService';
import { EmbeddingCacheService } from '../embedders/EmbeddingCacheService';
import { BusinessServiceRegistrar } from '../core/registrars/BusinessServiceRegistrar';
import { EnvironmentConfigService } from '../config/service/EnvironmentConfigService';
import { QdrantConfigService } from '../config/service/QdrantConfigService';
import { EmbeddingConfigService } from '../config/service/EmbeddingConfigService';
import { LoggingConfigService } from '../config/service/LoggingConfigService';
import { MonitoringConfigService } from '../config/service/MonitoringConfigService';
import { MemoryMonitorConfigService } from '../config/service/MemoryMonitorConfigService';
import { FileProcessingConfigService } from '../config/service/FileProcessingConfigService';
import { BatchProcessingConfigService } from '../config/service/BatchProcessingConfigService';
import { RedisConfigService } from '../config/service/RedisConfigService';
import { ProjectConfigService } from '../config/service/ProjectConfigService';
import { IndexingConfigService } from '../config/service/IndexingConfigService';
import { LSPConfigService } from '../config/service/LSPConfigService';
import { SemgrepConfigService } from '../config/service/SemgrepConfigService';
import { TreeSitterConfigService } from '../config/service/TreeSitterConfigService';
import { ProjectNamingConfigService } from '../config/service/ProjectNamingConfigService';
import { EmbeddingBatchConfigService } from '../config/service/EmbeddingBatchConfigService';

// 在测试开始前设置环境变量
process.env.MEMORY_MONITORING_ENABLED = 'true';

describe('Memory Monitor Integration Tests', () => {
  let container: Container;
  let memoryMonitor: MemoryMonitorService;
  let memoryGuard: MemoryGuard;
  let performanceOptimizer: PerformanceOptimizerService;

  beforeEach(() => {
    container = new Container();

    // 注册配置服务
    container.bind<EnvironmentConfigService>(TYPES.EnvironmentConfigService).to(EnvironmentConfigService).inSingletonScope();
    container.bind<QdrantConfigService>(TYPES.QdrantConfigService).to(QdrantConfigService).inSingletonScope();
    container.bind<EmbeddingConfigService>(TYPES.EmbeddingConfigService).to(EmbeddingConfigService).inSingletonScope();
    container.bind<LoggingConfigService>(TYPES.LoggingConfigService).to(LoggingConfigService).inSingletonScope();
    container.bind<MonitoringConfigService>(TYPES.MonitoringConfigService).to(MonitoringConfigService).inSingletonScope();
    container.bind<MemoryMonitorConfigService>(TYPES.MemoryMonitorConfigService).to(MemoryMonitorConfigService).inSingletonScope();
    container.bind<FileProcessingConfigService>(TYPES.FileProcessingConfigService).to(FileProcessingConfigService).inSingletonScope();
    container.bind<BatchProcessingConfigService>(TYPES.BatchProcessingConfigService).to(BatchProcessingConfigService).inSingletonScope();
    container.bind<RedisConfigService>(TYPES.RedisConfigService).to(RedisConfigService).inSingletonScope();
    container.bind<ProjectConfigService>(TYPES.ProjectConfigService).to(ProjectConfigService).inSingletonScope();
    container.bind<IndexingConfigService>(TYPES.IndexingConfigService).to(IndexingConfigService).inSingletonScope();
    container.bind<LSPConfigService>(TYPES.LSPConfigService).to(LSPConfigService).inSingletonScope();
    container.bind<SemgrepConfigService>(TYPES.SemgrepConfigService).to(SemgrepConfigService).inSingletonScope();
    container.bind<TreeSitterConfigService>(TYPES.TreeSitterConfigService).to(TreeSitterConfigService).inSingletonScope();
    container.bind<ProjectNamingConfigService>(TYPES.ProjectNamingConfigService).to(ProjectNamingConfigService).inSingletonScope();
    container.bind<EmbeddingBatchConfigService>(TYPES.EmbeddingBatchConfigService).to(EmbeddingBatchConfigService).inSingletonScope();

    // 注册基础服务
    container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
    container.bind<ConfigService>(TYPES.ConfigService).to(ConfigService).inSingletonScope();
    container.bind<EmbeddingCacheService>(TYPES.EmbeddingCacheService).to(EmbeddingCacheService).inSingletonScope();

    // 注册内存相关服务
    BusinessServiceRegistrar.register(container);

    memoryMonitor = container.get<MemoryMonitorService>(TYPES.MemoryMonitorService);
    memoryGuard = container.get<MemoryGuard>(TYPES.MemoryGuard);
    performanceOptimizer = container.get<PerformanceOptimizerService>(TYPES.PerformanceOptimizerService);
  });

  afterEach(() => {
    // 清理资源
    if (memoryMonitor) {
      memoryMonitor.stopMonitoring();
      memoryMonitor.destroy();
    }
  });

  test('should have unified memory monitoring through MemoryMonitorService', () => {
    // 验证 MemoryMonitorService 正常工作
    expect(memoryMonitor).toBeDefined();

    const status = memoryMonitor.getMemoryStatus();
    expect(status).toHaveProperty('heapUsed');
    expect(status).toHaveProperty('heapTotal');
    expect(status).toHaveProperty('heapUsedPercent');
    expect(status).toHaveProperty('rss');
    expect(status).toHaveProperty('external');
    expect(status).toHaveProperty('isWarning');
    expect(status).toHaveProperty('isCritical');
    expect(status).toHaveProperty('isEmergency');
    expect(status).toHaveProperty('trend');
    expect(status).toHaveProperty('averageUsage');
    expect(status).toHaveProperty('timestamp');
  });

  test('should have MemoryGuard using unified MemoryMonitorService', () => {
    // 验证 MemoryGuard 使用统一的内存监控服务
    expect(memoryGuard).toBeDefined();

    // 验证 MemoryGuard 可以获取内存状态
    const stats = memoryGuard.getMemoryStats();
    expect(stats).toHaveProperty('current');
    expect(stats).toHaveProperty('limit');
    expect(stats).toHaveProperty('usagePercent');
    expect(stats).toHaveProperty('isWithinLimit');
    expect(stats).toHaveProperty('trend');
    expect(stats).toHaveProperty('averageUsage');

    // 验证 MemoryGuard 可以检查内存使用情况
    const checkResult = memoryGuard.checkMemoryUsage();
    expect(checkResult).toHaveProperty('isWithinLimit');
    expect(checkResult).toHaveProperty('usagePercent');
    expect(checkResult).toHaveProperty('heapUsed');
    expect(checkResult).toHaveProperty('heapTotal');
    expect(checkResult).toHaveProperty('external');
    expect(checkResult).toHaveProperty('arrayBuffers');
  });

  test('should have PerformanceOptimizerService using unified MemoryMonitorService', () => {
    // 验证 PerformanceOptimizerService 使用统一的内存监控服务
    expect(performanceOptimizer).toBeDefined();

    // 验证 PerformanceOptimizerService 可以执行操作
    const initialBatchSize = performanceOptimizer.getCurrentBatchSize();
    expect(initialBatchSize).toBeGreaterThan(0);

    // 验证内存优化功能
    performanceOptimizer.optimizeMemory();
  });

  test('should maintain consistent memory state across services', () => {
    // 验证所有服务访问的是统一的内存状态
    const monitorStatus = memoryMonitor.getMemoryStatus();
    const guardStats = memoryGuard.getMemoryStats();

    // 基本内存使用应该一致（允许小的差异，因为检查时间不同）
    expect(monitorStatus.heapUsed).toBeCloseTo(guardStats.current.heapUsed, -6); // 检查到MB级别
    expect(monitorStatus.heapTotal).toBeCloseTo(guardStats.current.heapTotal, -6);
  });

  test('should handle memory cleanup through unified service', () => {
    // 验证清理功能正常工作
    const initialStatus = memoryMonitor.getMemoryStatus();

    // 触发轻量级清理
    memoryMonitor.triggerCleanup('lightweight');
    const afterLightCleanup = memoryMonitor.getMemoryStatus();

    // 再触发深度清理
    memoryMonitor.triggerCleanup('deep');
    const afterDeepCleanup = memoryMonitor.getMemoryStatus();

    // 再触发紧急清理
    memoryMonitor.triggerCleanup('emergency');
    const afterEmergencyCleanup = memoryMonitor.getMemoryStatus();

    // 验证所有清理级别都执行了
    expect(afterLightCleanup).toBeDefined();
    expect(afterDeepCleanup).toBeDefined();
    expect(afterEmergencyCleanup).toBeDefined();
  });

  test('should support memory limit functionality', () => {
    // 验证内存限制功能
    const limitMB = 600; // 设置为600MB
    memoryMonitor.setMemoryLimit?.(limitMB);

    // 验证限制已设置
    const limit = memoryMonitor.getMemoryLimit?.();
    expect(limit).toBe(limitMB * 1024 * 1024); // 转换为字节

    // 验证是否在限制内
    const withinLimit = memoryMonitor.isWithinLimit?.();
    expect(withinLimit).toBe(true); // 应该在限制内，因为当前内存使用量远小于600MB
  });

  test('should support event handling', (done) => {
    // 验证事件处理功能
    const mockListener = jest.fn();

    if (memoryMonitor) {
      memoryMonitor.addEventListener('cleanup', mockListener);

      // 触发一个清理事件
      memoryMonitor.triggerCleanup('lightweight');

      // 短暂延迟以确保事件处理完成
      setTimeout(() => {
        expect(mockListener).toHaveBeenCalled();
        memoryMonitor.removeEventListener('cleanup', mockListener);
        done();
      }, 100);
    } else {
      done();
    }
  });
});