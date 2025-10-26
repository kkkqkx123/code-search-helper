import { ProcessingGuard } from '../../guard/ProcessingGuard';
import { LoggerService } from '../../../../utils/LoggerService';
import { ErrorThresholdManager } from '../ErrorThresholdManager';
import { MemoryGuard } from '../../guard/MemoryGuard';
import { ProcessingStrategyFactory } from '../factory/ProcessingStrategyFactory';
import { UnifiedDetectionCenter } from '../UnifiedDetectionCenter';
import { IntelligentFallbackEngine } from '../IntelligentFallbackEngine';
import { BackupFileProcessor } from '../BackupFileProcessor';
import { ExtensionlessFileProcessor } from '../ExtensionlessFileProcessor';
import { UniversalTextSplitter } from '../UniversalTextSplitter';

describe('Degradation Mechanism Performance Comparison', () => {
  let logger: LoggerService;
  let backupProcessor: BackupFileProcessor;
  let extensionlessProcessor: ExtensionlessFileProcessor;
  let detectionCenter: UnifiedDetectionCenter;
  let fallbackEngine: IntelligentFallbackEngine;
  let strategyFactory: ProcessingStrategyFactory;

  beforeEach(() => {
    logger = new LoggerService();
    backupProcessor = new BackupFileProcessor(logger);
    extensionlessProcessor = new ExtensionlessFileProcessor(logger);
    detectionCenter = new UnifiedDetectionCenter(logger, backupProcessor, extensionlessProcessor);
    fallbackEngine = new IntelligentFallbackEngine(logger);
    strategyFactory = new ProcessingStrategyFactory(logger);
  });

  it('should compare processing times between old and new guard', async () => {
    const content = `function exampleFunction() {
      console.log("This is a test function");
      let x = 10;
      let y = 20;
      return x + y;
    }

    class ExampleClass {
      constructor() {
        this.value = 42;
      }

      getValue() {
        return this.value;
      }
    }

    // More code to process
    for (let i = 0; i < 100; i++) {
      if (i % 2 === 0) {
        console.log(\`Even number: \${i}\`);
      } else {
        console.log(\`Odd number: \${i}\`);
      }
    }

    // Additional functions
    const arrowFunc = (param) => {
      return param * 2;
    };

    function anotherFunction() {
      return "Hello World";
    }
    `;

    const filePath = 'test.js';

    // 测试旧版 ProcessingGuard
    const oldGuard = new ProcessingGuard(logger);
    const oldStartTime = process.hrtime.bigint();
    try {
      await oldGuard.processFile(filePath, content);
    } catch (error) {
      // 忽略错误，只关注性能
    }
    const oldEndTime = process.hrtime.bigint();
    const oldDuration = Number(oldEndTime - oldStartTime) / 1000000; // 转换为毫秒

    // 测试新版 ProcessingGuard
    const newGuard = new ProcessingGuard(
      logger,
      new ErrorThresholdManager(logger),
      new MemoryGuard({} as any, 500, 5000, logger),
      strategyFactory,
      detectionCenter,
      fallbackEngine
    );
    const newStartTime = process.hrtime.bigint();
    try {
      await newGuard.processFile(filePath, content);
    } catch (error) {
      // 忽略错误，只关注性能
    }
    const newEndTime = process.hrtime.bigint();
    const newDuration = Number(newEndTime - newStartTime) / 100000; // 转换为毫秒

    console.log(`Old ProcessingGuard duration: ${oldDuration}ms`);
    console.log(`New ProcessingGuard duration: ${newDuration}ms`);
    console.log(`Performance improvement: ${((oldDuration - newDuration) / oldDuration * 10).toFixed(2)}%`);

    // 新版应该更快或至少不显著慢于旧版
    expect(newDuration).toBeLessThanOrEqual(oldDuration * 1.5); // 允许最多50%的性能差异
  });

  it('should verify unified detection reduces redundant calls', async () => {
    const content = 'console.log("hello");';
    const filePath = 'test.js';

    // 模拟检测中心
    const detectionCenterSpy = jest.spyOn(detectionCenter, 'detectFile');

    const optimizedGuard = new ProcessingGuard(
      logger,
      new ErrorThresholdManager(logger),
      new MemoryGuard({} as any, 500, 500, logger),
      strategyFactory,
      detectionCenter,
      fallbackEngine
    );

    // 处理文件
    await optimizedGuard.processFile(filePath, content);

    // 验证检测中心只被调用一次（统一检测）
    expect(detectionCenterSpy).toHaveBeenCalledTimes(1);

    // 验证检测中心被正确调用
    expect(detectionCenterSpy).toHaveBeenCalledWith(filePath, content);
  });

  it('should test fallback mechanism performance', async () => {
    const content = 'console.log("hello");';
    const filePath = 'test.js';

    const errorThresholdManager = new ErrorThresholdManager(logger);
    const memoryGuard = new MemoryGuard({} as any, 500, 5000, logger);
    const optimizedGuard = new ProcessingGuard(
      logger,
      errorThresholdManager,
      memoryGuard,
      strategyFactory,
      detectionCenter,
      fallbackEngine
    );

    // 触发错误阈值以启用降级
    for (let i = 0; i < 5; i++) {
      errorThresholdManager.recordError(new Error('Test error'), 'test');
    }

    const startTime = process.hrtime.bigint();
    const result = await optimizedGuard.processFile(filePath, content);
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - startTime) / 1000000; // 转换为毫秒

    console.log(`Fallback processing duration: ${duration}ms`);

    // 验证降级处理成功
    expect(result.success).toBe(true);
    expect(result.fallbackReason).toBeDefined();

    // 验证降级处理在合理时间内完成
    expect(duration).toBeLessThan(1000); // 1秒内完成
  });
});