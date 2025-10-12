import { ASTCodeSplitter } from '../ASTCodeSplitter';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';
import { BalancedChunker } from '../BalancedChunker';
import { ParseResult, ParserLanguage } from '../../core/parse/TreeSitterCoreService';

// Mock TreeSitterService
class MockTreeSitterService implements Partial<TreeSitterService> {
  async parseCode(code: string, language: string): Promise<ParseResult> {
    // 简单模拟解析结果
    if (language === 'javascript') {
      return {
        success: true,
        ast: { type: 'program', children: [], startIndex: 0, endIndex: code.length } as any,
        language: { name: 'JavaScript', parser: null, fileExtensions: ['.js'], supported: true } as ParserLanguage,
        parseTime: 0,
      };
    }
    return {
      success: false,
      ast: { type: 'error', children: [], startIndex: 0, endIndex: 0 } as any,
      language: { name: language, parser: null, fileExtensions: [], supported: false } as ParserLanguage,
      parseTime: 0,
    };
  }

  extractFunctions(ast: any) {
    return [];
  }

  extractClasses(ast: any) {
    return [];
  }

  extractImports(ast: any, sourceCode?: string) {
    return [];
  }

  getNodeText(node: any, content: string) {
    return content;
  }

  getNodeLocation(node: any) {
    return {
      startLine: 1,
      endLine: 1,
      startColumn: 0,
      endColumn: 0
    };
  }

  getNodeName(node: any) {
    return 'test';
  }

  isLanguageSupported(language: string): boolean {
    return language === 'javascript';
  }
}

describe('ASTCodeSplitter', () => {
  let astCodeSplitter: ASTCodeSplitter;
  let mockTreeSitterService: MockTreeSitterService;
  let mockLoggerService: LoggerService;

  beforeEach(() => {
    mockTreeSitterService = new MockTreeSitterService() as any;
    mockLoggerService = new LoggerService();
    astCodeSplitter = new ASTCodeSplitter(
      mockTreeSitterService as any,
      mockLoggerService
    );
  });

  describe('split method', () => {
    it('should return empty array for empty code', async () => {
      const result = await astCodeSplitter.split('', 'javascript');
      expect(result).toEqual([]);
    });

    it('should return empty array for whitespace-only code', async () => {
      const result = await astCodeSplitter.split('   \n \t  \n  ', 'javascript');
      expect(result).toEqual([]);
    });

    it('should handle simple JavaScript code', async () => {
      const code = `function hello() {
  console.log('Hello, world!');
}`;
      const result = await astCodeSplitter.split(code, 'javascript');

      // 由于我们的mock实现简单，这里主要测试是否正常运行
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle code that fails parsing', async () => {
      const code = 'invalid javascript code {';
      const result = await astCodeSplitter.split(code, 'javascript');

      // 在解析失败的情况下，应该使用后备策略
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('setChunkSize method', () => {
    it('should update chunk size', () => {
      const newSize = 2000;
      astCodeSplitter.setChunkSize(newSize);
      // 这里我们无法直接访问私有属性，但方法应该成功执行
      expect(() => astCodeSplitter.setChunkSize(newSize)).not.toThrow();
    });
  });

  describe('setChunkOverlap method', () => {
    it('should update chunk overlap', () => {
      const newOverlap = 150;
      astCodeSplitter.setChunkOverlap(newOverlap);
      // 这里我们无法直接访问私有属性，但方法应该成功执行
      expect(() => astCodeSplitter.setChunkOverlap(newOverlap)).not.toThrow();
    });
  });
});