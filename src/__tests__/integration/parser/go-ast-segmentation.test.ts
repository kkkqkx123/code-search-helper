import { UnifiedProcessingCoordinator } from '../../../service/parser/processing/coordination/UnifiedProcessingCoordinator';
import { UnifiedDetectionService } from '../../../service/parser/processing/detection/UnifiedDetectionService';
import { UnifiedStrategyManager } from '../../../service/parser/processing/strategies/manager/UnifiedStrategyManager';
import { SegmentationStrategyCoordinator } from '../../../service/parser/processing/coordination/SegmentationStrategyCoordinator';
import { UnifiedStrategyFactory } from '../../../service/parser/processing/strategies/factory/UnifiedStrategyFactory';
import { UnifiedConfigManager } from '../../../service/parser/config/UnifiedConfigManager';
import { TreeSitterService } from '../../../service/parser/core/parse/TreeSitterService';
import { TreeSitterCoreService } from '../../../service/parser/core/parse/TreeSitterCoreService';
import { LoggerService } from '../../../utils/LoggerService';
import { UnifiedGuardCoordinator } from '../../../service/parser/guard/UnifiedGuardCoordinator';
import { ErrorThresholdInterceptor } from '../../../service/parser/processing/utils/protection/ErrorThresholdInterceptor';
import { MemoryGuard } from '../../../service/parser/guard/MemoryGuard';
import { ProcessingStrategyFactory } from '../../../service/parser/processing/strategies/providers/ProcessingStrategyFactory';
import { IntelligentFallbackEngine } from '../../../service/parser/guard/IntelligentFallbackEngine';
import { PriorityManager } from '../../../service/parser/processing/strategies/priority/PriorityManager';
import { SmartStrategySelector } from '../../../service/parser/processing/strategies/priority/SmartStrategySelector';
import { FallbackManager } from '../../../service/parser/processing/strategies/priority/FallbackManager';
import { ConfigurationManagerAdapter } from './ConfigurationManagerAdapter';
import { UnifiedDetectionServiceAdapter } from './UnifiedDetectionServiceAdapter';
import * as fs from 'fs';
import * as path from 'path';

