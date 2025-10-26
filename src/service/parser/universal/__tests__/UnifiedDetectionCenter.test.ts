import { UnifiedDetectionCenter } from '../UnifiedDetectionCenter';
import { LoggerService } from '../../../../utils/LoggerService';
import { BackupFileProcessor } from '../BackupFileProcessor';
import { ExtensionlessFileProcessor } from '../ExtensionlessFileProcessor';

describe('UnifiedDetectionCenter', () => {
  let unifiedDetectionCenter: UnifiedDetectionCenter;
  let mockLogger: jest.Mocked<LoggerService>;
  let mockBackupProcessor: jest.Mocked<BackupFileProcessor>;
  let mockExtensionlessProcessor: jest.Mocked<ExtensionlessFileProcessor>;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      getLogFilePath: jest.fn(),
      updateLogLevel: jest.fn(),
      markAsNormalExit: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    mockBackupProcessor = {
      isBackupFile: jest.fn(),
      inferOriginalType: jest.fn(),
      detectLanguageByExtension: jest.fn(),
      getOriginalFilePath: jest.fn(),
      isLikelyCodeFile: jest.fn(),
      getBackupFileMetadata: jest.fn(),
      detectBackupType: jest.fn(),
      addBackupPattern: jest.fn(),
      removeBackupPattern: jest.fn(),
      getBackupPatterns: jest.fn(),
    } as unknown as jest.Mocked<BackupFileProcessor>;

    mockExtensionlessProcessor = {
      detectLanguageByContent: jest.fn(),
      isLikelyCodeFile: jest.fn(),
      addSyntaxPattern: jest.fn(),
      addShebangPattern: jest.fn(),
      addFileStructurePattern: jest.fn(),
    } as unknown as jest.Mocked<ExtensionlessFileProcessor>;

    unifiedDetectionCenter = new UnifiedDetectionCenter(
      mockLogger,
      mockBackupProcessor,
      mockExtensionlessProcessor
    );
 });

  it('should detect backup files correctly', async () => {
    const filePath = 'test.js.bak';
    const content = 'console.log("hello");';
    
    mockBackupProcessor.isBackupFile.mockReturnValue(true);
    mockBackupProcessor.inferOriginalType.mockReturnValue({
      originalLanguage: 'javascript',
      confidence: 0.9,
      originalExtension: '.js',
      originalFileName: 'test.js'
    });

    const result = await unifiedDetectionCenter.detectFile(filePath, content);

    expect(mockBackupProcessor.isBackupFile).toHaveBeenCalledWith(filePath);
    expect(mockBackupProcessor.inferOriginalType).toHaveBeenCalledWith(filePath);
    expect(result.language).toBe('javascript');
    expect(result.fileType).toBe('backup');
    expect(result.confidence).toBe(0.9);
  });

  it('should detect extensionless files correctly', async () => {
    const filePath = 'script';
    const content = '#!/bin/bash\necho "hello world"';

    mockBackupProcessor.isBackupFile.mockReturnValue(false);
    mockExtensionlessProcessor.detectLanguageByContent.mockReturnValue({
      language: 'bash',
      confidence: 0.8,
      indicators: ['shebang']
    });

    const result = await unifiedDetectionCenter.detectFile(filePath, content);

    expect(mockBackupProcessor.isBackupFile).toHaveBeenCalledWith(filePath);
    expect(mockExtensionlessProcessor.detectLanguageByContent).toHaveBeenCalledWith(content);
    expect(result.language).toBe('bash');
    expect(result.fileType).toBe('extensionless');
    expect(result.confidence).toBe(0.8);
  });

  it('should return unknown for unrecognized files', async () => {
    const filePath = 'unknown.xyz';
    const content = 'random content';

    mockBackupProcessor.isBackupFile.mockReturnValue(false);
    mockExtensionlessProcessor.detectLanguageByContent.mockReturnValue({
      language: 'unknown',
      confidence: 0.1,
      indicators: []
    });

    const result = await unifiedDetectionCenter.detectFile(filePath, content);

    expect(result.language).toBe('text'); // default fallback
    expect(result.fileType).toBe('unknown');
    expect(result.confidence).toBe(0.1);
  });

  it('should use cache for repeated detections', async () => {
    const filePath = 'test.js';
    const content = 'console.log("hello");';

    mockBackupProcessor.isBackupFile.mockReturnValue(false);
    mockExtensionlessProcessor.detectLanguageByContent.mockReturnValue({
      language: 'unknown',
      confidence: 0.1,
      indicators: []
    });

    // First call
    await unifiedDetectionCenter.detectFile(filePath, content);
    
    // Second call with same parameters
    await unifiedDetectionCenter.detectFile(filePath, content);

    // Should only call the actual detection once due to caching
    expect(mockLogger.debug).toHaveBeenCalledWith(`Cache hit for detection: ${filePath}`);
  });
});