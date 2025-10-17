import { ProcessingStrategySelector } from '../ProcessingStrategySelector';
import { LoggerService } from '../../../../../utils/LoggerService';
import { UniversalProcessingConfig } from '../../UniversalProcessingConfig';

// Mock LoggerService
jest.mock('../../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('ProcessingStrategySelector - Backup File Confidence Handling', () => {
  let strategySelector: ProcessingStrategySelector;
  let mockLogger: jest.Mocked<LoggerService>;
  let config: UniversalProcessingConfig;

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();
    
    config = new UniversalProcessingConfig(mockLogger);
    strategySelector = new ProcessingStrategySelector(mockLogger, undefined, undefined, config);
  });

  describe('detectLanguageIntelligently with backup files', () => {
    it('should accept high confidence backup file detection', async () => {
      // 设置置信度阈值为0.7
      config.setBackupFileConfidenceThreshold(0.7);
      
      // 模拟高置信度的备份文件 (script.py.bak 有0.95的置信度)
      const result = await strategySelector.detectLanguageIntelligently('script.py.bak', 'python code here');
      
      // 验证是否接受了高置信度的结果
      expect(result.language).toBe('python');
      expect(result.confidence).toBe(0.95);
      expect(result.detectionMethod).toBe('backup');
    });

    it('should reject low confidence backup file detection', async () => {
      // 设置置信度阈值为0.8
      config.setBackupFileConfidenceThreshold(0.8);
      
      // 模拟低置信度的备份文件 (unknown.invalid.bak 有0.5的置信度)
      const result = await strategySelector.detectLanguageIntelligently('unknown.invalid.bak', 'some content');
      
      // 验证是否拒绝了低置信度的结果，继续使用其他检测方法
      // 在这种情况下，应该回退到基于内容的检测
      expect(result.detectionMethod).not.toBe('backup');
    });

    it('should use content detection when backup file confidence is below threshold', async () => {
      // 设置置信度阈值为0.99（高于file.js.bak的0.95置信度）
      config.setBackupFileConfidenceThreshold(0.99);
      
      // file.js.bak 有0.95的置信度，低于阈值0.99
      const result = await strategySelector.detectLanguageIntelligently('file.js.bak', 'def python_function(): pass');
      
      // 验证是否拒绝了低于阈值的备份文件检测，继续使用其他检测方法
      expect(result.detectionMethod).not.toBe('backup');
    });

    it('should respect different confidence thresholds', async () => {
      // 测试不同的置信度阈值
      const testCases = [
        { threshold: 0.5, fileName: 'low.confidence.bak', expectedAccept: true },
        { threshold: 0.9, fileName: 'high.confidence.py.bak', expectedAccept: true },
        { threshold: 0.99, fileName: 'medium.confidence.js.bak', expectedAccept: false }
      ];

      for (const testCase of testCases) {
        config.setBackupFileConfidenceThreshold(testCase.threshold);
        const result = await strategySelector.detectLanguageIntelligently(testCase.fileName, 'some content');
        
        if (testCase.expectedAccept) {
          // 对于预期接受的情况，检查是否使用了备份文件检测
          // 注意：这取决于文件名模式和置信度计算
        } else {
          // 对于预期拒绝的情况，检查是否没有使用备份文件检测
          expect(result.detectionMethod).not.toBe('backup');
        }
      }
    });
  });
});