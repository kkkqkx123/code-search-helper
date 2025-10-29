import * as fs from 'fs';
import * as path from 'path';

/**
 * 简化版Go文件AST分段测试
 */
async function runSimpleGoTest() {
  console.log('Starting simple Go test...');
  
  try {
    // 动态导入必要的模块
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
    
    // 读取Go测试文件
    const goFilePath = path.join(process.cwd(), 'test-files', 'dataStructure', 'datastructure', 'linked_list.go');
    const content = fs.readFileSync(goFilePath, 'utf-8');
    
    console.log('Testing Go file content parsing...');
    
    // 检测语言
    const detectedLanguage = await treeSitterService.detectLanguage(goFilePath);
    console.log('Detected language:', detectedLanguage);
    
    if (!detectedLanguage) {
      console.error('Failed to detect language for Go file');
      return;
    }
    
    // 解析代码
    const parseResult = await treeSitterService.parseCode(content, detectedLanguage.name);
    console.log('Parse result success:', parseResult.success);
    
    if (!parseResult.success || !parseResult.ast) {
      console.error('Failed to parse Go file');
      return;
    }
    
    // 提取函数和类
    const functions = await treeSitterService.extractFunctions(parseResult.ast, detectedLanguage.name);
    const classes = await treeSitterService.extractClasses(parseResult.ast, detectedLanguage.name);
    
    console.log(`Extracted ${functions.length} functions and ${classes.length} classes`);
    
    // 显示函数信息
    for (let i = 0; i < Math.min(functions.length, 5); i++) {
      const func = functions[i];
      console.log(`Function ${i + 1}: type=${func.type}`);
    }
    
    // 显示类信息
    for (let i = 0; i < Math.min(classes.length, 5); i++) {
      const cls = classes[i];
      console.log(`Class ${i + 1}: type=${cls.type}`);
    }
    
    // 获取处理协调器
    const processingCoordinator = diContainer.get(TYPES.UnifiedProcessingCoordinator) as import('../../../src/service/parser/processing/coordination/UnifiedProcessingCoordinator').UnifiedProcessingCoordinator;
    
    // 创建处理上下文
    const context = {
      filePath: goFilePath,
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
    const { chunks, language, processingStrategy, success } = processingResult;
    
    console.log(`Processing result:`);
    console.log(`  - Language: ${language}`);
    console.log(`  - Strategy: ${processingStrategy}`);
    console.log(`  - Chunks: ${chunks.length}`);
    console.log(`  - Success: ${success}`);
    
    // 显示分段信息
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Chunk ${i + 1}: type=${chunk.metadata?.type}, length=${chunk.content.length}`);
      if (chunk.metadata?.type === 'fallback') {
        console.log(`  Fallback reason: ${chunk.metadata?.fallback ? 'Yes' : 'No'}`);
      }
    }
    
    console.log('Simple Go test completed!');
    
    // 直接退出进程
    process.exit(0);
    
  } catch (error) {
    console.error('Simple Go test failed:', error);
    process.exit(1);
  }
}

// 运行测试
if (require.main === module) {
  runSimpleGoTest().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

export { runSimpleGoTest };