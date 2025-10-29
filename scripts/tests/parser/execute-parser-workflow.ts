import * as fs from 'fs';
import * as path from 'path';

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

/**
 * 运行parser工作流测试
 */
async function runParserWorkflow() {
  console.log('Starting parser workflow test...');

  // 使用tsx来运行时动态加载模块 - 使用正确的相对路径
  try {
    // 使用require来动态加载模块 - 从scripts/tests/parser目录向上三级到项目根目录
    const diContainerModule = await import('../../../src/core/DIContainer');
    const typesModule = await import('../../../src/types');
    const { TreeSitterCoreService } = await import('../../../src/service/parser/core/parse/TreeSitterCoreService');
    const { UnifiedProcessingCoordinator } = await import('../../../src/service/parser/processing/coordination/UnifiedProcessingCoordinator');

    const diContainer = diContainerModule.diContainer;
    const TYPES = typesModule.TYPES;

    // 获取TreeSitter服务并等待初始化
    const treeSitterService = diContainer.get(TYPES.TreeSitterCoreService) as import('../../../src/service/parser/core/parse/TreeSitterCoreService').TreeSitterCoreService;

    // 等待TreeSitterCoreService初始化
    const maxWaitTime = 30000; // 30秒超时
    const startTime = Date.now();

    while (!treeSitterService.isInitialized() && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!treeSitterService.isInitialized()) {
      console.error('TreeSitterCoreService failed to initialize');
      return;
    }

    console.log('TreeSitterCoreService initialized successfully');

    // 等待查询系统完全初始化
    console.log('Waiting for query system initialization...');
    const querySystemStatus = treeSitterService.getQuerySystemStatus();
    console.log('Query system status:', querySystemStatus);

    // 额外等待查询系统初始化完成
    let querySystemReady = false;
    const queryWaitStartTime = Date.now();
    while (!querySystemReady && Date.now() - queryWaitStartTime < maxWaitTime) {
      const status = treeSitterService.getQuerySystemStatus();
      querySystemReady = status.initialized;

      if (!querySystemReady) {
        console.log('Query system not ready yet, waiting...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (!querySystemReady) {
      console.error('Query system failed to initialize within timeout');
      return;
    }

    console.log('Query system initialized successfully');

    // 定义源目录 - 从项目根目录查找test-files
    const sourceDir = path.join(__dirname, '..', '..', '..', 'test-files');
    const OUTPUT_DIR = path.join(process.cwd(), 'test-data', 'parser-result');

    // 确保结果目录存在
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // 读取源目录中的所有文件
    const files = getAllFiles(sourceDir);
    console.log(`Found ${files.length} test files`);

    // 获取处理协调器
    const processingCoordinator = diContainer.get(TYPES.UnifiedProcessingCoordinator) as import('../../../src/service/parser/processing/coordination/UnifiedProcessingCoordinator').UnifiedProcessingCoordinator;

    // 遍历处理每个文件
    for (const filePath of files) {
      console.log(`Processing: ${filePath}`);

      // 计算相对路径，用于在结果目录中保持相同的结构
      const relativePath = path.relative(sourceDir, filePath);
      const resultFilePath = path.join(OUTPUT_DIR, relativePath.replace(/[\/\\]/g, '_') + '.result.json');

      // 确保结果文件的目录存在
      const resultFileDir = path.dirname(resultFilePath);
      if (!fs.existsSync(resultFileDir)) {
        fs.mkdirSync(resultFileDir, { recursive: true });
      }

      try {
        // 读取文件内容
        const content = fs.readFileSync(filePath, 'utf-8');

        // 创建处理上下文
        const context = {
          filePath,
          content,
          options: {
            maxChunkSize: 2000,
            overlapSize: 200,
            maxLines: 100,
            optimizationLevel: 'medium' as const,
            addOverlap: false,
            maxOverlapRatio: 0.3
          }
        };

        // 使用处理协调器处理文件
        const processingResult = await processingCoordinator.processFile(context);
        const { chunks, language, processingStrategy, fallbackReason, success, metadata } = processingResult;

        console.log(`  - Language: ${language}`);
        console.log(`  - Strategy: ${processingStrategy}`);
        console.log(`  - Chunks: ${chunks.length}`);
        console.log(`  - Success: ${success}`);
        console.log(`  - Fallback Reason: ${fallbackReason || 'None'}`);
        console.log(`  - Detection Method: ${metadata?.detectionMethod || 'Unknown'}`);
        console.log(`  - Confidence: ${metadata?.confidence || 0}`);

        // 检查chunk的metadata，看看是否是fallback
        if (chunks.length > 0) {
          const firstChunk = chunks[0];
          console.log(`  - Chunk Type: ${firstChunk.metadata?.type || 'unknown'}`);
          console.log(`  - Is Fallback: ${firstChunk.metadata?.fallback || false}`);
        }

        // 添加AST策略的详细调试信息
        if (processingStrategy === 'treesitter_ast') {
          console.log(`  - AST Strategy Debug: Checking TreeSitter extraction...`);

          // 直接调用TreeSitter服务来调试
          try {
            const treeSitterService = diContainer.get(TYPES.TreeSitterCoreService) as any;
            const detectedLanguage = await treeSitterService.detectLanguage(filePath, content);
            console.log(`  - Detected Language: ${detectedLanguage?.name}`);

            if (detectedLanguage) {
              const parseResult = await treeSitterService.parseCode(content, detectedLanguage.name);
              console.log(`  - Parse Success: ${parseResult.success}`);
              console.log(`  - Parse Error: ${parseResult.error || 'None'}`);

              if (parseResult.success && parseResult.ast) {
                const functions = await treeSitterService.extractFunctions(parseResult.ast);
                const classes = await treeSitterService.extractClasses(parseResult.ast);
                console.log(`  - Functions Found: ${functions.length}`);
                console.log(`  - Classes Found: ${classes.length}`);

                // 检查查询系统状态
                let querySystemStatus;
                try {
                  querySystemStatus = treeSitterService.getQuerySystemStatus();
                  console.log(`  - Query System Initialized: ${querySystemStatus?.initialized}`);
                  console.log(`  - Using Optimized Queries: ${querySystemStatus?.useOptimizedQueries}`);
                } catch (statusError) {
                  console.log(`  - Query System Status Error: ${statusError}`);
                }

                // 检查是否使用了回退机制
                if (functions.length === 0 && classes.length === 0) {
                  console.log(`  - WARNING: No functions or classes extracted, using fallback!`);
                }

                }
            }
          } catch (error) {
            console.log(`  - Debug Error: ${error}`);
          }
        }

        // 直接测试ASTStrategyProvider - 移到外面确保执行
        if (processingStrategy === 'treesitter_ast') {
          console.log(`  - Testing ASTStrategyProvider directly...`);
          try {
            const treeSitterService = diContainer.get(TYPES.TreeSitterCoreService) as any;
            const loggerService = diContainer.get(TYPES.LoggerService) as any;
            const { ASTStrategyProvider } = await import('../../../src/service/parser/processing/strategies/providers/ASTStrategyProvider');
            const astProvider = new ASTStrategyProvider(treeSitterService, loggerService);
            const astStrategy = astProvider.createStrategy();
            const astChunks = await astStrategy.split(content, language, filePath);
            console.log(`  - AST Strategy Provider Chunks: ${astChunks.length}`);
            if (astChunks.length > 0) {
              console.log(`  - First AST chunk type: ${astChunks[0].metadata?.type}`);
              console.log(`  - First AST chunk content length: ${astChunks[0].content.length}`);
            } else {
              console.log(`  - AST Strategy returned ${astChunks.length} chunks - this is the problem!`);
            }
          } catch (astError) {
            console.log(`  - AST Strategy Provider Error: ${astError}`);
            console.log(`  - AST Strategy Provider Stack: ${(astError as Error).stack}`);
          }
        }

        // 准备结果数据
        const resultData = {
          filePath,
          language,
          processingStrategy,
          chunksCount: chunks.length,
          chunks: chunks.map((chunk: any, index: number) => ({
            index,
            content: chunk.content,
            metadata: chunk.metadata,
            length: chunk.content.length
          }))
        };

        // 将结果写入文件
        fs.writeFileSync(resultFilePath, JSON.stringify(resultData, null, 2), 'utf-8');
        console.log(`Result saved to: ${resultFilePath}`);
        console.log('---');
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error);

        // 即使处理失败，也保存错误信息到结果文件
        const errorResult = {
          filePath,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : null
        };

        fs.writeFileSync(resultFilePath, JSON.stringify(errorResult, null, 2), 'utf-8');
      }
    }

    console.log('Parser workflow test completed!');

    // 直接退出进程
    console.log('Exiting process...');
    process.exit(0);
  } catch (error) {
    console.error('Failed to load modules:', error);
    throw error;
  }
}

// 运行测试
if (require.main === module) {
  runParserWorkflow().catch(error => {
    console.error('Parser workflow failed:', error);
    process.exit(1);
  });
}

export { runParserWorkflow };