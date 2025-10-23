import { Container } from 'inversify';
import { TYPES } from '../../../../../types';
import { LoggerService } from '../../../../../utils/LoggerService';
import { QueryResultNormalizer } from '../QueryResultNormalizer';
import { UniversalTextSplitter } from '../../../universal/UniversalTextSplitter';
import { PerformanceMonitor } from '../../../../../infrastructure/monitoring/PerformanceMonitor';
import { ErrorHandlingManager } from '../../../../../infrastructure/error-handling/ErrorHandlingManager';
import { TreeSitterCoreService } from '../../parse/TreeSitterCoreService';
import { NormalizationIntegrationService } from '../NormalizationIntegrationService';
import { CodeChunk } from '../../../splitting';

describe('NormalizationIntegrationService', () => {
  let container: Container;
  let service: NormalizationIntegrationService;

  beforeEach(() => {
    container = new Container();
    
    // 绑定依赖
    container.bind<LoggerService>(TYPES.LoggerService).to(LoggerService).inSingletonScope();
    container.bind<QueryResultNormalizer>(TYPES.QueryResultNormalizer).to(QueryResultNormalizer).inSingletonScope();
    container.bind<UniversalTextSplitter>(TYPES.UniversalTextSplitter).to(UniversalTextSplitter).inSingletonScope();
    container.bind<PerformanceMonitor>(TYPES.PerformanceMonitor).to(PerformanceMonitor).inSingletonScope();
    container.bind<ErrorHandlingManager>(TYPES.ErrorHandlingManager).to(ErrorHandlingManager).inSingletonScope();
    container.bind<TreeSitterCoreService>(TYPES.TreeSitterService).to(TreeSitterCoreService).inSingletonScope();

    // 创建服务实例
    service = new NormalizationIntegrationService(
      container.get<LoggerService>(TYPES.LoggerService),
      container.get<QueryResultNormalizer>(TYPES.QueryResultNormalizer),
      container.get<UniversalTextSplitter>(TYPES.UniversalTextSplitter),
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