import { injectable, inject } from 'inversify';
import { TYPES } from '../../types';
import { LoggerService } from '../../utils/LoggerService';
import { QdrantService } from '../../database/qdrant/QdrantService';
import { IGraphService } from '../graph/core/IGraphService';
import { GraphPersistenceResult } from '../graph/core/types';

export interface BenchmarkTest {
  id: string;
  name: string;
  description: string;
  category: 'read' | 'write' | 'query' | 'transaction' | 'concurrent';
  run: (params?: any) => Promise<BenchmarkResult>;
}

export interface BenchmarkResult {
  testName: string;
  testId: string;
  duration: number; // 毫秒
  operations: number;
  operationsPerSecond: number;
  averageLatency: number; // 毫秒
  errors: number;
  errorRate: number;
  memoryUsed?: number; // 字节
  additionalMetrics?: { [key: string]: any };
  timestamp: number;
}

export interface BenchmarkSuiteResult {
  suiteName: string;
 results: BenchmarkResult[];
  summary: {
    totalDuration: number;
    totalOperations: number;
    overallOpsPerSecond: number;
    averageErrorRate: number;
  };
 timestamp: number;
}

export interface BenchmarkConfig {
  warmupRounds: number;
 testRounds: number;
  targetOperations: number;
  maxConcurrentOperations: number;
  timeout: number; // 毫秒
}

@injectable()
export class PerformanceBenchmark {
  private logger: LoggerService;
  private qdrantService: QdrantService;
  private graphService: IGraphService;
  private config: BenchmarkConfig;
  private tests: Map<string, BenchmarkTest> = new Map();

