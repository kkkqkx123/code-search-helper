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

describe('Parser Segmentation Integration Test', () => {
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
    const guardCoordinator = UnifiedGuardCoordinator.getInstance(
      memoryMonitor,
      errorThresholdManager,
      cleanupManager,
      detectionService,
      new ProcessingStrategyFactory(logger),
      new IntelligentFallbackEngine(logger),
      500, // memoryLimitMB
      500, // memoryCheckIntervalMs
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

  it('should correctly segment TypeScript file using AST strategy', async () => {
    const content = `
      import { Component } from 'react';

      interface User {
        id: number;
        name: string;
      }

      class UserService {
        private users: User[] = [];

        async getUsers(): Promise<User[]> {
          return this.users;
        }

        async addUser(user: User): Promise<void> {
          this.users.push(user);
        }
      }

      const userService = new UserService();

      export { UserService, userService };
    `;

    const context = {
      filePath: 'test.ts',
      content,
      options: {}
    };

    const result = await processingCoordinator.processFile(context);
    
    expect(result.success).toBe(true);
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.language).toBe('typescript');
    expect(result.processingStrategy).toBeDefined();
    
    // 验证分段包含类和函数
    const chunkContents = result.chunks.map((chunk: any) => chunk.content);
    expect(chunkContents.some(c => c.includes('class UserService'))).toBe(true);
    expect(chunkContents.some(c => c.includes('getUsers(): Promise<User[]>'))).toBe(true);
    expect(chunkContents.some(c => c.includes('addUser(user: User): Promise<void>'))).toBe(true);
  });

  it('should correctly segment Python file using function strategy', async () => {
    const content = `
      import os
      import sys
      from typing import List

      def fibonacci(n: int) -> List[int]:
          if n <= 0:
              return []
          elif n == 1:
              return [0]
          elif n == 2:
              return [0, 1]
          else:
              fib_list = [0, 1]
              for i in range(2, n):
                  fib_list.append(fib_list[i-1] + fib_list[i-2])
              return fib_list

      def main():
          n = 10
          result = fibonacci(n)
          print(f"前{n}个斐波那契数: {result}")

      if __name__ == "__main__":
          main()
    `;

    const context = {
      filePath: 'test.py',
      content,
      options: {}
    };

    const result = await processingCoordinator.processFile(context);
    
    expect(result.success).toBe(true);
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.language).toBe('python');
    
    // 验证分段包含函数
    const chunkContents = result.chunks.map((chunk: any) => chunk.content);
    expect(chunkContents.some(c => c.includes('def fibonacci(n: int) -> List[int]:'))).toBe(true);
    expect(chunkContents.some(c => c.includes('def main():'))).toBe(true);
  });

  it('should correctly segment JavaScript file using syntax aware strategy', async () => {
    const content = `
      const utils = {
        add: (a, b) => a + b,
        subtract: (a, b) => a - b,
        multiply: (a, b) => a * b,
        divide: (a, b) => a / b
      };

      class Calculator {
        constructor() {
          this.history = [];
        }

        calculate(operation, a, b) {
          const result = utils[operation](a, b);
          this.history.push({ operation, a, b, result });
          return result;
        }

        getHistory() {
          return this.history;
        }
      }

      module.exports = { Calculator, utils };
    `;

    const context = {
      filePath: 'test.js',
      content,
      options: {}
    };

    const result = await processingCoordinator.processFile(context);
    
    expect(result.success).toBe(true);
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.language).toBe('javascript');
    
    // 验证分段包含对象和类
    const chunkContents = result.chunks.map((chunk: any) => chunk.content);
    expect(chunkContents.some(c => c.includes('const utils = {'))).toBe(true);
    expect(chunkContents.some(c => c.includes('class Calculator'))).toBe(true);
    expect(chunkContents.some(c => c.includes('calculate(operation, a, b)'))).toBe(true);
  });

  it('should handle files in test-files directory', async () => {
    const sourceDir = path.join(process.cwd(), 'test-files');
    
    if (!fs.existsSync(sourceDir)) {
      logger.warn('test-files directory not found, skipping directory test');
      return;
    }

    const files = getAllFiles(sourceDir).slice(0, 3); // 限制处理文件数量
    
    for (const filePath of files) {
      const content = fs.readFileSync(filePath, 'utf-8');
      
      const context = {
        filePath,
        content,
        options: {}
      };

      const result = await processingCoordinator.processFile(context);
      
      expect(result.success).toBe(true);
      expect(result.chunks.length).toBeGreaterThanOrEqual(0); // 允许空分段
      expect(result.language).toBeDefined();
    }
  });

  it('should apply fallback strategies when primary strategy fails', async () => {
    // 使用一个可能导致AST策略失败的内容
    const content = `
      This is not valid code in any language.
      It should trigger fallback mechanisms.
      The parser should still produce some chunks.
    `;

    const context = {
      filePath: 'invalid.txt',
      content,
      options: {}
    };

    const result = await processingCoordinator.processFile(context);
    
    // 即使内容无效，也应该成功处理（通过降级策略）
    expect(result.success).toBe(true);
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.language).toBe('text'); // 应该降级为文本处理
  });
});

/**
 * 递归获取目录中的所有文件
 * @param dir 目录路径
 * @returns 文件路径数组
 */
function getAllFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      // 如果是目录，递归获取其中的文件
      files.push(...getAllFiles(fullPath));
    } else {
      // 如果是文件，添加到数组中
      files.push(fullPath);
    }
  }

  return files;
}