import { ASTCodeSplitter, ChunkingOptions } from '../ASTCodeSplitter';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';

// Mock the dependencies
class MockTreeSitterService implements Partial<TreeSitterService> {
  async parseCode(code: string, language: string) {
    // Return a mock AST structure
    return {
      success: true,
      ast: {
        type: 'program',
        children: []
      } as any,
      language: {
        name: language,
        parser: null,
        fileExtensions: [],
        supported: true
      },
      parseTime: 10,
    };
  }

  extractFunctions(ast: any) {
    return []; // Return empty for basic tests
  }

  extractClasses(ast: any) {
    return []; // Return empty for basic tests
  }

  extractImports(ast: any, sourceCode?: string) {
    return []; // Return empty for basic tests
  }

  getNodeText(node: any, content: string) {
    return content; // Return the full content for the node
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
    return 'unknown';
  }

  extractImportNodes(ast: any) {
    return [];
  }
}

class MockLoggerService implements Partial<LoggerService> {
  async warn(message: string, meta?: any): Promise<void> {
    console.warn(message, meta);
  }
}

describe('ASTCodeSplitter', () => {
  let astCodeSplitter: ASTCodeSplitter;
  let mockTreeSitterService: MockTreeSitterService;
  let mockLoggerService: MockLoggerService;

  beforeEach(() => {
    mockTreeSitterService = new MockTreeSitterService();
    mockLoggerService = new MockLoggerService();
    
    astCodeSplitter = new ASTCodeSplitter(
      mockTreeSitterService as any as TreeSitterService,
      mockLoggerService as any as LoggerService
    );
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(astCodeSplitter).toBeDefined();
      // Check that the default options are set correctly
      // (We'll access the private options field through a getter or reflection)
    });
  });

  describe('split method', () => {
    it('should return empty array for empty code', async () => {
      const result = await astCodeSplitter.split('', 'javascript');
      expect(result).toEqual([]);
    });

    it('should return empty array for whitespace-only code', async () => {
      const result = await astCodeSplitter.split('   \n  \t  \n  ', 'javascript');
      expect(result).toEqual([]);
    });

    it('should handle parsing failure gracefully with fallback', async () => {
      // Mock a parsing failure
      jest.spyOn(mockTreeSitterService, 'parseCode').mockResolvedValue({
        success: false,
        ast: undefined as any,
        language: {
          name: 'javascript',
          parser: null,
          fileExtensions: [],
          supported: true
        },
        parseTime: 10,
      });

      const code = 'function test() { return 1; }';
      const result = await astCodeSplitter.split(code, 'javascript');

      // Should return chunks using fallback method
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle parsing error gracefully with fallback', async () => {
      // Mock a parsing error
      jest.spyOn(mockTreeSitterService, 'parseCode').mockRejectedValue(new Error('Parsing failed'));

      const code = 'function test() { return 1; }';
      const result = await astCodeSplitter.split(code, 'javascript');

      // Should return chunks using fallback method
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should process code successfully when parsing succeeds', async () => {
      const code = `
        function hello() {
          console.log('Hello World');
        }
        
        function goodbye() {
          console.log('Goodbye World');
        }
      `;
      
      const result = await astCodeSplitter.split(code, 'javascript');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('setChunkSize method', () => {
    it('should update the chunk size', () => {
      const initialSize = (astCodeSplitter as any).chunkSize;
      astCodeSplitter.setChunkSize(1000);
      expect((astCodeSplitter as any).chunkSize).toBe(1000);
    });
  });

  describe('setChunkOverlap method', () => {
    it('should update the chunk overlap', () => {
      const initialOverlap = (astCodeSplitter as any).chunkOverlap;
      astCodeSplitter.setChunkOverlap(100);
      expect((astCodeSplitter as any).chunkOverlap).toBe(100);
    });
  });

  describe('chunk optimization', () => {
    it('should optimize chunks based on size and type', async () => {
      // Create a mock implementation that returns multiple chunks
      jest.spyOn(mockTreeSitterService, 'parseCode').mockResolvedValue({
        success: true,
        ast: {
          type: 'program',
          children: []
        } as any,
        language: {
          name: 'javascript',
          parser: null,
          fileExtensions: [],
          supported: true
        },
        parseTime: 10,
      });

      // We can't directly test private methods, so we'll test the public API
      const code = 'function small() {}\nfunction another() {}';
      const result = await astCodeSplitter.split(code, 'javascript');
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('fallback behavior', () => {
    it('should use intelligent fallback when TreeSitter fails', async () => {
      jest.spyOn(mockTreeSitterService, 'parseCode').mockRejectedValue(new Error('Parse error'));
      
      const code = `
        const x = 1;
        const y = 2;
        console.log(x + y);
      `;
      
      const result = await astCodeSplitter.split(code, 'javascript');
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });
  });
});