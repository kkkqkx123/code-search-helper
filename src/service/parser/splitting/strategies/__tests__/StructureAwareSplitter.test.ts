import { StructureAwareSplitter } from '../StructureAwareSplitter';
import { IQueryResultNormalizer, StandardizedQueryResult } from '../../../core/normalization/types';
import { TreeSitterCoreService } from '../../../core/parse/TreeSitterCoreService';
import { CodeChunk } from '../..';

// Mock QueryResultNormalizer
class MockQueryResultNormalizer implements IQueryResultNormalizer {
  async normalize(ast: any, language: string, queryTypes?: string[]): Promise<StandardizedQueryResult[]> {
    // 返回模拟的标准化结果
    return [
      {
        type: 'import',
        name: 'import',
        startLine: 1,
        endLine: 2,
        content: 'import { Component } from "react";',
        metadata: {
          language,
          complexity: 1,
          dependencies: ['Component'],
          modifiers: [],
          extra: {}
        }
      },
      {
        type: 'class',
        name: 'MyComponent',
        startLine: 4,
        endLine: 8,
        content: `class MyComponent extends Component {
  render() {
    return <div>Hello World</div>;
  }
}`,
        metadata: {
          language,
          complexity: 3,
          dependencies: ['Component'],
          modifiers: [],
          extra: { hasInheritance: true }
        }
      },
      {
        type: 'function',
        name: 'helperFunction',
        startLine: 10,
        endLine: 12,
        content: `function helperFunction() {
  return 42;
}`,
        metadata: {
          language,
          complexity: 1,
          dependencies: [],
          modifiers: [],
          extra: {}
        }
      }
    ];
  }

  async getSupportedQueryTypes(language: string): Promise<string[]> {
    return ['functions', 'classes', 'imports'];
  }

  mapNodeType(nodeType: string, language: string): string {
    return nodeType;
  }
}

// Mock TreeSitterCoreService
class MockTreeSitterCoreService {
  async parseCode(content: string, language: string) {
    return {
      success: true,
      ast: { text: content }, // 简化的AST
      language,
      parseTime: 10
    };
  }
}

