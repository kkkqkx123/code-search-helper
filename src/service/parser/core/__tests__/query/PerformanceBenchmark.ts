import Parser from 'tree-sitter';
import { TreeSitterQueryEngine } from '../../query/TreeSitterQueryExecutor';
import { TreeSitterQueryFacade } from '../../query/TreeSitterQueryFacade';
import { TestDataGenerator } from './TestDataGenerator';

/**
 * 性能基准测试工具
 * 提供更准确的性能测量和分析
 */
export class PerformanceBenchmark {
  private queryEngine: TreeSitterQueryEngine;

  constructor() {
    this.queryEngine = new TreeSitterQueryEngine();
  }

  /**
   * 运行完整的性能基准测试
   */
  async runFullBenchmark(): Promise<BenchmarkResults> {
    console.log('\n🚀 Starting Performance Benchmark...\n');

    const results: BenchmarkResults = {
      timestamp: Date.now(),
      tests: []
    };

    // 1. 小型AST性能测试
    results.tests.push(await this.benchmarkSmallAST());

    // 2. 中型AST性能测试
    results.tests.push(await this.benchmarkMediumAST());

    // 3. 大型AST性能测试
    results.tests.push(await this.benchmarkLargeAST());

    // 4. 缓存效率测试
    results.tests.push(await this.benchmarkCacheEfficiency());

    // 5. TreeSitterQueryFacade vs TreeSitterQueryEngine对比
    results.tests.push(await this.benchmarkEngineComparison());

    // 6. 内存使用测试
    results.tests.push(await this.benchmarkMemoryUsage());

    this.printSummary(results);
    return results;
  }

  /**
   * 小型AST性能基准测试
   */
  private async benchmarkSmallAST(): Promise<BenchmarkTest> {
    console.log('📊 Benchmarking Small AST (10 functions)...');

    const ast = TestDataGenerator.createRealisticTypeScriptAST(10);
    const iterations = 50;
    const queryTypes = ['functions', 'classes', 'imports', 'exports'];

    const measurements: number[] = [];

    // 预热
    for (const queryType of queryTypes) {
      await this.queryEngine.executeQuery(ast, queryType, 'typescript');
    }

    // 实际测量
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();

      for (const queryType of queryTypes) {
        await this.queryEngine.executeQuery(ast, queryType, 'typescript');
      }

      const endTime = performance.now();
      measurements.push(endTime - startTime);
    }

    const stats = this.calculateStats(measurements);

