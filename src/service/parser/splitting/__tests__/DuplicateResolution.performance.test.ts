import { ASTCodeSplitter } from '../ASTCodeSplitter';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';
import { DEFAULT_CHUNKING_OPTIONS } from '../types';

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

describe('Duplicate Resolution Performance Tests', () => {
  let splitter: ASTCodeSplitter;
  let mockOptions: any;

  beforeEach(() => {
    mockOptions = {
      ...DEFAULT_CHUNKING_OPTIONS,
      enableChunkingCoordination: true,
      enableNodeTracking: true,
      enableChunkDeduplication: true,
      enableASTBoundaryDetection: true
    };

    splitter = new ASTCodeSplitter(
      mockTreeSitterService as TreeSitterService,
      mockLoggerService as LoggerService
    );

    // 设置选项
    splitter.setChunkSize(mockOptions.maxChunkSize);
    splitter.setChunkOverlap(mockOptions.overlapSize);

    // 重置所有mock
    jest.clearAllMocks();
  });

  describe('Duplicate Detection Performance', () => {
    it('should efficiently handle large files with many duplicates', async () => {
      // 创建包含大量重复代码的大文件
      let code = '';
      const duplicateFunction = `
function duplicateFunction() {
  if (condition) {
    console.log("This is a duplicate function");
    return true;
  }
  return false;
}
`;

      // 添加100个重复函数
      for (let i = 0; i < 100; i++) {
        code += duplicateFunction + '\n';
      }

      // Mock AST
      const mockAST = {
        success: true,
        ast: {
          rootNode: {
            type: 'program',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 800, column: 0 },
            startIndex: 0,
            endIndex: code.length
          }
        }
      };

      // Mock TreeSitterService responses
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue(mockAST);
      (mockTreeSitterService.detectLanguage as jest.Mock).mockReturnValue('javascript');

      // Mock 100个重复函数节点
      const mockFunctions = [];
      for (let i = 0; i < 100; i++) {
        mockFunctions.push({
          startPosition: { row: i * 8, column: 0 },
          endPosition: { row: i * 8 + 6, column: 1 },
          startIndex: i * duplicateFunction.length,
          endIndex: (i + 1) * duplicateFunction.length - 1,
          type: 'function_declaration'
        });
      }

      (mockTreeSitterService.extractFunctions as jest.Mock).mockReturnValue(mockFunctions);
      (mockTreeSitterService.extractClasses as jest.Mock).mockReturnValue([]);
      (mockTreeSitterService.extractImports as jest.Mock).mockReturnValue([]);

      // Mock node text and location
      (mockTreeSitterService.getNodeText as jest.Mock).mockReturnValue(duplicateFunction.trim());
      (mockTreeSitterService.getNodeLocation as jest.Mock).mockImplementation((node) => ({
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1
      }));
      (mockTreeSitterService.getNodeName as jest.Mock).mockReturnValue('duplicateFunction');

      // 测量性能
      const startTime = performance.now();
      const chunks = await splitter.split(code, 'javascript', 'large-duplicate-file.js');
      const endTime = performance.now();

      const processingTime = endTime - startTime;
      const chunksPerSecond = (chunks.length / processingTime) * 1000;

      console.log(`Large duplicate file processing:`);
      console.log(`  - Processing time: ${processingTime.toFixed(2)}ms`);
      console.log(`  - Chunks generated: ${chunks.length}`);
      console.log(`  - Expected unique chunks: 1`);
      console.log(`  - Chunks per second: ${chunksPerSecond.toFixed(2)}`);

      // 验证结果
      expect(chunks).toBeDefined();
      expect(chunks.length).toBe(1); // 应该只有一个唯一块
      expect(chunks[0].metadata.functionName).toBe('duplicateFunction');

      // 验证性能 - 应该在合理时间内完成
      expect(processingTime).toBeLessThan(1000); // 小于1秒
    });

    it('should handle mixed content with some duplicates efficiently', async () => {
      // 创建包含混合内容的文件，部分重复
      let code = '';

      // 添加导入
      code += 'import React from "react";\n';
      code += 'import { Component } from "./Component";\n\n';

      // 添加重复函数
      const duplicateFunction = `
function processData() {
  const data = fetchData();
  return data.map(item => ({
    ...item,
    processed: true
  }));
}
`;
      
      // 添加3个重复函数
      for (let i = 0; i < 3; i++) {
        code += duplicateFunction + '\n';
      }

      // 添加唯一函数
      const uniqueFunctions = [
        `function uniqueFunction1() {
  console.log("Unique function 1");
  return "result1";
}`,
        `function uniqueFunction2() {
  console.log("Unique function 2");
  return "result2";
}`,
        `function uniqueFunction3() {
  console.log("Unique function 3");
  return "result3";
}`
      ];

      uniqueFunctions.forEach(func => {
        code += func + '\n';
      });

      // Mock AST
      const mockAST = {
        success: true,
        ast: {
          rootNode: {
            type: 'program',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 50, column: 0 },
            startIndex: 0,
            endIndex: code.length
          }
        }
      };

      // Mock TreeSitterService responses
      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue(mockAST);
      (mockTreeSitterService.detectLanguage as jest.Mock).mockReturnValue('javascript');

      // Mock imports
      const mockImports = [
        {
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 0, column: 24 },
          startIndex: 0,
          endIndex: 24,
          type: 'import_statement'
        },
        {
          startPosition: { row: 1, column: 0 },
          endPosition: { row: 1, column: 35 },
          startIndex: 25,
          endIndex: 60,
          type: 'import_statement'
        }
      ];

      // Mock functions (3 duplicates + 3 unique)
      const mockFunctions = [];
      
      // 3个重复函数
      for (let i = 0; i < 3; i++) {
        mockFunctions.push({
          startPosition: { row: 4 + i * 7, column: 0 },
          endPosition: { row: 9 + i * 7, column: 1 },
          startIndex: 62 + i * duplicateFunction.length,
          endIndex: 62 + (i + 1) * duplicateFunction.length - 1,
          type: 'function_declaration'
        });
      }

      // 3个唯一函数
      let currentStart = 62 + 3 * duplicateFunction.length;
      uniqueFunctions.forEach((func, index) => {
        mockFunctions.push({
          startPosition: { row: 25 + index * 5, column: 0 },
          endPosition: { row: 27 + index * 5, column: 1 },
          startIndex: currentStart,
          endIndex: currentStart + func.length - 1,
          type: 'function_declaration'
        });
        currentStart += func.length + 1;
      });

      (mockTreeSitterService.extractImports as jest.Mock).mockReturnValue(mockImports);
      (mockTreeSitterService.extractFunctions as jest.Mock).mockReturnValue(mockFunctions);
      (mockTreeSitterService.extractClasses as jest.Mock).mockReturnValue([]);

      // Mock node text and location
      (mockTreeSitterService.getNodeText as jest.Mock).mockImplementation((node, content) => {
        if (node.type === 'import_statement') {
          if (node.startIndex === 0) return 'import React from "react";';
          return 'import { Component } from "./Component";';
        } else if (node.type === 'function_declaration') {
          if (node.startIndex < 62 + 3 * duplicateFunction.length) {
            return duplicateFunction.trim();
          } else {
            return uniqueFunctions.find(func => content.includes(func.trim()))?.trim() || '';
          }
        }
        return '';
      });

      (mockTreeSitterService.getNodeLocation as jest.Mock).mockImplementation((node) => ({
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1
      }));

      (mockTreeSitterService.getNodeName as jest.Mock).mockImplementation((node) => {
        if (node.type === 'function_declaration') {
          if (node.startIndex < 62 + 3 * duplicateFunction.length) {
            return 'processData';
          } else {
            const index = Math.floor((node.startIndex - (62 + 3 * duplicateFunction.length)) / 100);
            return `uniqueFunction${index + 1}`;
          }
        }
        return '';
      });

      // 测量性能
      const startTime = performance.now();
      const chunks = await splitter.split(code, 'javascript', 'mixed-content.js');
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      console.log(`Mixed content processing:`);
      console.log(`  - Processing time: ${processingTime.toFixed(2)}ms`);
      console.log(`  - Total chunks: ${chunks.length}`);
      console.log(`  - Expected chunks: 5 (2 imports + 1 duplicate + 3 unique)`);

      // 验证结果
      expect(chunks).toBeDefined();
      expect(chunks.length).toBe(5); // 2个导入 + 1个重复函数 + 3个唯一函数

      // 验证去重效果
      const processDataChunks = chunks.filter(chunk => 
        chunk.metadata.functionName === 'processData'
      );
      expect(processDataChunks.length).toBe(1); // 应该只有一个processData块

      // 验证性能
      expect(processingTime).toBeLessThan(500); // 小于500ms
    });

    it('should compare performance with and without coordination', async () => {
      // 创建测试代码
      const code = `
import React from 'react';
import { useState } from 'react';

class MyComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
  }

  increment() {
    this.setState(prevState => ({ count: prevState.count + 1 }));
  }

  render() {
    return (
      <div>
        <p>Count: {this.state.count}</p>
        <button onClick={() => this.increment()}>Increment</button>
      </div>
    );
  }
}

function HelperComponent() {
  const [count, setCount] = useState(0);
  
  const increment = () => {
    setCount(prevCount => prevCount + 1);
  };

  return (
    <div>
      <p>Helper Count: {count}</p>
      <button onClick={increment}>Increment Helper</button>
    </div>
  );
}

function duplicateFunction() {
  console.log("This function appears twice");
  return true;
}

function duplicateFunction() {
  console.log("This function appears twice");
  return true;
}
      `;

      // Mock AST
      const mockAST = {
        success: true,
        ast: {
          rootNode: {
            type: 'program',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 50, column: 0 },
            startIndex: 0,
            endIndex: code.length
          }
        }
      };

      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue(mockAST);
      (mockTreeSitterService.detectLanguage as jest.Mock).mockReturnValue('typescript');

      // Mock imports, classes, and functions
      const mockImports = [
        { startPosition: { row: 1, column: 0 }, endPosition: { row: 1, column: 20 }, startIndex: 1, endIndex: 21, type: 'import_statement' },
        { startPosition: { row: 2, column: 0 }, endPosition: { row: 2, column: 23 }, startIndex: 22, endIndex: 45, type: 'import_statement' }
      ];

      const mockClasses = [
        { startPosition: { row: 4, column: 0 }, endPosition: { row: 26, column: 1 }, startIndex: 47, endIndex: 300, type: 'class_declaration' }
      ];

      const mockFunctions = [
        { startPosition: { row: 28, column: 0 }, endPosition: { row: 40, column: 1 }, startIndex: 302, endIndex: 450, type: 'function_declaration' },
        { startPosition: { row: 42, column: 0 }, endPosition: { row: 44, column: 1 }, startIndex: 452, endIndex: 500, type: 'function_declaration' },
        { startPosition: { row: 46, column: 0 }, endPosition: { row: 48, column: 1 }, startIndex: 502, endIndex: 550, type: 'function_declaration' }
      ];

      (mockTreeSitterService.extractImports as jest.Mock).mockReturnValue(mockImports);
      (mockTreeSitterService.extractClasses as jest.Mock).mockReturnValue(mockClasses);
      (mockTreeSitterService.extractFunctions as jest.Mock).mockReturnValue(mockFunctions);

      // Mock node text and location
      (mockTreeSitterService.getNodeText as jest.Mock).mockImplementation((node) => {
        if (node.type === 'import_statement') {
          return node.startIndex === 1 ? 'import React from \'react\';' : 'import { useState } from \'react\';';
        } else if (node.type === 'class_declaration') {
          return 'class MyComponent extends React.Component {...}';
        } else if (node.type === 'function_declaration') {
          if (node.startIndex === 452 || node.startIndex === 502) {
            return 'function duplicateFunction() {...}';
          }
          return 'function HelperComponent() {...}';
        }
        return '';
      });

      (mockTreeSitterService.getNodeLocation as jest.Mock).mockImplementation((node) => ({
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1
      }));

      (mockTreeSitterService.getNodeName as jest.Mock).mockImplementation((node) => {
        if (node.type === 'class_declaration') return 'MyComponent';
        if (node.type === 'function_declaration') {
          if (node.startIndex === 452 || node.startIndex === 502) return 'duplicateFunction';
          return 'HelperComponent';
        }
        return '';
      });

      // 测试不使用协调机制的性能
      const optionsWithoutCoordination = {
        ...mockOptions,
        enableChunkingCoordination: false,
        enableNodeTracking: false,
        enableChunkDeduplication: false
      };

      const startTime1 = performance.now();
      const chunks1 = await splitter.split(code, 'typescript', 'test.ts');
      const endTime1 = performance.now();
      const timeWithoutCoordination = endTime1 - startTime1;

      // 测试使用协调机制的性能
      const startTime2 = performance.now();
      const chunks2 = await splitter.split(code, 'typescript', 'test.ts');
      const endTime2 = performance.now();
      const timeWithCoordination = endTime2 - startTime2;

      console.log(`Performance comparison:`);
      console.log(`  - Without coordination: ${timeWithoutCoordination.toFixed(2)}ms, ${chunks1.length} chunks`);
      console.log(`  - With coordination: ${timeWithCoordination.toFixed(2)}ms, ${chunks2.length} chunks`);
      console.log(`  - Performance impact: ${((timeWithCoordination - timeWithoutCoordination) / timeWithoutCoordination * 100).toFixed(2)}%`);
      console.log(`  - Duplicate reduction: ${chunks1.length - chunks2.length} chunks`);

      // 验证结果
      expect(chunks2.length).toBeLessThan(chunks1.length); // 协调机制应该减少重复块
      expect(chunks2.length).toBe(5); // 2个导入 + 1个类 + 2个函数（重复的应该被去重）
      
      // 验证性能影响 - 协调机制不应该显著影响性能
      const performanceImpact = (timeWithCoordination - timeWithoutCoordination) / timeWithoutCoordination;
      expect(performanceImpact).toBeLessThan(0.5); // 性能影响应该小于50%
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not cause memory leaks with repeated processing', async () => {
      const code = `
function testFunction() {
  return "test";
}
      `;

      // Mock AST
      const mockAST = {
        success: true,
        ast: {
          rootNode: {
            type: 'program',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 3, column: 0 },
            startIndex: 0,
            endIndex: code.length
          }
        }
      };

      (mockTreeSitterService.parseCode as jest.Mock).mockResolvedValue(mockAST);
      (mockTreeSitterService.detectLanguage as jest.Mock).mockReturnValue('javascript');

      const mockFunctions = [
        { startPosition: { row: 1, column: 0 }, endPosition: { row: 3, column: 1 }, startIndex: 1, endIndex: 30, type: 'function_declaration' }
      ];

      (mockTreeSitterService.extractFunctions as jest.Mock).mockReturnValue(mockFunctions);
      (mockTreeSitterService.extractClasses as jest.Mock).mockReturnValue([]);
      (mockTreeSitterService.extractImports as jest.Mock).mockReturnValue([]);

      (mockTreeSitterService.getNodeText as jest.Mock).mockReturnValue('function testFunction() {\n  return "test";\n}');
      (mockTreeSitterService.getNodeLocation as jest.Mock).mockReturnValue({ startLine: 2, endLine: 4 });
      (mockTreeSitterService.getNodeName as jest.Mock).mockReturnValue('testFunction');

      // 记录初始内存使用
      const initialMemory = process.memoryUsage();

      // 重复处理代码多次
      for (let i = 0; i < 100; i++) {
        await splitter.split(code, 'javascript', `test-${i}.js`);
      }

      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }

      // 记录最终内存使用
      const finalMemory = process.memoryUsage();

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

      console.log(`Memory usage after 100 iterations:`);
      console.log(`  - Initial memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  - Final memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  - Memory increase: ${memoryIncreaseMB.toFixed(2)} MB`);

      // 验证内存使用 - 增长应该在合理范围内
      expect(memoryIncreaseMB).toBeLessThan(10); // 内存增长应该小于10MB
    });
  });
});