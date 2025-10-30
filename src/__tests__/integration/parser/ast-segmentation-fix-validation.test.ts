import { diContainer } from '../../../core/DIContainer';
import { TYPES } from '../../../types';
import { UnifiedProcessingCoordinator } from '../../../service/parser/processing/coordination/UnifiedProcessingCoordinator';
import { ChunkingOptionsConverter } from '../../../service/parser/types/config-types';
import * as fs from 'fs';
import * as path from 'path';

describe('AST分段策略修复验证', () => {
  let processingCoordinator: UnifiedProcessingCoordinator;
  const testFilesDir = path.join(__dirname, '../../../../../../test-files');

  beforeAll(async () => {
    // 获取处理协调器
    processingCoordinator = diContainer.get(TYPES.UnifiedProcessingCoordinator);
    
    // 等待TreeSitter初始化
    const treeSitterService = diContainer.get(TYPES.TreeSitterCoreService) as any;
    const maxWaitTime = 30000;
    const startTime = Date.now();
    
    while (!treeSitterService.isInitialized() && Date.now() - startTime < maxWaitTime) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (!treeSitterService.isInitialized()) {
      throw new Error('TreeSitterCoreService failed to initialize');
    }
  });

  test('Go文件应该使用treesitter_ast策略并进行函数级分段', async () => {
    const goFilePath = path.join(testFilesDir, 'dataStructure/datastructure/linked_list.go');
    const content = fs.readFileSync(goFilePath, 'utf-8');

    const legacyOptions = {
      maxChunkSize: 2000,
      overlapSize: 200,
      maxLines: 100,
      optimizationLevel: 'medium' as const,
      addOverlap: false,
      maxOverlapRatio: 0.3
    };
    
    const context = {
      filePath: goFilePath,
      content,
      options: ChunkingOptionsConverter.fromLegacy(legacyOptions)
    };

    const result = await processingCoordinator.processFile(context);

    // 验证策略选择
    expect(result.processingStrategy).toBe('treesitter_ast');
    expect(result.language).toBe('go');
    
    // 验证分段结果
    expect(result.chunks.length).toBeGreaterThan(1); // 应该有多个函数
    expect(result.chunks.length).toBe(6); // linked_list.go有6个函数
    
    // 验证每个chunk都是函数类型
    result.chunks.forEach(chunk => {
      expect(chunk.metadata.type).toBe('function');
      expect(chunk.metadata.language).toBe('Go');
      expect(chunk.content).toMatch(/^func\s+\w+/); // 每个chunk都应该以func开头
    });

    // 验证具体的函数
    const functionNames = result.chunks.map(chunk => {
      const match = chunk.content.match(/^func\s+(\w+)/);
      return match ? match[1] : '';
    });

    expect(functionNames).toContain('NewLinkedList');
    expect(functionNames).toContain('ListIsEmpty');
    expect(functionNames).toContain('Append');
    expect(functionNames).toContain('PrintList');
    expect(functionNames).toContain('DeleteNode');
    expect(functionNames).toContain('main');
  });

  test('JavaScript文件应该使用treesitter_ast策略', async () => {
    const jsFilePath = path.join(testFilesDir, 'test-language-detection.js');
    const content = fs.readFileSync(jsFilePath, 'utf-8');

    const legacyOptions = {
      maxChunkSize: 2000,
      overlapSize: 200,
      maxLines: 100,
      optimizationLevel: 'medium' as const,
      addOverlap: false,
      maxOverlapRatio: 0.3
    };
    
    const context = {
      filePath: jsFilePath,
      content,
      options: ChunkingOptionsConverter.fromLegacy(legacyOptions)
    };

    const result = await processingCoordinator.processFile(context);

    // 验证策略选择
    expect(result.processingStrategy).toBe('treesitter_ast');
    expect(result.language).toBe('javascript');
    
    // 验证分段结果
    expect(result.chunks.length).toBeGreaterThanOrEqual(1);
    
    // 验证chunk类型
    result.chunks.forEach(chunk => {
      expect(chunk.metadata.language).toBe('JavaScript');
    });
  });

  test('Python文件应该使用treesitter_ast策略', async () => {
    const pyFilePath = path.join(testFilesDir, 'test.py');
    const content = fs.readFileSync(pyFilePath, 'utf-8');

    const legacyOptions = {
      maxChunkSize: 2000,
      overlapSize: 200,
      maxLines: 100,
      optimizationLevel: 'medium' as const,
      addOverlap: false,
      maxOverlapRatio: 0.3
    };
    
    const context = {
      filePath: pyFilePath,
      content,
      options: ChunkingOptionsConverter.fromLegacy(legacyOptions)
    };

    const result = await processingCoordinator.processFile(context);

    // 验证策略选择
    expect(result.processingStrategy).toBe('treesitter_ast');
    expect(result.language).toBe('python');
    
    // 验证分段结果
    expect(result.chunks.length).toBeGreaterThanOrEqual(1);
    
    // 验证chunk类型
    result.chunks.forEach(chunk => {
      expect(chunk.metadata.language).toBe('Python');
    });
  });

  test('没有函数的Go文件应该回退到全内容分段', async () => {
    // 创建一个没有函数的Go文件内容
    const simpleGoContent = `
package main

import "fmt"

const (
    PI = 3.14159
    E = 2.71828
)

var globalVariable int = 42
`;

    const legacyOptions = {
      maxChunkSize: 2000,
      overlapSize: 200,
      maxLines: 100,
      optimizationLevel: 'medium' as const,
      addOverlap: false,
      maxOverlapRatio: 0.3
    };
    
    const context = {
      filePath: 'test-simple.go',
      content: simpleGoContent,
      options: ChunkingOptionsConverter.fromLegacy(legacyOptions)
    };

    const result = await processingCoordinator.processFile(context);

    // 验证策略选择
    expect(result.processingStrategy).toBe('treesitter_ast');
    expect(result.language).toBe('go');
    
    // 验证分段结果 - 应该回退到全内容
    expect(result.chunks.length).toBe(1);
    expect(result.chunks[0].metadata.type).toBe('full_content');
    expect(result.chunks[0].content).toBe(simpleGoContent.trim());
  });

  test('Markdown文件应该使用markdown_specialized策略', async () => {
    const mdFilePath = path.join(testFilesDir, 'example.md');
    const content = fs.readFileSync(mdFilePath, 'utf-8');

    const legacyOptions = {
      maxChunkSize: 2000,
      overlapSize: 200,
      maxLines: 100,
      optimizationLevel: 'medium' as const,
      addOverlap: false,
      maxOverlapRatio: 0.3
    };
    
    const context = {
      filePath: mdFilePath,
      content,
      options: ChunkingOptionsConverter.fromLegacy(legacyOptions)
    };

    const result = await processingCoordinator.processFile(context);

    // 验证策略选择
    expect(result.processingStrategy).toBe('markdown_specialized');
    expect(result.language).toBe('markdown');
    
    // 验证分段结果
    expect(result.chunks.length).toBeGreaterThanOrEqual(1);
  });

  afterAll(() => {
    // 清理资源
  });
});