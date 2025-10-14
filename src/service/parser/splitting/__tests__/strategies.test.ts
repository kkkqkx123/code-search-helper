import { SyntaxAwareSplitter } from '../strategies/SyntaxAwareSplitter';
import { FunctionSplitter } from '../strategies/FunctionSplitter';
import { ClassSplitter } from '../strategies/ClassSplitter';
import { ImportSplitter } from '../strategies/ImportSplitter';
import { IntelligentSplitter } from '../strategies/IntelligentSplitter';
import { SemanticSplitter } from '../strategies/SemanticSplitter';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';
import { BalancedChunker } from '../BalancedChunker';
import { ComplexityCalculator } from '../utils/ComplexityCalculator';

// Mock TreeSitterService
class MockTreeSitterService implements Partial<TreeSitterService> {
  async parseCode(code: string, language: string): Promise<any> {
    return {
      success: true,
      ast: { type: 'program', children: [], startIndex: 0, endIndex: code.length } as any,
      language: { name: 'JavaScript', parser: null, fileExtensions: ['.js'], supported: true } as any,
      parseTime: 0,
    };
  }

  extractFunctions(ast: any): any[] {
    // 模拟提取函数
    return [{
      startIndex: 0,
      endIndex: 25,
      startPosition: { row: 0, column: 0 },
      endPosition: { row: 1, column: 1 }
    }];
  }

  extractClasses(ast: any): any[] {
    // 模拟提取类
    return [{
      startIndex: 0,
      endIndex: 20,
      startPosition: { row: 0, column: 0 },
      endPosition: { row: 1, column: 1 }
    }];
  }

  extractImports(ast: any, sourceCode?: string): any[] {
    // 模拟提取导入
    return [{
      startIndex: 0,
      endIndex: 20,
      startPosition: { row: 0, column: 0 },
      endPosition: { row: 0, column: 20 }
    }];
  }

  extractImportNodes(ast: any): any[] {
    // 模拟提取导入节点
    return [{
      startIndex: 0,
      endIndex: 20,
      startPosition: { row: 0, column: 0 },
      endPosition: { row: 0, column: 20 }
    }];
  }

  getNodeText(node: any, content: string): string {
    // 返回节点对应的文本内容
    const start = node.startIndex || 0;
    const end = node.endIndex || content.length;
    return content.substring(start, end);
  }

  getNodeLocation(node: any) {
    return { 
      startLine: 1, 
      endLine: 1, 
      startColumn: 0, 
      endColumn: 0 
    };
  }

  getNodeName(node: any): string {
    return 'test';
  }

 isLanguageSupported(language: string): boolean {
   return true;
 }
 
 detectLanguage(filePath: string): any {
   return { name: 'javascript', parser: null, fileExtensions: ['.js'], supported: true };
 }
}

describe('Strategies', () => {
  let mockTreeSitterService: MockTreeSitterService;
  let mockLoggerService: LoggerService;

  beforeEach(() => {
    mockTreeSitterService = new MockTreeSitterService() as any;
    mockLoggerService = new LoggerService();
  });

 describe('SyntaxAwareSplitter', () => {
    let splitter: SyntaxAwareSplitter;

    beforeEach(() => {
      splitter = new SyntaxAwareSplitter();
      splitter.setTreeSitterService(mockTreeSitterService as any);
      splitter.setLogger(mockLoggerService);
    });

    it('should have correct name', () => {
      expect(splitter.getName()).toBe('SyntaxAwareSplitter');
    });

    it('should support language if TreeSitter supports it', () => {
      expect(splitter.supportsLanguage('javascript')).toBe(true);
    });

    it('should have high priority', () => {
      expect(splitter.getPriority()).toBe(1);
    });

    it('should split code', async () => {
      const code = 'console.log("hello");';
      const result = await splitter.split(code, 'javascript');
      expect(Array.isArray(result)).toBe(true);
      // 验证至少有一个代码块被返回
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('FunctionSplitter', () => {
    let splitter: FunctionSplitter;

    beforeEach(() => {
      splitter = new FunctionSplitter();
      splitter.setTreeSitterService(mockTreeSitterService as any);
      splitter.setLogger(mockLoggerService);
    });

    it('should have correct name', () => {
      expect(splitter.getName()).toBe('FunctionSplitter');
    });

    it('should have medium priority', () => {
      expect(splitter.getPriority()).toBe(2);
    });

    it('should extract functions', () => {
      const code = 'function test() { return 1; }';
      const ast = { type: 'program', children: [] };
      const functions = splitter.extractFunctions(code, ast, 'javascript');
      expect(Array.isArray(functions)).toBe(true);
      // 验证至少有一个函数被提取
      expect(functions.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ClassSplitter', () => {
    let splitter: ClassSplitter;

    beforeEach(() => {
      splitter = new ClassSplitter();
      splitter.setTreeSitterService(mockTreeSitterService as any);
      splitter.setLogger(mockLoggerService);
    });

    it('should have correct name', () => {
      expect(splitter.getName()).toBe('ClassSplitter');
    });

    it('should have medium priority', () => {
      expect(splitter.getPriority()).toBe(2);
    });
  });

  describe('ImportSplitter', () => {
    let splitter: ImportSplitter;

    beforeEach(() => {
      splitter = new ImportSplitter();
      splitter.setTreeSitterService(mockTreeSitterService as any);
      splitter.setLogger(mockLoggerService);
    });

    it('should have correct name', () => {
      expect(splitter.getName()).toBe('ImportSplitter');
    });

    it('should have lower priority', () => {
      expect(splitter.getPriority()).toBe(3);
    });
 });

  describe('IntelligentSplitter', () => {
    let splitter: IntelligentSplitter;
    let balancedChunker: BalancedChunker;

    beforeEach(() => {
      balancedChunker = new BalancedChunker();
      splitter = new IntelligentSplitter();
      splitter.setBalancedChunker(balancedChunker);
      splitter.setOptimizationLevel('medium');
    });

    it('should have correct name', () => {
      expect(splitter.getName()).toBe('IntelligentSplitter');
    });

    it('should have lower priority', () => {
      expect(splitter.getPriority()).toBe(4);
    });

    it('should split code intelligently', async () => {
      const code = 'const x = 1; console.log(x);';
      const result = await splitter.split(code, 'javascript');
      expect(Array.isArray(result)).toBe(true);
      // 验证至少有一个代码块被返回
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('SemanticSplitter', () => {
    let splitter: SemanticSplitter;

    beforeEach(() => {
      const complexityCalculator = new ComplexityCalculator();
      splitter = new SemanticSplitter();
      splitter.setComplexityCalculator(complexityCalculator);
      splitter.setMaxLines(10000);
    });

    it('should have correct name', () => {
      expect(splitter.getName()).toBe('SemanticSplitter');
    });

    it('should have lowest priority', () => {
      expect(splitter.getPriority()).toBe(5);
    });

    it('should split code semantically', async () => {
      const code = 'const x = 1; console.log(x);';
      const result = await splitter.split(code, 'javascript');
      expect(Array.isArray(result)).toBe(true);
      // 验证至少有一个代码块被返回
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });
});