describe('Go AST Segmentation Integration Test', () => {
  let processingCoordinator: UnifiedProcessingCoordinator;
  let logger: LoggerService;

  beforeAll(() => {
    logger = new LoggerService();
    
    // 初始化核心服务
    const treeSitterCoreService = new TreeSitterCoreService();
    const treeSitterService = new TreeSitterService(treeSitterCoreService);
    const configManager = new UnifiedConfigManager();
    const detectionService = new UnifiedDetectionService(logger, configManager, treeSitterService);
    
    // 初始化策略相关组件
    const strategyFactory = new UnifiedStrategyFactory(logger);
    const priorityManager = new PriorityManager(logger);
    const smartSelector = new SmartStrategySelector(priorityManager, logger);
    const fallbackManager = new FallbackManager(priorityManager, logger);
    const strategyManager = new UnifiedStrategyManager(
      strategyFactory,
      configManager,
      logger,
      priorityManager,
      smartSelector,
      fallbackManager
    );
    
    // 初始化协调器
    const configManagerAdapter = new ConfigurationManagerAdapter(configManager);
    const segmentationStrategyCoordinator = new SegmentationStrategyCoordinator(logger, configManagerAdapter, priorityManager);
    
    // 创建ProcessingGuard的依赖
    const errorThresholdManager = new ErrorThresholdInterceptor({ maxErrorCount: 5 }, logger);

    // 创建IMemoryMonitorService的简单实现
    const memoryMonitor: any = {
      getMemoryStatus: () => ({
        heapUsed: process.memoryUsage().heapUsed,
        heapTotal: process.memoryUsage().heapTotal,
        heapUsedPercent: process.memoryUsage().heapUsed / process.memoryUsage().heapTotal,
        rss: process.memoryUsage().rss,
        external: process.memoryUsage().external || 0,
        isWarning: false,
        isCritical: false,
        isEmergency: false,
        trend: 'stable',
        averageUsage: process.memoryUsage().heapUsed,
        timestamp: new Date()
      }),
      forceGarbageCollection: () => {
        if (typeof global !== 'undefined' && global.gc) {
          global.gc();
        }
      },
      triggerCleanup: () => { },
      isWithinLimit: () => true,
      setMemoryLimit: () => { }
    };

    const memoryGuard = new MemoryGuard(memoryMonitor, 500, 5000, logger);

    // 创建CleanupManager
    const cleanupManager: any = {
      performCleanup: async () => ({ success: true, memoryFreed: 0, cleanedCaches: [] })
    };

    // 创建UnifiedGuardCoordinator
    const detectionServiceAdapter = new UnifiedDetectionServiceAdapter(detectionService, logger);
    const guardCoordinator = UnifiedGuardCoordinator.getInstance(
      memoryMonitor,
      errorThresholdManager,
      cleanupManager,
      detectionServiceAdapter,
      new ProcessingStrategyFactory(logger),
      new IntelligentFallbackEngine(logger),
      500, // memoryLimitMB
      5000, // memoryCheckIntervalMs
      logger
    );

    // 初始化UnifiedGuardCoordinator
    guardCoordinator.initialize();

    // 创建处理协调器
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

    processingCoordinator = new UnifiedProcessingCoordinator(
      strategyManager,
      detectionService,
      configManager,
      guardCoordinator,
      performanceMonitor,
      configCoordinator,
      segmentationCoordinator,
      logger
    );
  });

  it('should correctly segment Go file using AST strategy', async () => {
    // 读取测试文件
    const filePath = path.join(process.cwd(), 'test-files', 'dataStructure', 'datastructure', 'linked_list.go');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    const context = {
      filePath,
      content,
      options: {}
    };

    const result = await processingCoordinator.processFile(context);
    
    console.log('Processing result:', JSON.stringify(result, null, 2));
    
    expect(result.success).toBe(true);
    expect(result.chunks.length).toBeGreaterThan(1); // 应该生成多个分段
    expect(result.language).toBe('go');
    expect(result.processingStrategy).toBe('treesitter_ast');
    
    // 验证分段包含结构体和函数
    const chunkContents = result.chunks.map((chunk: any) => chunk.content);
    
    // 应该包含node结构体定义
    expect(chunkContents.some(c => c.includes('type node struct'))).toBe(true);
    
    // 应该包含linkedList结构体定义
    expect(chunkContents.some(c => c.includes('type linkedList struct'))).toBe(true);
    
    // 应该包含NewLinkedList函数
    expect(chunkContents.some(c => c.includes('func NewLinkedList()'))).toBe(true);
    
    // 应该包含ListIsEmpty函数
    expect(chunkContents.some(c => c.includes('func ListIsEmpty('))).toBe(true);
    
    // 应该包含Append函数
    expect(chunkContents.some(c => c.includes('func Append('))).toBe(true);
    
    // 应该包含PrintList函数
    expect(chunkContents.some(c => c.includes('func PrintList('))).toBe(true);
    
    // 应该包含DeleteNode函数
    expect(chunkContents.some(c => c.includes('func DeleteNode('))).toBe(true);
    
    // 应该包含main函数
    expect(chunkContents.some(c => c.includes('func main()'))).toBe(true);
    
    // 验证每个分段都有正确的元数据
    for (const chunk of result.chunks) {
      expect(chunk.metadata).toBeDefined();
      expect(chunk.metadata.type).toBeDefined();
      expect(['function', 'class']).toContain(chunk.metadata.type); // Go中结构体被视为类
      expect(chunk.metadata.startLine).toBeDefined();
      expect(chunk.metadata.endLine).toBeDefined();
      expect(chunk.metadata.language).toBe('go');
    }
  }, 30000); // 增加超时时间，因为TreeSitter初始化可能需要时间

  it('should correctly extract AST nodes from Go file', async () => {
    // 读取测试文件
    const filePath = path.join(process.cwd(), 'test-files', 'dataStructure', 'datastructure', 'linked_list.go');
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // 直接测试TreeSitter服务
    const treeSitterCoreService = new TreeSitterCoreService();
    const treeSitterService = new TreeSitterService(treeSitterCoreService);
    
    // 等待初始化完成
    const maxWaitTime = 10000;
    const startTime = Date.now();
    while (!treeSitterCoreService.isInitialized() && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    expect(treeSitterCoreService.isInitialized()).toBe(true);
    
    // 检测语言
    const detectedLanguage = await treeSitterService.detectLanguage(filePath);
    expect(detectedLanguage).toBeDefined();
    expect(detectedLanguage?.name).toBe('go');
    
    // 解析代码
    const parseResult = await treeSitterService.parseCode(content, 'go');
    expect(parseResult.success).toBe(true);
    expect(parseResult.ast).toBeDefined();
    
    // 提取函数和类
    const functions = await treeSitterService.extractFunctions(parseResult.ast, 'go');
    const classes = await treeSitterService.extractClasses(parseResult.ast, 'go');
    
    console.log(`Extracted ${functions.length} functions and ${classes.length} classes`);
    
    // 应该提取到多个函数和结构体
    expect(functions.length).toBeGreaterThan(0);
    expect(classes.length).toBeGreaterThan(0);
    
    // 验证函数节点
    for (const func of functions) {
      const location = treeSitterService.getNodeLocation(func);
      const text = treeSitterService.getNodeText(func, content);
      
      expect(location.startLine).toBeGreaterThan(0);
      expect(location.endLine).toBeGreaterThan(0);
      expect(text.length).toBeGreaterThan(0);
      expect(func.type).toBe('function_declaration');
    }
    
    // 验证类（结构体）节点
    for (const cls of classes) {
      const location = treeSitterService.getNodeLocation(cls);
      const text = treeSitterService.getNodeText(cls, content);
      
      expect(location.startLine).toBeGreaterThan(0);
      expect(location.endLine).toBeGreaterThan(0);
      expect(text.length).toBeGreaterThan(0);
      expect(cls.type).toBe('type_declaration');
    }
  }, 30000);
});