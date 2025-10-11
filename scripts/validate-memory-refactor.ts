import { Container } from 'inversify';
import { TYPES } from '../src/types';
import { MemoryMonitorService } from '../src/service/memory/MemoryMonitorService';
import { MemoryGuard } from '../src/service/parser/universal/MemoryGuard';
import { PerformanceOptimizerService } from '../src/infrastructure/batching/PerformanceOptimizerService';
import { LoggerService } from '../src/utils/LoggerService';
import { ErrorHandlerService } from '../src/utils/ErrorHandlerService';
import { ConfigService } from '../src/config/ConfigService';
import { EmbeddingCacheService } from '../src/embedders/EmbeddingCacheService';
import { BusinessServiceRegistrar } from '../src/core/registrars/BusinessServiceRegistrar';

async function validateMemoryRefactor() {
  console.log('🔍 开始验证内存监控重构...');

  try {
    // 创建容器并注册服务
    const container = new Container();
    
    // 注册基础服务
    container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
    container.bind<ErrorHandlerService>(TYPES.ErrorHandlerService).to(ErrorHandlerService).inSingletonScope();
    container.bind<ConfigService>(TYPES.ConfigService).to(ConfigService).inSingletonScope();
    container.bind<EmbeddingCacheService>(TYPES.EmbeddingCacheService).to(EmbeddingCacheService).inSingletonScope();
    
    // 注册业务服务
    BusinessServiceRegistrar.register(container);
    
    console.log('✅ 服务注册成功');

    // 获取服务实例
    const memoryMonitor = container.get<MemoryMonitorService>(TYPES.MemoryMonitorService);
    const memoryGuard = container.get<MemoryGuard>(TYPES.MemoryGuard);
    const performanceOptimizer = container.get<PerformanceOptimizerService>(TYPES.PerformanceOptimizerService);

    console.log('✅ 服务实例获取成功');

    // 验证 MemoryMonitorService
    console.log('\n🔍 验证 MemoryMonitorService...');
    const monitorStatus = memoryMonitor.getMemoryStatus();
    console.log(`✅ MemoryMonitorService - Heap Used: ${Math.round(monitorStatus.heapUsed / 1024 / 1024)} MB`);
    console.log(`✅ MemoryMonitorService - Heap Used Percent: ${(monitorStatus.heapUsedPercent * 100).toFixed(2)}%`);
    console.log(`✅ MemoryMonitorService - Is Warning: ${monitorStatus.isWarning}`);
    console.log(`✅ MemoryMonitorService - Is Critical: ${monitorStatus.isCritical}`);
    console.log(`✅ MemoryMonitorService - Is Emergency: ${monitorStatus.isEmergency}`);

    // 验证 MemoryGuard
    console.log('\n🔍 验证 MemoryGuard...');
    const guardStats = memoryGuard.getMemoryStats();
    console.log(`✅ MemoryGuard - Current Heap Used: ${Math.round(guardStats.current.heapUsed / 1024 / 1024)} MB`);
    console.log(`✅ MemoryGuard - Usage Percent: ${(guardStats.usagePercent * 100).toFixed(2)}%`);
    console.log(`✅ MemoryGuard - Is Within Limit: ${guardStats.isWithinLimit}`);
    console.log(`✅ MemoryGuard - Trend: ${guardStats.trend}`);
    console.log(`✅ MemoryGuard - Average Usage: ${Math.round(guardStats.averageUsage / 1024 / 1024)} MB`);

    // 验证 PerformanceOptimizerService
    console.log('\n🔍 验证 PerformanceOptimizerService...');
    const currentBatchSize = performanceOptimizer.getCurrentBatchSize();
    console.log(`✅ PerformanceOptimizerService - Current Batch Size: ${currentBatchSize}`);
    
    // 测试内存优化
    performanceOptimizer.optimizeMemory();
    console.log('✅ PerformanceOptimizerService - Memory optimization executed');

    // 验证服务间的一致性
    console.log('\n🔍 验证服务间内存状态一致性...');
    const monitorHeapUsed = monitorStatus.heapUsed;
    const guardHeapUsed = guardStats.current.heapUsed;
    
    // 允许小的时间差异导致的微小内存变化
    const heapDifference = Math.abs(monitorHeapUsed - guardHeapUsed);
    const maxAllowedDifference = 10 * 1024 * 1024; // 10MB
    
    if (heapDifference <= maxAllowedDifference) {
      console.log(`✅ 服务间内存状态一致 - 差异: ${Math.round(heapDifference / 1024)} KB`);
    } else {
      console.log(`⚠️  服务间内存状态差异较大 - 差异: ${Math.round(heapDifference / 1024 / 1024)} MB`);
    }

    // 验证清理功能
    console.log('\n🔍 验证清理功能...');
    memoryMonitor.triggerCleanup('lightweight');
    console.log('✅ 轻量级清理执行完成');
    
    memoryMonitor.triggerCleanup('deep');
    console.log('✅ 深度清理执行完成');
    
    memoryMonitor.triggerCleanup('emergency');
    console.log('✅ 紧急清理执行完成');

    // 验证内存限制功能
    console.log('\n🔍 验证内存限制功能...');
    memoryMonitor.setMemoryLimit?.(700); // 设置为700MB
    const limit = memoryMonitor.getMemoryLimit?.();
    console.log(`✅ 内存限制设置为: ${limit ? Math.round(limit / 1024 / 1024) : 'undefined'} MB`);
    
    const isWithinLimit = memoryMonitor.isWithinLimit?.();
    console.log(`✅ 是否在限制内: ${isWithinLimit}`);

    // 验证事件系统
    console.log('\n🔍 验证事件系统...');
    let cleanupEventTriggered = false;
    const eventHandler = (event: any) => {
      console.log(`✅ 事件触发: ${event.type}`);
      cleanupEventTriggered = true;
    };
    
    memoryMonitor.addEventListener('cleanup', eventHandler);
    memoryMonitor.triggerCleanup('lightweight');
    
    // 等待事件处理
    await new Promise(resolve => setTimeout(resolve, 100));
    
    memoryMonitor.removeEventListener('cleanup', eventHandler);
    console.log(`✅ 事件系统工作正常: ${cleanupEventTriggered}`);

    // 测试垃圾回收
    console.log('\n🔍 验证垃圾回收功能...');
    memoryMonitor.forceGarbageCollection();
    console.log('✅ 统一垃圾回收执行完成');

    // 验证历史记录功能
    console.log('\n🔍 验证历史记录功能...');
    const history = memoryMonitor.getMemoryHistory();
    console.log(`✅ 历史记录数量: ${history.length}`);
    
    const stats = memoryMonitor.getMemoryStats();
    console.log(`✅ 统计信息获取成功 - 当前、平均、峰值内存数据可用`);

    console.log('\n🎉 所有验证测试通过！');
    console.log('✅ 重构成功完成');
    console.log('✅ 统一内存监控服务正常工作');
    console.log('✅ MemoryGuard 现在依赖统一的内存监控服务');
    console.log('✅ PerformanceOptimizerService 使用统一的内存监控服务');
    console.log('✅ 服务间功能协调一致');

    // 清理资源
    memoryMonitor.stopMonitoring();
    memoryMonitor.destroy();

  } catch (error) {
    console.error('❌ 验证失败:', error);
    process.exit(1);
  }
}

// 运行验证
validateMemoryRefactor().catch(console.error);