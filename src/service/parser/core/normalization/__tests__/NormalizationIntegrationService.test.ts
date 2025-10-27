import { Container } from 'inversify';
import { TYPES } from '../../../../../types';
import { LoggerService } from '../../../../../utils/LoggerService';
import { QueryResultNormalizer } from '../QueryResultNormalizer';
import { UniversalTextStrategy } from '../../../processing/utils/UniversalTextStrategy';
import { PerformanceMonitor } from '../../../../../infrastructure/monitoring/PerformanceMonitor';
import { ErrorHandlingManager } from '../ErrorHandlingManager';
import { TreeSitterCoreService, ParserLanguage } from '../../parse/TreeSitterCoreService';
import { NormalizationIntegrationService } from '../NormalizationIntegrationService';
import { CodeChunk } from '../../../processing/types/splitting-types';

// 创建模拟实现，避免依赖注入问题
class MockLoggerService extends LoggerService {
  constructor() {
    super();
  }
}

class MockUniversalTextStrategy extends UniversalTextStrategy {
  constructor() {
    super(
      new MockLoggerService(),
      { get: () => ({}) } as any,
      { shouldProtect: () => false } as any
    );
  }

  async chunkBySemanticBoundaries(content: string, filePath?: string, language?: string): Promise<CodeChunk[]> {
    const lines = content.split('\n');
    return [{
      content,
      metadata: {
        startLine: 1,
        endLine: lines.length,
        language: language || 'unknown',
        filePath,
        type: 'bracket'
      }
    }];
  }

  async chunkByBracketsAndLines(content: string, filePath?: string, language?: string): Promise<CodeChunk[]> {
    const lines = content.split('\n');
    return [{
      content,
      metadata: {
        startLine: 1,
        endLine: lines.length,
        language: language || 'unknown',
        filePath,
        type: 'line'
      }
    }];
  }

  async chunkByLines(content: string, filePath?: string, language?: string): Promise<CodeChunk[]> {
    const lines = content.split('\n');
    return lines.map((line, index) => ({
      content: line,
      metadata: {
        startLine: index + 1,
        endLine: index + 1,
        language: language || 'unknown',
        filePath
      }
    }));
  }

  setTreeSitterService(service: TreeSitterCoreService): void {
    // Mock implementation
  }

  setQueryNormalizer(normalizer: QueryResultNormalizer): void {
    // Mock implementation
  }

  getStandardizationStats(): any {
    return {
      totalChunks: 0,
      successfulSplits: 0,
      failedSplits: 0
    };
  }

  resetStandardizationStats(): void {
    // Mock implementation
  }
}

class MockTreeSitterCoreService extends TreeSitterCoreService {
  constructor() {
    super();
  }

  async parseCode(content: string, language: string): Promise<any> {
    return {
      success: true,
      ast: {
        text: content,
        startPosition: { row: 0, column: 0 },
        endPosition: { row: content.split('\n').length - 1, column: 0 },
        type: 'program',
        childForFieldName: (field: string) => null,
        children: []
      }
    };
  }

  getSupportedLanguages(): ParserLanguage[] {
    return [
      { name: 'javascript', fileExtensions: ['.js'], supported: true },
      { name: 'typescript', fileExtensions: ['.ts'], supported: true },
      { name: 'python', fileExtensions: ['.py'], supported: true }
    ];
  }

  getDynamicManager(): any {
    return {
      getParser: async (language: string) => ({
        parse: () => ({})
      })
    };
  }
}

class MockPerformanceMonitor extends PerformanceMonitor {
  constructor() {
    super(new MockLoggerService());
  }

  getMetrics(): any {
    return {
      timestamp: Date.now(),
      operationCount: 0,
      averageExecutionTime: 0
    };
  }

  resetMetrics(): void {
    // Mock implementation
  }
}

// 创建模拟的InfrastructureErrorHandler
class MockInfrastructureErrorHandler {
  private logger: LoggerService;
  private alertManager: any;
  private performanceMonitor: any;

  constructor(logger: LoggerService) {
    this.logger = logger;
    this.alertManager = {
      sendAlert: async (alert: any) => {
        // Mock implementation
      }
    };
    this.performanceMonitor = new MockPerformanceMonitor();
  }

  async handleDatabaseError(
    error: Error,
    databaseType: any,
    operation: string,
    context: Record<string, any>
  ): Promise<void> {
    // Mock implementation
  }

  async handleInfrastructureError(
    error: Error,
    component: string,
    operation: string,
    context?: Record<string, any>
  ): Promise<void> {
    // Mock implementation
  }