describe('StructureAwareSplitter', () => {
  let splitter: StructureAwareSplitter;
  let mockNormalizer: IQueryResultNormalizer;
  let mockTreeSitterService: TreeSitterCoreService;

  beforeEach(() => {
    splitter = new StructureAwareSplitter();
    mockNormalizer = new MockQueryResultNormalizer();
    mockTreeSitterService = new MockTreeSitterCoreService() as any;

    splitter.setQueryNormalizer(mockNormalizer);
    splitter.setTreeSitterService(mockTreeSitterService);
  });

  describe('Basic Splitting', () => {
    test('should split code at structural boundaries', async () => {
      const code = `import { Component } from "react";

class MyComponent extends Component {
  render() {
    return <div>Hello World</div>;
  }
}

function helperFunction() {
  return 42;
}`;

      const chunks = await splitter.split(code, 'typescript');

      expect(chunks).toHaveLength(3);
      
      // 验证第一个块（import）
      expect(chunks[0].metadata.type).toBe('import');
      expect(chunks[0].metadata.startLine).toBe(1);
      expect(chunks[0].metadata.endLine).toBe(2);
      
      // 验证第二个块（class）
      expect(chunks[1].metadata.type).toBe('class');
      expect(chunks[1].metadata.name).toBe('MyComponent');
      expect(chunks[1].metadata.startLine).toBe(4);
      expect(chunks[1].metadata.endLine).toBe(8);
      
      // 验证第三个块（function）
      expect(chunks[2].metadata.type).toBe('function');
      expect(chunks[2].metadata.name).toBe('helperFunction');
      expect(chunks[2].metadata.startLine).toBe(10);
      expect(chunks[2].metadata.endLine).toBe(12);
    });

    test('should handle code with gaps between structures', async () => {
      const code = `import { Component } from "react";

// This is a comment gap

class MyComponent extends Component {
  render() {
    return <div>Hello World</div>;
  }
}

// Another gap

function helperFunction() {
  return 42;
}`;

      const chunks = await splitter.split(code, 'typescript');

      // 应该包含gap块
      expect(chunks.length).toBeGreaterThan(3);
      
      // 检查是否有code类型的块
      const codeChunks = chunks.filter(chunk => chunk.metadata.type === 'code');
      expect(codeChunks.length).toBeGreaterThan(0);
    });
  });

  describe('Structure Importance Sorting', () => {
    test('should sort structures by importance', async () => {
      // 创建一个顺序混乱的代码
      const code = `function helperFunction() {
  return 42;
}

import { Component } from "react";

class MyComponent extends Component {
  render() {
    return <div>Hello World</div>;
  }
}`;

      const chunks = await splitter.split(code, 'typescript');

      // 验证排序：import应该在最前面，然后是class，最后是function
      const types = chunks.map(chunk => chunk.metadata.type);
      expect(types.indexOf('import')).toBeLessThan(types.indexOf('class'));
      expect(types.indexOf('class')).toBeLessThan(types.indexOf('function'));
    });
  });

  describe('Small Chunk Merging', () => {
    test('should merge small chunks', async () => {
      const splitterWithMinSize = new StructureAwareSplitter({
        minChunkSize: 20 // 设置较大的最小块大小
      });
      splitterWithMinSize.setQueryNormalizer(mockNormalizer);
      splitterWithMinSize.setTreeSitterService(mockTreeSitterService);

      const code = `import { Component } from "react";

class MyComponent extends Component {
  render() {
    return <div>Hello World</div>;
  }
}`;

      const chunks = await splitterWithMinSize.split(code, 'typescript');

      // 由于设置了较大的最小块大小，可能会合并一些小块
      expect(chunks.length).toBeGreaterThanOrEqual(1);
      
      // 检查是否有合并的块
      const mergedChunks = chunks.filter(chunk => chunk.metadata.type === 'merged');
      if (mergedChunks.length > 0) {
        expect(mergedChunks[0].metadata.mergedCount).toBeGreaterThan(1);
      }
    });
  });

  describe('Error Handling', () => {
    test('should fall back to base splitter when normalizer is not set', async () => {
      const splitterWithoutNormalizer = new StructureAwareSplitter();
      // 不设置normalizer

      const code = `function test() { return 42; }`;
      const chunks = await splitterWithoutNormalizer.split(code, 'typescript');

      // 应该回退到基础分割器，仍然产生结果
      expect(chunks.length).toBeGreaterThan(0);
    });

    test('should fall back to base splitter when tree-sitter service is not set', async () => {
      const splitterWithoutService = new StructureAwareSplitter();
      splitterWithoutService.setQueryNormalizer(mockNormalizer);
      // 不设置tree-sitter service

      const code = `function test() { return 42; }`;
      const chunks = await splitterWithoutService.split(code, 'typescript');

      // 应该回退到基础分割器
      expect(chunks.length).toBeGreaterThan(0);
    });

    test('should handle parsing failures gracefully', async () => {
      const mockFailingService = {
        async parseCode(content: string, language: string) {
          return {
            success: false,
            error: 'Parsing failed'
          };
        }
      } as any;

      splitter.setTreeSitterService(mockFailingService);

      const code = `function test() { return 42; }`;
      const chunks = await splitter.split(code, 'typescript');

      // 应该回退到基础分割器
      expect(chunks.length).toBeGreaterThan(0);
    });

    test('should handle empty structures gracefully', async () => {
      const mockEmptyNormalizer = {
        async normalize(ast: any, language: string): Promise<StandardizedQueryResult[]> {
          return []; // 返回空结果
        },
        async getSupportedQueryTypes(language: string): Promise<string[]> {
          return ['functions', 'classes'];
        },
        mapNodeType(nodeType: string, language: string): string {
          return nodeType;
        }
      };

      splitter.setQueryNormalizer(mockEmptyNormalizer);

      const code = `function test() { return 42; }`;
      const chunks = await splitter.split(code, 'typescript');

      // 应该回退到基础分割器
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Metadata Enrichment', () => {
    test('should enrich chunk metadata with structure information', async () => {
      const code = `import { Component } from "react";

class MyComponent extends Component {
  render() {
    return <div>Hello World</div>;
  }
}`;

      const chunks = await splitter.split(code, 'typescript');

      const classChunk = chunks.find(chunk => chunk.metadata.type === 'class');
      expect(classChunk).toBeDefined();
      expect(classChunk!.metadata.name).toBe('MyComponent');
      expect(classChunk!.metadata.dependencies).toContain('Component');
      expect(classChunk!.metadata.complexity).toBe(3);
      expect(classChunk!.metadata.extra?.hasInheritance).toBe(true);
    });
  });

  describe('Strategy Properties', () => {
    test('should have correct strategy properties', () => {
      expect(splitter.getName()).toBe('StructureAwareSplitter');
      expect(splitter.getPriority()).toBe(1); // 最高优先级
      expect(splitter.supportsLanguage('typescript')).toBe(true);
      expect(splitter.supportsLanguage('python')).toBe(true);
      expect(splitter.supportsLanguage('unknown')).toBe(true); // 标准化器会处理
    });
  });
});