  constructor(
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.QdrantService) qdrantService: QdrantService,
    @inject(TYPES.GraphService) graphService: IGraphService,
    config?: Partial<BenchmarkConfig>
  ) {
    this.logger = logger;
    this.qdrantService = qdrantService;
    this.graphService = graphService;
    
    this.config = {
      warmupRounds: 2,
      testRounds: 5,
      targetOperations: 100,
      maxConcurrentOperations: 10,
      timeout: 30000,
      ...config
    };

    this.logger.info('PerformanceBenchmark initialized', { config: this.config });

    // 注册默认基准测试
    this.registerDefaultTests();
  }

  /**
   * 注册基准测试
   */
  registerTest(test: BenchmarkTest): void {
    this.tests.set(test.id, test);
    this.logger.debug('Registered benchmark test', { testId: test.id, testName: test.name });
  }

 /**
   * 运行单个基准测试
   */
 async runTest(testId: string, params?: any): Promise<BenchmarkResult | null> {
    const test = this.tests.get(testId);
    if (!test) {
      this.logger.error('Benchmark test not found', { testId });
      return null;
    }

    this.logger.info('Running benchmark test', { testId, testName: test.name });

    try {
      // 预热阶段
      for (let i = 0; i < this.config.warmupRounds; i++) {
        await test.run(params);
      }

      // 正式测试阶段
      const results: BenchmarkResult[] = [];
      for (let i = 0; i < this.config.testRounds; i++) {
        const result = await this.executeTestWithTimeout(test, params);
        results.push(result);
      }

      // 计算平均结果
      const avgResult: BenchmarkResult = {
        testName: test.name,
        testId,
        duration: results.reduce((sum, r) => sum + r.duration, 0) / results.length,
        operations: results[0].operations,
        operationsPerSecond: results.reduce((sum, r) => sum + r.operationsPerSecond, 0) / results.length,
        averageLatency: results.reduce((sum, r) => sum + r.averageLatency, 0) / results.length,
        errors: results.reduce((sum, r) => sum + r.errors, 0),
        errorRate: results.reduce((sum, r) => sum + r.errorRate, 0) / results.length,
        memoryUsed: results[0].memoryUsed, // 取第一个的结果，因为内存使用在测试间可能变化
        additionalMetrics: results[0].additionalMetrics,
        timestamp: Date.now()
      };

      this.logger.info('Benchmark test completed', {
        testId,
        operationsPerSecond: avgResult.operationsPerSecond,
        averageLatency: avgResult.averageLatency,
        errorRate: avgResult.errorRate
      });

      return avgResult;
    } catch (error) {
      this.logger.error('Benchmark test failed', { 
        testId, 
        error: (error as Error).message 
      });
      return null;
    }
  }

  /**
   * 运行基准测试套件
   */
 async runBenchmarkSuite(
    testIds: string[],
    suiteName: string,
    params?: any
  ): Promise<BenchmarkSuiteResult> {
    this.logger.info('Running benchmark suite', { suiteName, testCount: testIds.length });

    const results: BenchmarkResult[] = [];
    const startTime = Date.now();

    for (const testId of testIds) {
      const result = await this.runTest(testId, params);
      if (result) {
        results.push(result);
      }
    }

    const totalDuration = Date.now() - startTime;
    const totalOperations = results.reduce((sum, r) => sum + r.operations, 0);
    const overallOpsPerSecond = totalOperations > 0 
      ? totalOperations / (totalDuration / 100) 
      : 0;
    const averageErrorRate = results.length > 0 
      ? results.reduce((sum, r) => sum + r.errorRate, 0) / results.length 
      : 0;

    const suiteResult: BenchmarkSuiteResult = {
      suiteName,
      results,
      summary: {
        totalDuration,
        totalOperations,
        overallOpsPerSecond,
        averageErrorRate
      },
      timestamp: Date.now()
    };

    this.logger.info('Benchmark suite completed', {
      suiteName,
      totalDuration,
      totalOperations,
      overallOpsPerSecond
    });

    return suiteResult;
 }

  /**
   * 运行所有注册的基准测试
   */
  async runAllTests(suiteName: string, params?: any): Promise<BenchmarkSuiteResult> {
    const allTestIds = Array.from(this.tests.keys());
    return this.runBenchmarkSuite(allTestIds, suiteName, params);
  }

  /**
   * 比较两个基准测试结果
   */
  async compareResults(
    result1: BenchmarkResult,
    result2: BenchmarkResult
  ): Promise<{
    testName: string;
    improvement: number; // 正数表示改进，负数表示退步
    metricComparison: {
      duration: number;
      operationsPerSecond: number;
      averageLatency: number;
      errorRate: number;
    };
  }> {
    return {
      testName: result1.testName,
      improvement: ((result2.operationsPerSecond - result1.operationsPerSecond) / result1.operationsPerSecond) * 100,
      metricComparison: {
        duration: result2.duration - result1.duration,
        operationsPerSecond: result2.operationsPerSecond - result1.operationsPerSecond,
        averageLatency: result2.averageLatency - result1.averageLatency,
        errorRate: result2.errorRate - result1.errorRate
      }
    };
  }

  /**
   * 获取基准测试列表
   */
  getAvailableTests(): Array<{ id: string; name: string; description: string; category: string }> {
    return Array.from(this.tests.values()).map(test => ({
      id: test.id,
      name: test.name,
      description: test.description,
      category: test.category
    }));
 }

  /**
   * 移除基准测试
   */
  removeTest(testId: string): boolean {
    const removed = this.tests.delete(testId);
    if (removed) {
      this.logger.debug('Removed benchmark test', { testId });
    }
    return removed;
  }

  private async executeTestWithTimeout(test: BenchmarkTest, params?: any): Promise<BenchmarkResult> {
    return Promise.race([
      test.run(params),
      new Promise<BenchmarkResult>((_, reject) => 
        setTimeout(() => reject(new Error(`Test timeout after ${this.config.timeout}ms`)), this.config.timeout)
      )
    ]);
  }

  private registerDefaultTests(): void {
    // Qdrant写入性能测试
    this.registerTest({
      id: 'qdrant-write-performance',
      name: 'Qdrant Write Performance',
      description: 'Measures write performance to Qdrant vector database',
      category: 'write',
      run: async (params?: any) => {
        const startTime = Date.now();
        let operations = 0;
        let errors = 0;
        const targetOps = params?.targetOperations || this.config.targetOperations;

        try {
          // 模拟写入操作
          for (let i = 0; i < targetOps; i++) {
            // 这里应该实际调用Qdrant服务进行写入
            // 为了示例，我们使用模拟操作
            operations++;
          }
        } catch (error) {
          errors++;
        }

        const duration = Date.now() - startTime;
        const operationsPerSecond = duration > 0 ? (operations / duration) * 1000 : 0;
        const averageLatency = operations > 0 ? duration / operations : 0;
        const errorRate = operations > 0 ? errors / operations : 0;

        return {
          testName: 'Qdrant Write Performance',
          testId: 'qdrant-write-performance',
          duration,
          operations,
          operationsPerSecond,
          averageLatency,
          errors,
          errorRate,
          timestamp: Date.now()
        };
      }
    });

    // Graph写入性能测试
    this.registerTest({
      id: 'graph-write-performance',
      name: 'Graph Write Performance',
      description: 'Measures write performance to Graph database',
      category: 'write',
      run: async (params?: any) => {
        const startTime = Date.now();
        let operations = 0;
        let errors = 0;
        const targetOps = params?.targetOperations || this.config.targetOperations;

        try {
          // 模拟图数据库写入操作
          for (let i = 0; i < targetOps; i++) {
            // 这里应该实际调用Graph服务进行写入
            // 为了示例，我们使用模拟操作
            operations++;
          }
        } catch (error) {
          errors++;
        }

        const duration = Date.now() - startTime;
        const operationsPerSecond = duration > 0 ? (operations / duration) * 100 : 0;
        const averageLatency = operations > 0 ? duration / operations : 0;
        const errorRate = operations > 0 ? errors / operations : 0;

        return {
          testName: 'Graph Write Performance',
          testId: 'graph-write-performance',
          duration,
          operations,
          operationsPerSecond,
          averageLatency,
          errors,
          errorRate,
          timestamp: Date.now()
        };
      }
    });

    // Qdrant查询性能测试
    this.registerTest({
      id: 'qdrant-query-performance',
      name: 'Qdrant Query Performance',
      description: 'Measures query performance from Qdrant vector database',
      category: 'query',
      run: async (params?: any) => {
        const startTime = Date.now();
        let operations = 0;
        let errors = 0;
        const targetOps = params?.targetOperations || this.config.targetOperations;

        try {
          // 模拟查询操作
          for (let i = 0; i < targetOps; i++) {
            // 这里应该实际调用Qdrant服务进行查询
            // 为了示例，我们使用模拟操作
            operations++;
          }
        } catch (error) {
          errors++;
        }

        const duration = Date.now() - startTime;
        const operationsPerSecond = duration > 0 ? (operations / duration) * 100 : 0;
        const averageLatency = operations > 0 ? duration / operations : 0;
        const errorRate = operations > 0 ? errors / operations : 0;

        return {
          testName: 'Qdrant Query Performance',
          testId: 'qdrant-query-performance',
          duration,
          operations,
          operationsPerSecond,
          averageLatency,
          errors,
          errorRate,
          timestamp: Date.now()
        };
      }
    });

    // Graph查询性能测试
    this.registerTest({
      id: 'graph-query-performance',
      name: 'Graph Query Performance',
      description: 'Measures query performance from Graph database',
      category: 'query',
      run: async (params?: any) => {
        const startTime = Date.now();
        let operations = 0;
        let errors = 0;
        const targetOps = params?.targetOperations || this.config.targetOperations;

        try {
          // 模拟图数据库查询操作
          for (let i = 0; i < targetOps; i++) {
            // 这里应该实际调用Graph服务进行查询
            // 为了示例，我们使用模拟操作
            operations++;
          }
        } catch (error) {
          errors++;
        }

        const duration = Date.now() - startTime;
        const operationsPerSecond = duration > 0 ? (operations / duration) * 100 : 0;
        const averageLatency = operations > 0 ? duration / operations : 0;
        const errorRate = operations > 0 ? errors / operations : 0;

        return {
          testName: 'Graph Query Performance',
          testId: 'graph-query-performance',
          duration,
          operations,
          operationsPerSecond,
          averageLatency,
          errors,
          errorRate,
          timestamp: Date.now()
        };
      }
    });
  }

  /**
   * 生成性能报告
   */
  async generatePerformanceReport(suiteResult: BenchmarkSuiteResult): Promise<string> {
    let report = `# Performance Benchmark Report\n\n`;
    report += `**Suite Name:** ${suiteResult.suiteName}\n`;
    report += `**Timestamp:** ${new Date(suiteResult.timestamp).toISOString()}\n\n`;

    report += `## Summary\n\n`;
    report += `- Total Duration: ${(suiteResult.summary.totalDuration / 1000).toFixed(2)} seconds\n`;
    report += `- Total Operations: ${suiteResult.summary.totalOperations}\n`;
    report += `- Overall Operations/Second: ${suiteResult.summary.overallOpsPerSecond.toFixed(2)}\n`;
    report += `- Average Error Rate: ${(suiteResult.summary.averageErrorRate * 100).toFixed(2)}%\n\n`;

    report += `## Individual Test Results\n`;
    report += `| Test Name | Duration (ms) | Ops/Sec | Avg Latency (ms) | Error Rate |\n`;
    report += `|----------|---------------|---------|------------------|------------|\n`;

    for (const result of suiteResult.results) {
      report += `| ${result.testName} | ${result.duration} | ${result.operationsPerSecond.toFixed(2)} | ${result.averageLatency.toFixed(2)} | ${(result.errorRate * 100).toFixed(2)}% |\n`;
    }

    return report;
  }
}