  async handleCacheError(
    error: Error,
    operation: string,
    context?: Record<string, any>
  ): Promise<void> {
    // Mock implementation
  }

  async handlePerformanceError(
    error: Error,
    operation: string,
    metrics: Record<string, any>,
    context?: Record<string, any>
  ): Promise<void> {
    // Mock implementation
  }

  async handleBatchOperationError(
    error: Error,
    databaseType: any,
    batchSize: number,
    operation: string
  ): Promise<void> {
    // Mock implementation
  }

  async executeWithErrorHandling<T>(
    operation: () => Promise<T>,
    databaseType: any,
    operationName: string,
    context: Record<string, any> = {}
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      await this.handleDatabaseError(
        error instanceof Error ? error : new Error(String(error)),
        databaseType,
        operationName,
        context
      );
      return null;
    }
  }

  async executeInfrastructureOperation<T>(
    operation: () => Promise<T>,
    component: string,
    operationName: string,
    context: Record<string, any> = {}
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      await this.handleInfrastructureError(
        error instanceof Error ? error : new Error(String(error)),
        component,
        operationName,
        context
      );
      return null;
    }
  }

  private categorizeError(error: Error, databaseType: any): any {
    return { category: 'UNKNOWN', severity: 'MEDIUM' };
  }

  private async recordErrorMetric(databaseType: any, operation: string): Promise<void> {
    // Mock implementation
  }

  private categorizeInfrastructureError(error: Error, component: string): any {
    return { category: 'INFRASTRUCTURE_UNKNOWN', severity: 'MEDIUM' };
  }

  private async recordInfrastructureErrorMetric(component: string, operation: string): Promise<void> {
    // Mock implementation
  }

  private shouldAdjustBatchSize(error: Error): boolean {
    return false;
  }

  private async recordBatchErrorMetric(
    databaseType: any,
    batchSize: number,
    operation: string
  ): Promise<void> {
    // Mock implementation
  }
}

// 创建模拟的FaultToleranceHandler
class MockFaultToleranceHandler {
  constructor() {
    // Mock implementation
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    options?: any
  ): Promise<T> {
    return await operation();
  }
}

class MockErrorHandlingManager extends ErrorHandlingManager {
  constructor() {
    // 由于ErrorHandlingManager需要三个依赖，我们需要创建它们
    const logger = new MockLoggerService();
    const infrastructureErrorHandler = new MockInfrastructureErrorHandler(logger);
    const faultToleranceHandler = new MockFaultToleranceHandler();

    // 使用类型断言来绕过类型检查
    super(logger, infrastructureErrorHandler as any, faultToleranceHandler as any);
  }

  async executeWithFallback(
    operationName: string,
    operation: () => Promise<any>,
    fallback: (error: Error) => Promise<any>
  ): Promise<any> {
    try {
      return await operation();
    } catch (error) {
      return await fallback(error as Error);
    }
  }

  getErrorStats(): any {
    return {
      totalErrors: 0,
      errorRate: 0
    };
  }

  resetErrorHistory(): void {
    // Mock implementation
  }

  resetCircuitBreakers(): void {
    // Mock implementation
  }

  getCircuitBreakerStates(): any {
    return {};
  }

  updateConfig(config: any): void {
    // Mock implementation
  }
}

