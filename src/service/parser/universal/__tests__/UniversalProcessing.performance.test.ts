
import { UniversalTextSplitter } from '../UniversalTextSplitter';
import { BackupFileProcessor } from '../BackupFileProcessor';
import { ExtensionlessFileProcessor } from '../ExtensionlessFileProcessor';
import { ProcessingGuard } from '../ProcessingGuard';
import { ErrorThresholdManager } from '../ErrorThresholdManager';
import { MemoryGuard } from '../MemoryGuard';
import { LoggerService } from '../../../../utils/LoggerService';

// Mock LoggerService
jest.mock('../../../../utils/LoggerService');
const MockLoggerService = LoggerService as jest.MockedClass<typeof LoggerService>;

describe('Universal Processing Performance Tests', () => {
  let mockLogger: jest.Mocked<LoggerService>;
  let universalTextSplitter: UniversalTextSplitter;
  let backupFileProcessor: BackupFileProcessor;
  let extensionlessFileProcessor: ExtensionlessFileProcessor;
  let processingGuard: ProcessingGuard;

  beforeEach(() => {
    mockLogger = new MockLoggerService() as jest.Mocked<LoggerService>;
    mockLogger.debug = jest.fn();
    mockLogger.warn = jest.fn();
    mockLogger.error = jest.fn();
    mockLogger.info = jest.fn();

    universalTextSplitter = new UniversalTextSplitter(mockLogger);
    backupFileProcessor = new BackupFileProcessor(mockLogger);
    extensionlessFileProcessor = new ExtensionlessFileProcessor(mockLogger);
    
    const errorThresholdManager = new ErrorThresholdManager(mockLogger);
    const memoryGuard = new MemoryGuard(1000, 10000, mockLogger);
    
    processingGuard = new ProcessingGuard(
      mockLogger,
      errorThresholdManager,
      memoryGuard,
      backupFileProcessor,
      extensionlessFileProcessor,
      universalTextSplitter
    );
    
    processingGuard.initialize();
  });

  afterEach(() => {
    processingGuard.destroy();
  });

  describe('Large File Processing Performance', () => {
    it('should process large JavaScript files within reasonable time', async () => {
      // Generate a large JavaScript file (approximately 10,000 lines)
      const largeJSCode = generateLargeJavaScriptFile(10000);
      
      const startTime = performance.now();
      const result = await processingGuard.processFile('large.js', largeJSCode);
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // Performance assertions
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.language).toBe('javascript');
      
      console.log(`Large JS file processing time: ${processingTime.toFixed(2)}ms`);
      console.log(`Number of chunks: ${result.chunks.length}`);
    });

    it('should process large TypeScript files within reasonable time', async () => {
      // Generate a large TypeScript file (approximately 10,000 lines)
      const largeTSCode = generateLargeTypeScriptFile(10000);
      
      const startTime = performance.now();
      const result = await processingGuard.processFile('large.ts', largeTSCode);
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // Performance assertions
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.language).toBe('typescript');
      
      console.log(`Large TS file processing time: ${processingTime.toFixed(2)}ms`);
      console.log(`Number of chunks: ${result.chunks.length}`);
    });

    it('should process large Python files within reasonable time', async () => {
      // Generate a large Python file (approximately 10,000 lines)
      const largePythonCode = generateLargePythonFile(10000);
      
      const startTime = performance.now();
      const result = await processingGuard.processFile('large.py', largePythonCode);
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      // Performance assertions
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.language).toBe('python');
      
      console.log(`Large Python file processing time: ${processingTime.toFixed(2)}ms`);
      console.log(`Number of chunks: ${result.chunks.length}`);
    });
  });

  describe('Memory Usage Performance', () => {
    it('should not exceed memory limits during processing', async () => {
      // Generate a very large file that could cause memory issues
      const veryLargeCode = generateLargeJavaScriptFile(50000); // 50,000 lines
      
      const initialMemory = process