import { ChunkingCoordinator } from '../utils/ChunkingCoordinator';
import { ASTNodeTracker } from '../utils/ASTNodeTracker';
import { FunctionSplitter } from '../strategies/FunctionSplitter';
import { ClassSplitter } from '../strategies/ClassSplitter';
import { ImportSplitter } from '../strategies/ImportSplitter';
import { SyntaxAwareSplitter } from '../strategies/SyntaxAwareSplitter';
import { IntelligentSplitter } from '../strategies/IntelligentSplitter';
import { DEFAULT_CHUNKING_OPTIONS } from '../types';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';

// Mock TreeSitterService
const mockTreeSitterService: Partial<TreeSitterService> = {
  parseCode: jest.fn(),
  detectLanguage: jest.fn(),
  extractFunctions: jest.fn(),
  extractClasses: jest.fn(),
  extractImports: jest.fn(),
  getNodeText: jest.fn(),
  getNodeLocation: jest.fn(),
  getNodeName: jest.fn()
};

// Mock LoggerService
const mockLoggerService: Partial<LoggerService> = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('ChunkingCoordinator', () => {
  let chunkingCoordinator: ChunkingCoordinator;
  let nodeTracker: ASTNodeTracker;
  let mockOptions: any;

  beforeEach(() => {
    nodeTracker = new ASTNodeTracker();
    mockOptions = {
      ...DEFAULT_CHUNKING_OPTIONS,
      enableChunkingCoordination: true,
      enableNodeTracking: true
    };
    
    chunkingCoordinator = new ChunkingCoordinator(
      nodeTracker,
      mockOptions,
      mockLoggerService as LoggerService
    );

    // 注册所有策略
    const importSplitter = new ImportSplitter(mockOptions);
    const classSplitter = new ClassSplitter(mockOptions);
    const functionSplitter = new FunctionSplitter(mockOptions);
    const syntaxAwareSplitter = new SyntaxAwareSplitter(mockOptions);
    const intelligentSplitter = new IntelligentSplitter(mockOptions);

    // 设置TreeSitterService
    importSplitter.setTreeSitterService(mockTreeSitterService as TreeSitterService);
    classSplitter.setTreeSitterService(mockTreeSitterService as TreeSitterService);
    functionSplitter.setTreeSitterService(mockTreeSitterService as TreeSitterService);
    syntaxAwareSplitter.setTreeSitterService(mockTreeSitterService as TreeSitterService);

    // 设置LoggerService
    importSplitter.setLogger(mockLoggerService as LoggerService);
    classSplitter.setLogger(mockLoggerService as LoggerService);
    functionSplitter.setLogger(mockLoggerService as LoggerService);
    syntaxAwareSplitter.setLogger(mockLoggerService as LoggerService);
    intelligentSplitter.setLogger(mockLoggerService as LoggerService);

    chunkingCoordinator.registerStrategy(importSplitter);
    chunkingCoordinator.registerStrategy(classSplitter);
    chunkingCoordinator.registerStrategy(functionSplitter);
    chunkingCoordinator.registerStrategy(syntaxAwareSplitter);
    chunkingCoordinator.registerStrategy(intelligentSplitter);

    // 重置所有mock
    jest.clearAllMocks();
  });

  describe('coordinate', () => {
    it('should coordinate chunking with multiple strategies', async () => {
      const code = `
import React from 'react';
import { Component } from './Component';

class MyClass extends Component {
  constructor() {
    super();
  }

  render() {
    return <div>Hello World</div>;
  }
}

function myFunction() {
  console.log('Hello World');
  return true;
}
      `;
      const language = 'typescript';
      const filePath = 'test.ts';

      // Mock AST
      const mockAST = {
        success: true,
        ast: {
          rootNode: {
            type: 'program',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 20, column: 0 },
            startIndex: 0,
            endIndex: 500
          }
        }
      };

      // Mock TreeSitterService responses
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue(mockAST);
      
      // Mock imports
      const mockImports = [
        {
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 0, column: 20 },
          startIndex: 0,
          endIndex: 20,
          type: 'import_statement'
        },
        {
          startPosition: { row: 1, column: 0 },
          endPosition: { row: 1, column: 30 },
          startIndex: 21,
          endIndex: 51,
          type: 'import_statement'
        }
      ];
      
      // Mock classes
      const mockClasses = [
        {
          startPosition: { row: 3, column: 0 },
          endPosition: { row: 12, column: 1 },
          startIndex: 53,
          endIndex: 200,
          type: 'class_declaration'
        }
      ];
      
      // Mock functions
      const mockFunctions = [
        {
          startPosition: { row: 14, column: 0 },
          endPosition: { row: 17, column: 1 },
          startIndex: 202,
          endIndex: 250,
          type: 'function_declaration'
        }
      ];

      (mockTreeSitterService.extractImports as jest.Mock).mockReturnValue(mockImports);
      (mockTreeSitterService.extractClasses as jest.Mock).mockReturnValue(mockClasses);
      (mockTreeSitterService.extractFunctions as jest.Mock).mockReturnValue(mockFunctions);

      // Mock node text and location
      (mockTreeSitterService.getNodeText as jest.Mock).mockImplementation((node, content) => {
        if (node.type === 'import_statement') {
          if (node.startIndex === 0) return 'import React from \'react\';';
          return 'import { Component } from \'./Component\';';
        } else if (node.type === 'class_declaration') {
          return 'class MyClass extends Component {\n  constructor() {\n    super();\n  }\n\n  render() {\n    return <div>Hello World</div>;\n  }\n}';
        } else if (node.type === 'function_declaration') {
          return 'function myFunction() {\n  console.log(\'Hello World\');\n  return true;\n}';
        }
        return '';
      });

      (mockTreeSitterService.getNodeLocation as jest.Mock).mockImplementation((node) => ({
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1
      }));

      (mockTreeSitterService.getNodeName as jest.Mock).mockImplementation((node) => {
        if (node.type === 'class_declaration') return 'MyClass';
        if (node.type === 'function_declaration') return 'myFunction';
        return '';
      });

      const chunks = await chunkingCoordinator.coordinate(code, language, filePath, mockAST);

      // 验证结果
      expect(chunks).toBeDefined();
      expect(chunks.length).toBeGreaterThan(0);
      
      // 验证没有重复块
      const chunkContents = chunks.map(chunk => chunk.content);
      const uniqueContents = new Set(chunkContents);
      expect(uniqueContents.size).toBe(chunkContents.length);

      // 验证节点跟踪器统计
      const stats = nodeTracker.getStats();
      expect(stats.usedNodes).toBeGreaterThan(0);
      expect(stats.totalNodes).toBeGreaterThan(0);

      // 验证日志调用
      expect(mockLoggerService.info).toHaveBeenCalled();
      expect(mockLoggerService.debug).toHaveBeenCalled();
    });

    it('should handle duplicate chunks correctly', async () => {
      const code = `
function duplicateFunction() {
  console.log("This is a duplicate");
  return true;
}

function duplicateFunction() {
  console.log("This is a duplicate");
  return true;
}
      `;
      const language = 'javascript';
      const filePath = 'duplicate.js';

      // Mock AST
      const mockAST = {
        success: true,
        ast: {
          rootNode: {
            type: 'program',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 10, column: 0 },
            startIndex: 0,
            endIndex: 200
          }
        }
      };

      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue(mockAST);
      
      // Mock duplicate functions
      const mockFunctions = [
        {
          startPosition: { row: 1, column: 0 },
          endPosition: { row: 4, column: 1 },
          startIndex: 1,
          endIndex: 100,
          type: 'function_declaration'
        },
        {
          startPosition: { row: 6, column: 0 },
          endPosition: { row: 9, column: 1 },
          startIndex: 102,
          endIndex: 201,
          type: 'function_declaration'
        }
      ];

      (mockTreeSitterService.extractFunctions as jest.Mock).mockReturnValue(mockFunctions);
      (mockTreeSitterService.extractClasses as jest.Mock).mockReturnValue([]);
      (mockTreeSitterService.extractImports as jest.Mock).mockReturnValue([]);

      // Mock node text and location
      (mockTreeSitterService.getNodeText as jest.Mock).mockReturnValue('function duplicateFunction() {\n  console.log("This is a duplicate");\n  return true;\n}');
      (mockTreeSitterService.getNodeLocation as jest.Mock).mockImplementation((node) => ({
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1
      }));
      (mockTreeSitterService.getNodeName as jest.Mock).mockReturnValue('duplicateFunction');

      const chunks = await chunkingCoordinator.coordinate(code, language, filePath, mockAST);

      // 验证结果 - 应该只有一个块，因为第二个是重复的
      expect(chunks).toBeDefined();
      expect(chunks.length).toBe(1);
      expect(chunks[0].metadata.functionName).toBe('duplicateFunction');
    });

    it('should handle unsupported languages gracefully', async () => {
      const code = 'some code';
      const language = 'unsupported';
      const filePath = 'test.xyz';

      // Mock unsupported language
      (mockTreeSitterService.detectLanguage as jest.Mock).mockReturnValue(null);

      const chunks = await chunkingCoordinator.coordinate(code, language, filePath);

      // 验证结果 - 应该返回空数组或后备方案的结果
      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);

      // 验证警告日志
      expect(mockLoggerService.warn).toHaveBeenCalled();
    });

    it('should handle errors in individual strategies', async () => {
      const code = 'some code';
      const language = 'typescript';
      const filePath = 'test.ts';

      // Mock AST
      const mockAST = {
        success: true,
        ast: {
          rootNode: {
            type: 'program',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 5, column: 0 },
            startIndex: 0,
            endIndex: 100
          }
        }
      };

      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue(mockAST);
      
      // Mock extractFunctions to throw an error
      (mockTreeSitterService.extractFunctions as jest.Mock).mockImplementation(() => {
        throw new Error('Extraction failed');
      });
      (mockTreeSitterService.extractClasses as jest.Mock).mockReturnValue([]);
      (mockTreeSitterService.extractImports as jest.Mock).mockReturnValue([]);

      const chunks = await chunkingCoordinator.coordinate(code, language, filePath, mockAST);

      // 验证结果 - 应该继续处理其他策略
      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);

      // 验证错误日志
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Strategy FunctionSplitter failed')
      );
    });
  });

  describe('getCoordinatorStats', () => {
    it('should return coordinator statistics', () => {
      const stats = chunkingCoordinator.getCoordinatorStats();

      expect(stats).toBeDefined();
      expect(stats.registeredStrategies).toBeGreaterThan(0);
      expect(stats.nodeTrackerStats).toBeDefined();
      expect(stats.nodeTrackerStats.totalNodes).toBe(0);
      expect(stats.nodeTrackerStats.usedNodes).toBe(0);
      expect(stats.nodeTrackerStats.reuseCount).toBe(0);
    });
  });

  describe('setOptions and getOptions', () => {
    it('should set and get options correctly', () => {
      const newOptions = {
        ...mockOptions,
        maxChunkSize: 2000,
        enableChunkDeduplication: true
      };

      chunkingCoordinator.setOptions(newOptions);
      const retrievedOptions = chunkingCoordinator.getOptions();

      expect(retrievedOptions.maxChunkSize).toBe(2000);
      expect(retrievedOptions.enableChunkDeduplication).toBe(true);
    });
  });
});