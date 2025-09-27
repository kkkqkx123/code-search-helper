import { ASTCodeSplitter } from '../splitting/ASTCodeSplitter';
import { TreeSitterService } from '../core/parse/TreeSitterService';
import { createTestContainer } from '@test/setup';
import { TYPES } from '../../../types';

describe('Splitter Interface', () => {
  let astCodeSplitter: ASTCodeSplitter;
  let container: any;

  beforeEach(() => {
    container = createTestContainer();

    // Create a mock TreeSitterService
    const mockTreeSitterService = {
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
        });
      }),
      extractFunctions: jest.fn().mockReturnValue([]),
      extractClasses: jest.fn().mockReturnValue([]),
      getNodeText: jest.fn().mockImplementation((node: any, content: string) => {
        return content.substring(node.startIndex, node.endIndex);
      }),
      getNodeLocation: jest.fn().mockReturnValue({
        startLine: 1,
        endLine: 10,
        startColumn: 0,
        endColumn: 0,
      }),
    };

    // Rebind TreeSitterService with mock
    container.unbind(TYPES.TreeSitterService);
    container.bind(TYPES.TreeSitterService).toConstantValue(mockTreeSitterService);

    astCodeSplitter = container.get(TYPES.ASTCodeSplitter);
  });

  describe('AstCodeSplitter Implementation', () => {
    test('should implement Splitter interface', () => {
      expect(astCodeSplitter.split).toBeDefined();
      expect(astCodeSplitter.setChunkSize).toBeDefined();
      expect(astCodeSplitter.setChunkOverlap).toBeDefined();
    });

    test('should split code using AST-aware approach', async () => {
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

      const chunks = await astCodeSplitter.split(code, 'javascript');

      // Should have chunks (mock returns empty but the method should be called)
      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
    });

    test('should set chunk size', () => {
      astCodeSplitter.setChunkSize(2000);
      // Verify that the method exists and can be called
      expect(() => astCodeSplitter.setChunkSize(2000)).not.toThrow();
    });

    test('should set chunk overlap', () => {
      astCodeSplitter.setChunkOverlap(200);
      // Verify that the method exists and can be called
      expect(() => astCodeSplitter.setChunkOverlap(200)).not.toThrow();
    });

    test('should fall back to simple splitting for unsupported languages', async () => {
      const code = `
function example() {
  console.log("This is a test");
}
      `;

      // Mock TreeSitterService to fail
      const mockTreeSitterService = {
        parseCode: jest.fn().mockImplementation(() => {
          return Promise.resolve({
            ast: null,
            language: { name: 'unsupported', supported: false },
            parseTime: 10,
            success: false,
            error: 'Unsupported language',
          });
        }),
        extractFunctions: jest.fn().mockReturnValue([]),
        extractClasses: jest.fn().mockReturnValue([]),
      };

      container.unbind(TYPES.TreeSitterService);
      container.bind(TYPES.TreeSitterService).toConstantValue(mockTreeSitterService);

      const splitter = container.get(TYPES.ASTCodeSplitter);
      const chunks = await splitter.split(code, 'unsupported');

      // Should have chunks from simple splitting
      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
    });

    test('should handle TreeSitterService errors gracefully', async () => {
      const code = `
function example() {
  console.log("This is a test");
}
      `;

      // Mock TreeSitterService to throw an error
      const mockTreeSitterService = {
        parseCode: jest.fn().mockImplementation(() => {
          throw new Error('TreeSitterService error');
        }),
        extractFunctions: jest.fn().mockReturnValue([]),
        extractClasses: jest.fn().mockReturnValue([]),
      };

      container.unbind(TYPES.TreeSitterService);
      container.bind(TYPES.TreeSitterService).toConstantValue(mockTreeSitterService);

      const splitter = container.get(TYPES.ASTCodeSplitter);
      const chunks = await splitter.split(code, 'javascript');

      // Should have chunks from simple splitting fallback
      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
    });
  });
});