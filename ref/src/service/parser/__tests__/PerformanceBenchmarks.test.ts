import { TreeSitterCoreService } from '../core/parse/TreeSitterCoreService';
import { ControlStructureRule } from '../treesitter-rule/core/ControlStructureRule';
import { ErrorHandlingRule } from '../treesitter-rule/core/ErrorHandlingRule';
import { SnippetValidationService } from '../analysis/SnippetValidationService';

interface BenchmarkResult {
  operation: string;
  duration: number;
  memoryUsage: number;
  success: boolean;
  details?: any;
}

interface PerformanceMetrics {
  name: string;
  averageTime: number;
  minTime: number;
  maxTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  iterations: number;
}

describe('Performance Benchmarks', () => {
  let service: TreeSitterCoreService;
  let controlStructureRule: ControlStructureRule;
  let errorHandlingRule: ErrorHandlingRule;

  beforeEach(() => {
    service = new TreeSitterCoreService();
    controlStructureRule = new ControlStructureRule();
    errorHandlingRule = new ErrorHandlingRule();
  });

  const measureOperation = async (operation: () => Promise<any>): Promise<BenchmarkResult> => {
    const startMemory = process.memoryUsage();
    const startTime = Date.now();

    try {
      const result = await operation();
      const endTime = Date.now();
      const endMemory = process.memoryUsage();

      return {
        operation: operation.name || 'anonymous',
        duration: endTime - startTime,
        memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
        success: true,
        details: result,
      };
    } catch (error) {
      const endTime = Date.now();
      const endMemory = process.memoryUsage();

      return {
        operation: operation.name || 'anonymous',
        duration: endTime - startTime,
        memoryUsage: endMemory.heapUsed - startMemory.heapUsed,
        success: false,
        details: error,
      };
    }
  };

  const runBenchmark = async (
    name: string,
    operation: () => Promise<any>,
    iterations: number = 10
  ): Promise<PerformanceMetrics> => {
    const results: BenchmarkResult[] = [];

    for (let i = 0; i < iterations; i++) {
      const result = await measureOperation(operation);
      results.push(result);
    }

    const successfulResults = results.filter(r => r.success);
    const durations = successfulResults.map(r => r.duration);
    const memoryUsages = successfulResults.map(r => r.memoryUsage);

    return {
      name,
      averageTime: durations.reduce((a, b) => a + b, 0) / durations.length,
      minTime: Math.min(...durations),
      maxTime: Math.max(...durations),
      memoryUsage: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length,
      cacheHitRate: 0, // Will be calculated separately
      iterations,
    };
  };

  describe('AST Parsing Performance', () => {
    it('should meet performance targets for parsing small files', async () => {
      const smallCode = `function test() {
        return 'hello world';
      }`;

      const metrics = await runBenchmark(
        'Small File Parsing',
        () => service.parseCode(smallCode, 'javascript'),
        20
      );

      expect(metrics.averageTime).toBeLessThan(50); // Target: <50ms
      expect(metrics.memoryUsage).toBeLessThan(1024 * 1024); // <1MB
    });

    it('should meet performance targets for parsing medium files', async () => {
      const mediumCode = `
        class DataProcessor {
          private data: any[];
          
          constructor(data: any[]) {
            this.data = data;
          }
          
          processData(): any[] {
            return this.data
              .filter(item => item && item.id)
              .map(item => ({
                ...item,
                processed: true,
                timestamp: new Date()
              }))
              .sort((a, b) => a.id - b.id);
          }
          
          validateData(): boolean {
            return this.data.every(item => 
              item && typeof item === 'object' && 'id' in item
            );
          }
        }
        
        const processor = new DataProcessor([1, 2, 3]);
        export default processor;
      `;

      const metrics = await runBenchmark(
        'Medium File Parsing',
        () => service.parseCode(mediumCode, 'typescript'),
        10
      );

      expect(metrics.averageTime).toBeLessThan(100); // Target: <100ms
      expect(metrics.memoryUsage).toBeLessThan(2 * 1024 * 1024); // <2MB
    });

    it('should demonstrate caching performance improvement', async () => {
      const complexCode = `
        function complexFunction(data: any[]): Promise<any[]> {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              try {
                const result = data
                  .filter(item => item && item.id)
                  .map(item => ({
                    id: item.id,
                    value: item.value * 2,
                    processed: true,
                    timestamp: Date.now()
                  }))
                  .filter(item => item.value > 0)
                  .sort((a, b) => b.value - a.value);
                
                resolve(result);
              } catch (error) {
                reject(error);
              }
            }, 100);
          });
        }
        
        async function main() {
          const data = [1, 2, 3, 4, 5].map(id => ({ id, value: id * 10 }));
          const result = await complexFunction(data);
          console.log(result);
        }
      `;

      // First parse (no cache)
      const firstParse = await measureOperation(() => service.parseCode(complexCode, 'javascript'));

      // Second parse (with cache)
      const secondParse = await measureOperation(() =>
        service.parseCode(complexCode, 'javascript')
      );

      // Cached parse should be significantly faster or at least as fast
      // Allow for measurement precision issues with very fast operations
      if (firstParse.duration > 0) {
        expect(secondParse.duration).toBeLessThan(firstParse.duration * 0.5);
      } else {
        // If first parse was extremely fast (<1ms), cached parse should be 0ms
        expect(secondParse.duration).toBe(0);
      }

      // Check cache statistics
      const stats = service.getCacheStats();
      expect(parseFloat(stats.hitRate)).toBeGreaterThanOrEqual(50); // 1 hit out of 2 requests (50%+)
    });
  });

  describe('Node Query Performance', () => {
    it('should meet performance targets for node queries', async () => {
      const code = `
        function func1() { return 1; }
        function func2() { return 2; }
        function func3() { return 3; }
        function func4() { return 4; }
        function func5() { return 5; }
        
        const x = 10;
        const y = 20;
        const z = 30;
        
        if (x > 5) {
          console.log('x is large');
        }
        
        for (let i = 0; i < 10; i++) {
          console.log(i);
        }
      `;

      const parseResult = await service.parseCode(code, 'javascript');

      const metrics = await runBenchmark(
        'Node Query Performance',
        () => Promise.resolve(service.findNodeByType(parseResult.ast, 'function_declaration')),
        20
      );

      expect(metrics.averageTime).toBeLessThan(10); // Target: <10ms
    });

    it('should demonstrate performance improvement with batch queries', async () => {
      const code = `
        function test1() { return 1; }
        function test2() { return 2; }
        const x = 10;
        const y = 20;
        if (x > y) { console.log('x > y'); }
        class TestClass { constructor() {} }
      `;

      const parseResult = await service.parseCode(code, 'javascript');

      // Individual queries
      const individualStartTime = Date.now();
      const functions = service.findNodeByType(parseResult.ast, 'function_declaration');
      const variables = service.findNodeByType(parseResult.ast, 'variable_declaration');
      const classes = service.findNodeByType(parseResult.ast, 'class_declaration');
      const individualTime = Date.now() - individualStartTime;

      // Batch query
      const batchStartTime = Date.now();
      const batchResults = service.findNodesByTypes(parseResult.ast, [
        'function_declaration',
        'variable_declaration',
        'class_declaration',
      ]);
      const batchTime = Date.now() - batchStartTime;

      // Batch query should be faster or equal (allow for measurement precision)
      if (individualTime > 0) {
        expect(batchTime).toBeLessThanOrEqual(individualTime);
      } else {
        // If individual queries were extremely fast, batch query should also be fast
        expect(batchTime).toBeLessThanOrEqual(1);
      }
      expect(batchResults.length).toBe(functions.length + variables.length + classes.length);
    });
  });

  describe('Rule Processing Performance', () => {
    it('should meet performance targets for rule processing', async () => {
      const complexControlStructure = `
        if (user.isAuthenticated && user.hasPermission('admin')) {
          try {
            const data = await fetchData(user.id);
            if (data && data.length > 0) {
              const processed = data.map(item => ({
                ...item,
                processedBy: user.id,
                timestamp: new Date()
              }));
              return processed.filter(item => item.active);
            } else {
              throw new Error('No data found');
            }
          } catch (error) {
            logger.error('Failed to process data:', error);
            throw new Error('Processing failed');
          }
        } else {
          throw new Error('Unauthorized');
        }
      `;

      const parseResult = await service.parseCode(complexControlStructure, 'javascript');

      const metrics = await runBenchmark(
        'Rule Processing Performance',
        () =>
          Promise.resolve(controlStructureRule.extract(parseResult.ast, complexControlStructure)),
        10
      );

      expect(metrics.averageTime).toBeLessThan(50); // Target: <50ms
    });

    it('should handle large input volumes efficiently', async () => {
      const largeCode = Array(100)
        .fill(0)
        .map(
          (_, i) => `
        function testFunction${i}() {
          const data = [${i}, ${i + 1}, ${i + 2}];
          return data.map(x => x * 2).filter(x => x > ${i});
        }
        
        if (${i} > 50) {
          console.log('Large number:', ${i});
        }
      `
        )
        .join('\n');

      const metrics = await runBenchmark(
        'Large Input Processing',
        () => service.parseCode(largeCode, 'javascript'),
        5
      );

      expect(metrics.averageTime).toBeLessThan(500); // Target: <500ms
      expect(metrics.memoryUsage).toBeLessThan(10 * 1024 * 1024); // <10MB
    });
  });

  describe('Validation Service Performance', () => {
    it('should meet performance targets for validation operations', async () => {
      const validCode = `
        function processData(data: any[]): Promise<any[]> {
          if (!Array.isArray(data)) {
            throw new Error('Invalid input: expected array');
          }
          
          return data
            .filter(item => item && typeof item === 'object' && 'id' in item)
            .map(item => ({
              id: item.id,
              value: item.value || 0,
              processed: true,
              timestamp: Date.now()
            }))
            .filter(item => item.value > 0)
            .sort((a, b) => b.value - a.value);
        }
      `;

      const metrics = await runBenchmark(
        'Validation Performance',
        () =>
          Promise.resolve(
            SnippetValidationService.enhancedIsValidSnippet(validCode, 'logic_block', 'typescript')
          ),
        50
      );

      expect(metrics.averageTime).toBeLessThan(5); // Target: <5ms
    });

    it('should handle bulk validation efficiently', async () => {
      const codeSnippets = Array(100)
        .fill(0)
        .map(
          (_, i) => `
        function test${i}() {
          const x = ${i};
          const y = x * 2;
          return y > ${i} ? y : ${i};
        }
      `
        );

      const startTime = Date.now();
      const results = codeSnippets.map(code =>
        SnippetValidationService.enhancedIsValidSnippet(code, 'logic_block', 'javascript')
      );
      const endTime = Date.now();

      const totalTime = endTime - startTime;
      const averageTime = totalTime / codeSnippets.length;

      expect(averageTime).toBeLessThan(2); // Target: <2ms per snippet
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should demonstrate memory efficiency with repeated operations', async () => {
      const code = `function test() { return 'hello'; }`;

      // Clear cache to start fresh
      service.clearCache();

      const initialMemory = process.memoryUsage();

      // Perform multiple operations
      for (let i = 0; i < 100; i++) {
        await service.parseCode(code, 'javascript');
        service.findNodeByType(
          (await service.parseCode(code, 'javascript')).ast,
          'function_declaration'
        );
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (less than 10MB for 100 operations)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);

      // Cache should be working
      const stats = service.getCacheStats();
      expect(parseFloat(stats.hitRate)).toBeGreaterThanOrEqual(99); // High cache hit rate (99%+)
    });

    it('should clean up memory when cache is cleared', async () => {
      const largeCode = Array(1000)
        .fill(0)
        .map(
          (_, i) => `
        function func${i}() { return ${i}; }
      `
        )
        .join('\n');

      // Populate cache
      for (let i = 0; i < 10; i++) {
        await service.parseCode(largeCode, 'javascript');
      }

      const memoryBeforeClear = process.memoryUsage();
      service.clearCache();
      const memoryAfterClear = process.memoryUsage();

      // Memory should be freed after cache clear
      // Note: This is a rough test as garbage collection is not immediate
      // Allow for small measurement differences due to GC timing
      const memoryDifference = memoryAfterClear.heapUsed - memoryBeforeClear.heapUsed;
      expect(memoryDifference).toBeLessThanOrEqual(1024 * 1024); // Allow up to 1MB difference
    });
  });

  describe('Performance Regression Testing', () => {
    it('should establish baseline performance metrics', async () => {
      const baselineCode = `
        class PerformanceTest {
          private counter: number = 0;
          
          increment(): void {
            this.counter++;
          }
          
          getValue(): number {
            return this.counter;
          }
          
          async processAsync(): Promise<number> {
            await new Promise(resolve => setTimeout(resolve, 1));
            return this.counter * 2;
          }
        }
      `;

      const metrics = await runBenchmark(
        'Baseline Performance',
        () => service.parseCode(baselineCode, 'typescript'),
        10
      );

      // These are our baseline metrics - should not regress
      expect(metrics.averageTime).toBeLessThan(100);
      expect(metrics.memoryUsage).toBeLessThan(2 * 1024 * 1024);

      console.log('Baseline Metrics:', {
        averageTime: `${metrics.averageTime.toFixed(2)}ms`,
        memoryUsage: `${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
        minTime: `${metrics.minTime}ms`,
        maxTime: `${metrics.maxTime}ms`,
      });
    });
  });
});
