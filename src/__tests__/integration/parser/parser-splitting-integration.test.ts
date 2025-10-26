import { TreeSitterService } from '../../../service/parser/core/parse/TreeSitterService';
import { TreeSitterCoreService } from '../../../service/parser/core/parse/TreeSitterCoreService';
import { ASTCodeSplitter } from '../../../service/parser/splitting/ASTCodeSplitter';
import { ProcessingGuard } from '../../../service/parser/guard/ProcessingGuard';
import { ErrorThresholdManager } from '../../../service/parser/universal/ErrorThresholdManager';
import { MemoryGuard } from '../../../service/parser/guard/MemoryGuard';
import { ProcessingStrategyFactory } from '../../../service/parser/processing/strategies/providers/ProcessingStrategyFactory';
import { UnifiedDetectionCenter } from '../../../service/parser/universal/UnifiedDetectionCenter';
import { IntelligentFallbackEngine } from '../../../service/parser/universal/IntelligentFallbackEngine';
import { FileProcessingCoordinator } from '../../../service/parser/universal/coordination/FileProcessingCoordinator';
import { LoggerService } from '../../../utils/LoggerService';
import * as fs from 'fs';
import * as path from 'path';

describe('Parser Splitting Integration Test', () => {
  let treeSitterService: TreeSitterService;
  let astCodeSplitter: ASTCodeSplitter;
  let processingGuard: ProcessingGuard;
  let logger: LoggerService;

  beforeAll(() => {
    logger = new LoggerService();
    const treeSitterCoreService = new TreeSitterCoreService();
    treeSitterService = new TreeSitterService(treeSitterCoreService);

    // 创建ProcessingGuard的依赖
    const errorThresholdManager = new ErrorThresholdManager(logger);

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

    // 创建ProcessingGuard
    processingGuard = new ProcessingGuard(
      logger,
      errorThresholdManager,
      memoryGuard,
      new ProcessingStrategyFactory(logger),
      new UnifiedDetectionCenter(logger),
      new IntelligentFallbackEngine(logger)
    );

    // 初始化ProcessingGuard
    processingGuard.initialize();

    // 创建ASTCodeSplitter时传入ProcessingGuard
    astCodeSplitter = new ASTCodeSplitter(treeSitterService, logger, processingGuard);
  });

  it('should process all files in test-files directory and save results to test-data/parser-result', async () => {
    // 定义源目录和目标目录
    const sourceDir = path.join(process.cwd(), 'test-files');
    const resultDir = path.join(process.cwd(), 'test-data', 'parser-result');

    // 确保结果目录存在
    if (!fs.existsSync(resultDir)) {
      fs.mkdirSync(resultDir, { recursive: true });
    }

    // 读取源目录中的所有文件
    const files = getAllFiles(sourceDir);

    // 遍历处理每个文件
    for (const filePath of files) {
      // 计算相对路径，用于在结果目录中保持相同的结构
      const relativePath = path.relative(sourceDir, filePath);
      const resultFilePath = path.join(resultDir, relativePath + '.result.json');

      // 确保结果文件的目录存在
      const resultFileDir = path.dirname(resultFilePath);
      if (!fs.existsSync(resultFileDir)) {
        fs.mkdirSync(resultFileDir, { recursive: true });
      }

      try {
        // 读取文件内容
        const content = fs.readFileSync(filePath, 'utf-8');

        // 使用ProcessingGuard进行智能文件处理
        const processingResult = await processingGuard.processFile(filePath, content);
        const { chunks, language, processingStrategy } = processingResult;

        logger.info(`Processing file: ${filePath}, detected language: ${language}, strategy: ${processingStrategy}, chunks: ${chunks.length}`);

        // 准备结果数据
        const resultData = {
          filePath,
          language,
          processingStrategy,
          chunksCount: chunks.length,
          chunks: chunks.map((chunk, index) => ({
            index,
            content: chunk.content,
            metadata: chunk.metadata,
            length: chunk.content.length
          }))
        };

        // 将结果写入文件
        fs.writeFileSync(resultFilePath, JSON.stringify(resultData, null, 2), 'utf-8');

        logger.info(`Saved result for ${filePath} to ${resultFilePath} with ${chunks.length} chunks`);
      } catch (error) {
        logger.error(`Error processing file ${filePath}:`, error);

        // 即使处理失败，也保存错误信息到结果文件
        const errorResult = {
          filePath,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : null
        };

        fs.writeFileSync(resultFilePath, JSON.stringify(errorResult, null, 2), 'utf-8');
      }
    }

    // 验证至少处理了一个文件
    expect(files.length).toBeGreaterThan(0);

    logger.info(`Processed ${files.length} files from test-files directory`);
  });
});

/**
 * 递归获取目录中的所有文件
 * @param dir 目录路径
 * @returns 文件路径数组
 */
function getAllFiles(dir: string): string[] {
  const files: string[] = [];

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