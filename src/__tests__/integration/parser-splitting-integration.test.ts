import { TreeSitterService } from '../../service/parser/core/parse/TreeSitterService';
import { ASTCodeSplitter } from '../../service/parser/splitting/ASTCodeSplitter';
import { Splitter } from '../../service/parser/splitting/Splitter';
import { TreeSitterCoreService } from '../../service/parser/core/parse/TreeSitterCoreService';
import { TYPES } from '../../types';
import { Container } from 'inversify';

describe('Parser and Splitting Module Integration Tests', () => {
 let container: any;
  let treeSitterService: TreeSitterService;
  let astCodeSplitter: ASTCodeSplitter;

  beforeEach(() => {
    // Create a new container for testing
    container = new Container();
    
    // Create a mock TreeSitterCoreService
    const mockTreeSitterCoreService = {
      getSupportedLanguages: jest.fn().mockReturnValue([
        { name: 'javascript', extensions: ['.js', '.jsx'] },
        { name: 'python', extensions: ['.py'] },
        { name: 'java', extensions: ['.java'] },
      ]),
      detectLanguage: jest.fn().mockImplementation((filePath: string) => {
        const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
        const languageMap: Record<string, string> = {
          '.js': 'javascript',
          '.jsx': 'javascript',
          '.py': 'python',
          '.java': 'java',
        };

        const languageName = languageMap[ext];
        return languageName ? { name: languageName, extensions: [ext] } : null;
      }),
      parseCode: jest.fn().mockImplementation((code: string, language: string) => {
        return Promise.resolve({
          ast: {
            type: 'program',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: code.split('\n').length - 1, column: 0 },
            startIndex: 0,
            endIndex: code.length,
            children: [],
          },
          language: { name: language, supported: true },
          parseTime: 10,
          success: true,
          error: null,
        });
      }),
      parseFile: jest.fn().mockImplementation((filePath: string, content: string) => {
        const detectedLanguage = mockTreeSitterCoreService.detectLanguage(filePath);
        return Promise.resolve({
          ast: {
            type: 'program',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: content.split('\n').length - 1, column: 0 },
            startIndex: 0,
            endIndex: content.length,
            children: [],
          },
          language: { name: detectedLanguage?.name || 'javascript', supported: true },
          parseTime: 10,
          success: true,
          error: null,
        });
      }),
      extractFunctions: jest.fn().mockReturnValue([]),
      extractClasses: jest.fn().mockReturnValue([]),
      extractImports: jest.fn().mockReturnValue([]),
      extractExports: jest.fn().mockReturnValue([]),
      isInitialized: jest.fn().mockReturnValue(true),
      getNodeText: jest.fn().mockImplementation((node: any, sourceCode: string) => {
        return sourceCode.substring(node.startIndex, node.endIndex);
      }),
      getNodeLocation: jest.fn().mockReturnValue({
        startLine: 1,
        endLine: 10,
        startColumn: 0,
        endColumn: 0,
      }),
      findNodeByType: jest.fn().mockReturnValue([]),
      queryTree: jest.fn().mockReturnValue([]),
    };

    // Bind the mock service
    container.bind(TYPES.TreeSitterCoreService).toConstantValue(mockTreeSitterCoreService);
    container.bind(TYPES.TreeSitterService).to(TreeSitterService);
    container.bind(TYPES.ASTCodeSplitter).to(ASTCodeSplitter);

    treeSitterService = container.get(TYPES.TreeSitterService);
    astCodeSplitter = container.get(TYPES.ASTCodeSplitter);
  });

  describe('Basic Integration Tests', () => {
    test('should successfully integrate TreeSitterService with ASTCodeSplitter', async () => {
      expect(treeSitterService).toBeDefined();
      expect(astCodeSplitter).toBeDefined();
      
      const code = `
function exampleFunction() {
  console.log("This is a test function");
  return true;
}

class ExampleClass {
  method() {
    console.log("This is a test method");
  }
}
      `;

      // Test the integration
      const chunks = await astCodeSplitter.split(code, 'javascript', '/test/example.js');
      
      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
      
      // Verify that each chunk has the required properties
      chunks.forEach(chunk => {
        expect(chunk.content).toBeDefined();
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.metadata).toBeDefined();
        expect(chunk.metadata.startLine).toBeDefined();
        expect(chunk.metadata.endLine).toBeDefined();
        expect(chunk.metadata.language).toBe('javascript');
        expect(chunk.metadata.filePath).toBe('/test/example.js');
      });
    });

    test('should handle different chunk sizes correctly', async () => {
      const code = `
function example() {
  console.log("test");
}
      `;

      // Change chunk size and test
      astCodeSplitter.setChunkSize(1000);
      const chunks = await astCodeSplitter.split(code, 'javascript', '/test/example.js');
      
      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
    });

    test('should handle different overlap sizes correctly', async () => {
      const code = `
function example() {
 console.log("test");
}
      `;

      // Change overlap size and test
      astCodeSplitter.setChunkOverlap(100);
      const chunks = await astCodeSplitter.split(code, 'javascript', '/test/example.js');
      
      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
    });
  });

  describe('Language Support Tests', () => {
    test('should handle JavaScript code correctly', async () => {
      const jsCode = `
function exampleFunction() {
  console.log("This is a test function");
  return true;
}
      `;

      const chunks = await astCodeSplitter.split(jsCode, 'javascript', '/test/example.js');
      
      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
      
      chunks.forEach(chunk => {
        expect(chunk.metadata.language).toBe('javascript');
      });
    });

    test('should handle Python code correctly', async () => {
      const pythonCode = `
def example_function():
    print("This is a test function")
    return True
      `;

      const chunks = await astCodeSplitter.split(pythonCode, 'python', '/test/example.py');
      
      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
      
      chunks.forEach(chunk => {
        expect(chunk.metadata.language).toBe('python');
      });
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle empty code input', async () => {
      const emptyCode = '';
      
      const chunks = await astCodeSplitter.split(emptyCode, 'javascript', '/test/empty.js');
      
      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBe(0);
    });

    test('should handle very small code input', async () => {
      const tinyCode = 'console.log("Hello");';
      
      const chunks = await astCodeSplitter.split(tinyCode, 'javascript', '/test/tiny.js');
      
      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
      
      chunks.forEach(chunk => {
        expect(chunk.content).toBe(tinyCode);
        expect(chunk.metadata.language).toBe('javascript');
      });
    });

    test('should handle unsupported language with fallback', async () => {
      const code = `// This is code in an unsupported language`;
      
      // Mock to simulate unsupported language
      jest.spyOn(treeSitterService['coreService'], 'parseCode').mockResolvedValue({
        ast: null,
        language: { name: 'unsupported', supported: false },
        parseTime: 5,
        success: false,
        error: 'Language not supported'
      } as any);

      const chunks = await astCodeSplitter.split(code, 'unsupported', '/test/unsupported.lang');
      
      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
      // Should still return chunks using the fallback splitter
      expect(chunks.length).toBeGreaterThan(0);
      
      chunks.forEach(chunk => {
        expect(chunk.metadata.language).toBe('unknown'); // Fallback language
      });
    });
  });

  describe('Splitter Interface Compliance', () => {
    test('should implement Splitter interface correctly', () => {
      expect(astCodeSplitter.split).toBeDefined();
      expect(astCodeSplitter.setChunkSize).toBeDefined();
      expect(astCodeSplitter.setChunkOverlap).toBeDefined();
      
      // Verify method signatures
      expect(typeof astCodeSplitter.split).toBe('function');
      expect(typeof astCodeSplitter.setChunkSize).toBe('function');
      expect(typeof astCodeSplitter.setChunkOverlap).toBe('function');
    });

    test('should return CodeChunk objects with proper structure', async () => {
      const code = 'function test() { return "hello"; }';
      
      const chunks = await astCodeSplitter.split(code, 'javascript', '/test/test.js');
      
      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
      
      chunks.forEach(chunk => {
        // Check that chunk has content
        expect(chunk.content).toBeDefined();
        expect(typeof chunk.content).toBe('string');
        expect(chunk.content.length).toBeGreaterThan(0);
        
        // Check that chunk has metadata
        expect(chunk.metadata).toBeDefined();
        expect(typeof chunk.metadata).toBe('object');
        
        // Check metadata properties
        expect(chunk.metadata.startLine).toBeDefined();
        expect(typeof chunk.metadata.startLine).toBe('number');
        expect(chunk.metadata.endLine).toBeDefined();
        expect(typeof chunk.metadata.endLine).toBe('number');
        expect(chunk.metadata.language).toBeDefined();
        expect(typeof chunk.metadata.language).toBe('string');
        expect(chunk.metadata.filePath).toBe('/test/test.js');
      });
    });
  });
});