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
import { ProjectConfigService } from '../config/service/ProjectConfigService';
import { IndexingConfigService } from '../config/service/IndexingConfigService';
import { TreeSitterConfigService } from '../config/service/TreeSitterConfigService';
import { ProjectNamingConfigService } from '../config/service/ProjectNamingConfigService';
import { EmbeddingBatchConfigService } from '../config/service/EmbeddingBatchConfigService';

// 在测试开始前设置环境变量 - 禁用内存监控
process.env.MEMORY_MONITORING_ENABLED = 'false';

describe('Memory Monitor Disabled Tests', () => {
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
    container.bind<ProjectConfigService>(TYPES.ProjectConfigService).to(ProjectConfigService).inSingletonScope();
    container.bind<IndexingConfigService>(TYPES.IndexingConfigService).to(IndexingConfigService).inSingletonScope();
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

  test('should have unified memory monitoring through MemoryMonitorService when disabled', () => {
    // 验证 MemoryMonitorService 正常工作
    expect(memoryMonitor).toBeDefined();

    // 获取内存状态
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

    // 检查监控状态
    const config = memoryMonitor.getConfig();
    expect(config.enabled).toBe(false);
  });

  test('should have MemoryGuard using unified MemoryMonitorService when disabled', () => {
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

  test('should handle memory cleanup when monitoring is disabled', () => {
    // 验证清理功能正常工作，即使监控被禁用
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

  test('should support memory limit functionality when monitoring is disabled', () => {
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
});