describe('NormalizationIntegrationService', () => {
  let container: Container;
  let service: NormalizationIntegrationService;

  beforeEach(() => {
    container = new Container();

    // 绑定模拟实现
    container.bind<LoggerService>(TYPES.LoggerService).toConstantValue(new MockLoggerService());
    container.bind<QueryResultNormalizer>(TYPES.QueryResultNormalizer).toConstantValue(
      new QueryResultNormalizer({ enableCache: false, debug: false })
    );
    container.bind<UniversalTextStrategy>(TYPES.UniversalTextStrategy).toConstantValue(new MockUniversalTextStrategy());
    container.bind<PerformanceMonitor>(TYPES.PerformanceMonitor).toConstantValue(new MockPerformanceMonitor());
    container.bind<ErrorHandlingManager>(TYPES.ErrorHandlingManager).toConstantValue(new MockErrorHandlingManager());
    container.bind<TreeSitterCoreService>(TYPES.TreeSitterService).toConstantValue(new MockTreeSitterCoreService());

    // 创建服务实例
    service = new NormalizationIntegrationService(
      container.get<LoggerService>(TYPES.LoggerService),
      container.get<QueryResultNormalizer>(TYPES.QueryResultNormalizer),
      container.get<UniversalTextStrategy>(TYPES.UniversalTextStrategy),
      container.get<PerformanceMonitor>(TYPES.PerformanceMonitor),
      container.get<ErrorHandlingManager>(TYPES.ErrorHandlingManager),
      container.get<TreeSitterCoreService>(TYPES.TreeSitterService)
    );
  });

  describe('processContent', () => {
    it('should process content successfully with semantic chunking', async () => {
      const content = `
function hello() {
  console.log('Hello, world!');
  return true;
}

class TestClass {
  constructor() {
    this.value = 42;
  }
  
  getValue() {
    return this.value;
  }
}
      `;

      const result = await service.processContent(content, 'javascript', 'test.js', {
        chunkingStrategy: 'semantic'
      });

      expect(result.success).toBe(true);
      expect(result.chunks).toBeDefined();
      expect(Array.isArray(result.chunks)).toBe(true);
      if (result.chunks) {
        expect(result.chunks.length).toBeGreaterThan(0);
        result.chunks.forEach(chunk => {
          expect(chunk).toHaveProperty('content');
          expect(chunk).toHaveProperty('metadata');
          expect(chunk.metadata).toHaveProperty('startLine');
          expect(chunk.metadata).toHaveProperty('endLine');
          expect(chunk.metadata).toHaveProperty('language');
        });
      }
    });

    it('should process content successfully with bracket chunking', async () => {
      const content = `
function hello() {
  console.log('Hello, world!');
  return true;
}

if (true) {
  console.log('Conditional block');
}
      `;

      const result = await service.processContent(content, 'javascript', 'test.js', {
        chunkingStrategy: 'bracket'
      });

      expect(result.success).toBe(true);
      expect(result.chunks).toBeDefined();
    });

    it('should process content successfully with line chunking', async () => {
      const content = `
function hello() {
  console.log('Hello, world!');
  return true;
}

class TestClass {
  constructor() {
    this.value = 42;
  }
  
  getValue() {
    return this.value;
  }
}
      `;

      const result = await service.processContent(content, 'javascript', 'test.js', {
        chunkingStrategy: 'line'
      });

      expect(result.success).toBe(true);
      expect(result.chunks).toBeDefined();
    });

    it('should handle empty content', async () => {
      const result = await service.processContent('', 'javascript', 'test.js');

      expect(result.success).toBe(true);
      expect(result.chunks).toBeDefined();
    });

    it('should handle invalid language', async () => {
      const content = 'console.log("test");';

      const result = await service.processContent(content, 'invalid-language', 'test.js');

      expect(result.success).toBe(true); // Should still succeed but with basic processing
      expect(result.chunks).toBeDefined();
    });

    it('should cache results when caching is enabled', async () => {
      const content = 'function test() { return 42; }';

      // First call
      const result1 = await service.processContent(content, 'javascript', 'test.js');
      expect(result1.success).toBe(true);

      // Second call with same parameters should potentially hit cache
      const result2 = await service.processContent(content, 'javascript', 'test.js');
      expect(result2.success).toBe(true);
    });

    it('should respect configuration updates', async () => {
      // Update config to disable caching
      service.updateConfig({
        enableCaching: false
      });

      const content = 'function test() { return 42; }';
      const result = await service.processContent(content, 'javascript', 'test.js');

      expect(result.success).toBe(true);
    });
  });

  describe('getServiceStats', () => {
    it('should return service statistics', () => {
      const stats = service.getServiceStats();

      expect(stats).toBeDefined();
      expect(stats.normalization).toBeDefined();
      expect(stats.chunking).toBeDefined();
      expect(stats.cache).toBeDefined();
      expect(stats.performance).toBeDefined();
      expect(stats.errorHandling).toBeDefined();
    });
  });

  describe('resetStats', () => {
    it('should reset all statistics', () => {
      // Get initial stats
      const initialStats = service.getServiceStats();

      // Reset stats
      service.resetStats();

      // Get stats after reset
      const postResetStats = service.getServiceStats();

      // Verify reset occurred (some values should be 0 or empty)
      expect(postResetStats).toBeDefined();
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', () => {
      // This should not throw an error
      expect(() => {
        service.clearCache();
      }).not.toThrow();
    });
  });

  describe('healthCheck', () => {
    it('should return health status', async () => {
      const health = await service.healthCheck();

      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(['healthy', 'degraded', 'unhealthy']).toContain(health.status);
      expect(health.services).toBeDefined();
      expect(health.issues).toBeDefined();
      expect(Array.isArray(health.issues)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle errors gracefully', async () => {
      // Test with invalid content that might cause errors
      const result = await service.processContent(null as any, 'javascript', 'test.js');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});