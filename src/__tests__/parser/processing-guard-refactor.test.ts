import { ProcessingGuard } from '../../service/parser/universal/ProcessingGuard';
import { LoggerService } from '../../utils/LoggerService';
import { ProcessingStrategySelector } from '../../service/parser/universal/coordination/ProcessingStrategySelector';
import { FileProcessingCoordinator } from '../../service/parser/universal/coordination/FileProcessingCoordinator';
import { UniversalTextSplitter } from '../../service/parser/universal/UniversalTextSplitter';
import { ErrorThresholdManager } from '../../service/parser/universal/ErrorThresholdManager';
import { MemoryGuard } from '../../service/parser/guard/MemoryGuard';
import { BackupFileProcessor } from '../../service/parser/universal/BackupFileProcessor';
import { ExtensionlessFileProcessor } from '../../service/parser/universal/ExtensionlessFileProcessor';

describe('ProcessingGuard Refactor Test', () => {
  let logger: LoggerService;
  let processingGuard: ProcessingGuard;

  beforeEach(() => {
    logger = new LoggerService();
    processingGuard = new ProcessingGuard(
      logger,
      new ErrorThresholdManager(logger),
      new MemoryGuard({} as any, 500, 5000, logger),
      new BackupFileProcessor(logger),
      new ExtensionlessFileProcessor(logger),
      new UniversalTextSplitter(logger),
      new ProcessingStrategySelector(logger),
      new FileProcessingCoordinator(logger)
    );
  });

  test('should process JavaScript file correctly', async () => {
    const filePath = 'test.js';
    const content = `function helloWorld() {
  console.log('Hello, world!');
  return true;
}`;

    const result = await processingGuard.processFile(filePath, content);

    expect(result).toBeDefined();
    expect(result.chunks).toBeDefined();
    expect(Array.isArray(result.chunks)).toBe(true);
    expect(result.language).toBe('javascript');
    expect(result.processingStrategy).toBeDefined();
    console.log(`JavaScript file processed with strategy: ${result.processingStrategy}`);
  });

  test('should process Python file correctly', async () => {
    const filePath = 'test.py';
    const content = `def hello_world():
    print('Hello, world!')
    return True`;

    const result = await processingGuard.processFile(filePath, content);

    expect(result).toBeDefined();
    expect(result.chunks).toBeDefined();
    expect(Array.isArray(result.chunks)).toBe(true);
    expect(result.language).toBe('python');
    expect(result.processingStrategy).toBeDefined();
    console.log(`Python file processed with strategy: ${result.processingStrategy}`);
  });

  test('should process Markdown file correctly', async () => {
    const filePath = 'test.md';
    const content = `# Hello World

This is a test markdown file.

## Section 1

Some content here.`;

    const result = await processingGuard.processFile(filePath, content);

    expect(result).toBeDefined();
    expect(result.chunks).toBeDefined();
    expect(Array.isArray(result.chunks)).toBe(true);
    expect(result.language).toBe('markdown');
    expect(result.processingStrategy).toBeDefined();
    console.log(`Markdown file processed with strategy: ${result.processingStrategy}`);
  });

  test('should process unknown file type as text', async () => {
    const filePath = 'test.unknown';
    const content = `This is a file with unknown extension.
It should be processed as text.`;

    const result = await processingGuard.processFile(filePath, content);

    expect(result).toBeDefined();
    expect(result.chunks).toBeDefined();
    expect(Array.isArray(result.chunks)).toBe(true);
    expect(result.language).toBe('text');
    expect(result.processingStrategy).toBeDefined();
    console.log(`Unknown file processed with strategy: ${result.processingStrategy}`);
  });

  test('should handle empty file', async () => {
    const filePath = 'empty.txt';
    const content = '';

    const result = await processingGuard.processFile(filePath, content);

    expect(result).toBeDefined();
    expect(result.chunks).toBeDefined();
    expect(Array.isArray(result.chunks)).toBe(true);
    expect(result.language).toBeDefined();
    console.log(`Empty file processed with strategy: ${result.processingStrategy}`);
  });

  test('should handle large content', async () => {
    const filePath = 'large.js';
    const content = `function largeFunction() {
${Array(1000).fill('  console.log("line");').join('\n')}
}`;

    const result = await processingGuard.processFile(filePath, content);

    expect(result).toBeDefined();
    expect(result.chunks).toBeDefined();
    expect(Array.isArray(result.chunks)).toBe(true);
    expect(result.language).toBe('javascript');
    expect(result.processingStrategy).toBeDefined();
    console.log(`Large file processed with ${result.chunks.length} chunks using strategy: ${result.processingStrategy}`);
  });
});