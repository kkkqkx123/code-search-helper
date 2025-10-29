import { UnifiedProcessingCoordinator } from '../../../service/parser/processing/coordination/UnifiedProcessingCoordinator';
import { UnifiedStrategyManager } from '../../../service/parser/processing/strategies/manager/UnifiedStrategyManager';
import { UnifiedDetectionService } from '../../../service/parser/processing/detection/UnifiedDetectionService';
import { UnifiedConfigManager } from '../../../service/parser/config/UnifiedConfigManager';
import { UnifiedGuardCoordinator } from '../../../service/parser/guard/UnifiedGuardCoordinator';
import { LoggerService } from '../../../utils/LoggerService';
import { ProcessingResult, ProcessingContext } from '../../../service/parser/processing/coordination/UnifiedProcessingCoordinator';

/**
 * 适配器类，用于创建UnifiedProcessingCoordinator实例
 * 解决类型不匹配问题
 */
export class UnifiedProcessingCoordinatorAdapter {
  private strategyManager: UnifiedStrategyManager;
  private detectionService: UnifiedDetectionService;
  private configManager: UnifiedConfigManager;
  private guardCoordinator: UnifiedGuardCoordinator;
  private logger?: LoggerService;

  constructor(
    strategyManager: UnifiedStrategyManager,
    detectionService: UnifiedDetectionService,
    configManager: UnifiedConfigManager,
    guardCoordinator: UnifiedGuardCoordinator,
    logger?: LoggerService
  ) {
    this.strategyManager = strategyManager;
    this.detectionService = detectionService;
    this.configManager = configManager;
    this.guardCoordinator = guardCoordinator;
    this.logger = logger;
  }

  /**
   * 创建并返回UnifiedProcessingCoordinator实例
   */
  createCoordinator(): UnifiedProcessingCoordinator {
    // 创建简化的性能监控和配置协调器
    const performanceMonitor = { 
      monitorAsyncOperation: async (name: string, fn: () => Promise<any>) => await fn(),
      setThreshold: () => {},
      getPerformanceStats: () => ({})
    } as any;
    
    const configCoordinator = {
      onConfigUpdate: (callback: (event: any) => void) => {},
      emitConfigUpdate: (event: any) => {}
    } as any;
    
    const segmentationCoordinator = {
      selectStrategy: () => ({ getName: () => 'default' } as any),
      executeStrategy: async () => [],
      createSegmentationContext: () => ({})
    } as any;

    return new UnifiedProcessingCoordinator(
      this.strategyManager,
      this.detectionService,
      this.configManager,
      this.guardCoordinator,
      performanceMonitor,
      configCoordinator,
      segmentationCoordinator,
      this.logger
    );
  }

  /**
   * 处理文件
   */
  async processFile(context: ProcessingContext): Promise<ProcessingResult> {
    const coordinator = this.createCoordinator();
    return await coordinator.processFile(context);
  }

  /**
   * 批量处理文件
   */
  async processFiles(contextList: ProcessingContext[]): Promise<ProcessingResult[]> {
    const coordinator = this.createCoordinator();
    return await coordinator.processFiles(contextList);
  }

  /**
   * 获取可用的策略信息
   */
  getAvailableStrategies(): Array<{
    name: string;
    description: string;
    supportedLanguages: string[];
    priority: number;
    supportsAST: boolean;
  }> {
    const coordinator = this.createCoordinator();
    return coordinator.getAvailableStrategies();
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    const coordinator = this.createCoordinator();
    return coordinator.getSupportedLanguages();
  }

  /**
   * 重置统计
   */
  resetStats(): void {
    const coordinator = this.createCoordinator();
    coordinator.resetStats();
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: {
      strategyManager: boolean;
      detectionService: boolean;
      configManager: boolean;
      totalStrategies: number;
      supportedLanguages: number;
    };
  }> {
    const coordinator = this.createCoordinator();
    return await coordinator.healthCheck();
  }
}