    return {
      name: 'Small AST Performance',
      description: '10 functions, 5 classes, TypeScript',
      iterations,
      queryTypes,
      ...stats
    };
  }

  /**
   * 中型AST性能基准测试
   */
  private async benchmarkMediumAST(): Promise<BenchmarkTest> {
    console.log('📊 Benchmarking Medium AST (50 functions)...');

    const ast = TestDataGenerator.createRealisticTypeScriptAST(50);
    const iterations = 20;
    const queryTypes = ['functions', 'classes', 'imports', 'exports'];

    const measurements: number[] = [];

    // 预热
    for (const queryType of queryTypes) {
      await this.queryEngine.executeQuery(ast, queryType, 'typescript');
    }

    // 实际测量
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();

      for (const queryType of queryTypes) {
        await this.queryEngine.executeQuery(ast, queryType, 'typescript');
      }

      const endTime = performance.now();
      measurements.push(endTime - startTime);
    }

    const stats = this.calculateStats(measurements);

    return {
      name: 'Medium AST Performance',
      description: '50 functions, 25 classes, TypeScript',
      iterations,
      queryTypes,
      ...stats
    };
  }

  /**
   * 大型AST性能基准测试
   */
  private async benchmarkLargeAST(): Promise<BenchmarkTest> {
    console.log('📊 Benchmarking Large AST (100 functions)...');

    const ast = TestDataGenerator.createRealisticTypeScriptAST(100);
    const iterations = 10;
    const queryTypes = ['functions', 'classes', 'imports', 'exports'];

    const measurements: number[] = [];

    // 预热
    for (const queryType of queryTypes) {
      await this.queryEngine.executeQuery(ast, queryType, 'typescript');
    }

    // 实际测量
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();

      for (const queryType of queryTypes) {
        await this.queryEngine.executeQuery(ast, queryType, 'typescript');
      }

      const endTime = performance.now();
      measurements.push(endTime - startTime);
    }

    const stats = this.calculateStats(measurements);

    return {
      name: 'Large AST Performance',
      description: '100 functions, 50 classes, TypeScript',
      iterations,
      queryTypes,
      ...stats
    };
  }

  /**
   * 缓存效率基准测试
   */
  private async benchmarkCacheEfficiency(): Promise<BenchmarkTest> {
    console.log('📊 Benchmarking Cache Efficiency...');

    const ast = TestDataGenerator.createRealisticTypeScriptAST(20);
    const queryTypes = ['functions', 'classes', 'imports', 'exports'];

    // 清理缓存
    this.queryEngine.clearCache();
    TreeSitterQueryFacade.clearCache();

    const measurements: {
      firstRun: number;
      cachedRun: number;
      speedup: number;
    }[] = [];

    for (const queryType of queryTypes) {
      // 第一次运行（缓存未命中）
      const startTime1 = performance.now();
      await this.queryEngine.executeQuery(ast, queryType, 'typescript');
      const endTime1 = performance.now();
      const firstRun = endTime1 - startTime1;

      // 第二次运行（缓存命中）
      const startTime2 = performance.now();
      await this.queryEngine.executeQuery(ast, queryType, 'typescript');
      const endTime2 = performance.now();
      const cachedRun = endTime2 - startTime2;

      const speedup = firstRun / cachedRun;
      measurements.push({ firstRun, cachedRun, speedup });
    }

    const avgSpeedup = measurements.reduce((sum, m) => sum + m.speedup, 0) / measurements.length;
    const avgFirstRun = measurements.reduce((sum, m) => sum + m.firstRun, 0) / measurements.length;
    const avgCachedRun = measurements.reduce((sum, m) => sum + m.cachedRun, 0) / measurements.length;

    return {
      name: 'Cache Efficiency',
      description: 'Cache hit performance improvement',
      iterations: 1,
      queryTypes,
      averageTime: avgCachedRun,
      minTime: Math.min(...measurements.map(m => m.cachedRun)),
      maxTime: Math.max(...measurements.map(m => m.firstRun)),
      medianTime: avgCachedRun,
      p95Time: avgFirstRun,
      p99Time: avgFirstRun,
      standardDeviation: this.calculateStandardDeviation(measurements.map(m => m.cachedRun)),
      metadata: {
        avgSpeedup: avgSpeedup.toFixed(2) + 'x',
        avgFirstRun: avgFirstRun.toFixed(2) + 'ms',
        avgCachedRun: avgCachedRun.toFixed(2) + 'ms'
      }
    };
  }

  /**
   * 引擎对比基准测试
   */
  private async benchmarkEngineComparison(): Promise<BenchmarkTest> {
    console.log('📊 Benchmarking Engine Comparison...');

    const ast = TestDataGenerator.createRealisticTypeScriptAST(25);
    const iterations = 20;
    const queryTypes = ['functions', 'classes', 'imports', 'exports'];

    const simpleMeasurements: number[] = [];
    const complexMeasurements: number[] = [];

    // TreeSitterQueryFacade测试
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await TreeSitterQueryFacade.findAllMainStructures(ast, 'typescript');
      const endTime = performance.now();
      simpleMeasurements.push(endTime - startTime);
    }

    // TreeSitterQueryEngine测试
    for (let i = 0; i < iterations; i++) {
      const startTime = performance.now();
      await this.queryEngine.executeMultipleQueries(ast, queryTypes, 'typescript');
      const endTime = performance.now();
      complexMeasurements.push(endTime - startTime);
    }

    const simpleStats = this.calculateStats(simpleMeasurements);
    const complexStats = this.calculateStats(complexMeasurements);
    const overhead = ((simpleStats.averageTime - complexStats.averageTime) / complexStats.averageTime) * 100;

    return {
      name: 'Engine Comparison',
      description: 'TreeSitterQueryFacade vs TreeSitterQueryEngine',
      iterations,
      queryTypes,
      averageTime: simpleStats.averageTime,
      minTime: simpleStats.minTime,
      maxTime: simpleStats.maxTime,
      medianTime: simpleStats.medianTime,
      p95Time: simpleStats.p95Time,
      p99Time: simpleStats.p99Time,
      standardDeviation: simpleStats.standardDeviation,
      metadata: {
        simpleEngineAvg: simpleStats.averageTime.toFixed(2) + 'ms',
        complexEngineAvg: complexStats.averageTime.toFixed(2) + 'ms',
        overhead: overhead.toFixed(2) + '%'
      }
    };
  }

  /**
   * 内存使用基准测试
   */
  private async benchmarkMemoryUsage(): Promise<BenchmarkTest> {
    console.log('📊 Benchmarking Memory Usage...');

    const initialMemory = process.memoryUsage();

    // 执行大量查询
    const ast = TestDataGenerator.createRealisticTypeScriptAST(30);
    const queryTypes = ['functions', 'classes', 'imports', 'exports', 'methods', 'interfaces'];

    for (let i = 0; i < 100; i++) {
      for (const queryType of queryTypes) {
        await this.queryEngine.executeQuery(ast, queryType, 'typescript');
      }
    }

    const finalMemory = process.memoryUsage();
    const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

    const stats = this.queryEngine.getPerformanceStats();

    return {
      name: 'Memory Usage',
      description: 'Memory consumption during intensive querying',
      iterations: 100,
      queryTypes,
      averageTime: 0,
      minTime: 0,
      maxTime: 0,
      medianTime: 0,
      p95Time: 0,
      p99Time: 0,
      standardDeviation: 0,
      metadata: {
        initialMemory: (initialMemory.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        finalMemory: (finalMemory.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        memoryIncrease: (memoryIncrease / 1024 / 1024).toFixed(2) + ' MB',
        engineCacheSize: stats.engineCacheSize.toString(),
        queryCacheSize: stats.cacheStats.cacheSize.toString()
      }
    };
  }

  /**
   * 计算统计数据
   */
  private calculateStats(measurements: number[]): Omit<BenchmarkTest, 'name' | 'description' | 'iterations' | 'queryTypes' | 'metadata'> {
    const sorted = [...measurements].sort((a, b) => a - b);
    const sum = measurements.reduce((a, b) => a + b, 0);
    const average = sum / measurements.length;

    return {
      averageTime: average,
      minTime: Math.min(...measurements),
      maxTime: Math.max(...measurements),
      medianTime: sorted[Math.floor(sorted.length / 2)],
      p95Time: sorted[Math.floor(sorted.length * 0.95)],
      p99Time: sorted[Math.floor(sorted.length * 0.99)],
      standardDeviation: this.calculateStandardDeviation(measurements)
    };
  }

  /**
   * 计算标准差
   */
  private calculateStandardDeviation(measurements: number[]): number {
    const avg = measurements.reduce((sum, val) => sum + val, 0) / measurements.length;
    const squareDiffs = measurements.map(val => Math.pow(val - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((sum, val) => sum + val, 0) / measurements.length;
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * 打印基准测试摘要
   */
  private printSummary(results: BenchmarkResults): void {
    console.log('\n📈 Performance Benchmark Summary');
    console.log('='.repeat(50));

    for (const test of results.tests) {
      console.log(`\n🔍 ${test.name}`);
      console.log(`   Description: ${test.description}`);
      console.log(`   Iterations: ${test.iterations}`);
      console.log(`   Query Types: ${test.queryTypes.join(', ')}`);
      console.log(`   Average Time: ${test.averageTime.toFixed(2)}ms`);
      console.log(`   Min Time: ${test.minTime.toFixed(2)}ms`);
      console.log(`   Max Time: ${test.maxTime.toFixed(2)}ms`);
      console.log(`   Median Time: ${test.medianTime.toFixed(2)}ms`);
      console.log(`   P95 Time: ${test.p95Time.toFixed(2)}ms`);
      console.log(`   P99 Time: ${test.p99Time.toFixed(2)}ms`);
      console.log(`   Std Dev: ${test.standardDeviation.toFixed(2)}ms`);

      if (test.metadata) {
        console.log('   Metadata:');
        Object.entries(test.metadata).forEach(([key, value]) => {
          console.log(`     ${key}: ${value}`);
        });
      }
    }

    console.log('\n✅ Benchmark completed successfully!');
  }
}

/**
 * 基准测试结果接口
 */
export interface BenchmarkResults {
  timestamp: number;
  tests: BenchmarkTest[];
}

export interface BenchmarkTest {
  name: string;
  description: string;
  iterations: number;
  queryTypes: string[];
  averageTime: number;
  minTime: number;
  maxTime: number;
  medianTime: number;
  p95Time: number;
  p99Time: number;
  standardDeviation: number;
  metadata?: Record<string, string>;
}