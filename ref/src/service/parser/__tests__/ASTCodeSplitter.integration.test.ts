import { ASTCodeParser } from '../splitting/ASTCodeParser';
import { ASTCodeSplitter } from '../splitting/ASTCodeSplitter';
import { ChunkRefinementService } from '../splitting/ChunkRefinementService';
import { TreeSitterService } from '../core/parse/TreeSitterService';
import { createTestContainer } from '@test/setup';
import { TYPES } from '../../../types';

describe('AST Code Splitting Integration', () => {
  let astCodeSplitter: ASTCodeSplitter;
  let astCodeParser: ASTCodeParser;
  let chunkRefinementService: ChunkRefinementService;
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
      parseFile: jest.fn().mockImplementation((filePath: string, content: string) => {
        // Detect language based on file extension like the real implementation
        const detectLanguage = (filePath: string) => {
          const ext = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
          const languageMap: Record<string, string> = {
            '.js': 'JavaScript',
            '.jsx': 'JavaScript',
            '.ts': 'TypeScript',
            '.tsx': 'TypeScript',
            '.py': 'Python',
            '.java': 'Java',
            '.go': 'Go',
            '.rs': 'Rust',
            '.cpp': 'C++',
            '.cc': 'C++',
            '.cxx': 'C++',
            '.c++': 'C++',
            '.h': 'C',
            '.hpp': 'C++',
            '.c': 'C',
            '.cs': 'CSharp',
            '.scala': 'Scala',
          };

          return languageMap[ext] || 'JavaScript';
        };

        const detectedLanguage = detectLanguage(filePath);

        return Promise.resolve({
          ast: {
            type: 'program',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: content.split('\n').length - 1, column: 0 },
            startIndex: 0,
            endIndex: content.length,
            children: [],
          },
          language: { name: detectedLanguage, supported: true },
          parseTime: 10,
          success: true,
        });
      }),
      extractFunctions: jest.fn().mockReturnValue([]),
      extractClasses: jest.fn().mockReturnValue([]),
      extractSnippets: jest.fn().mockReturnValue([]),
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
    astCodeParser = container.get(TYPES.ASTCodeParser);
    chunkRefinementService = container.get(TYPES.ChunkRefinementService);
  });

  describe('End-to-End Code Splitting', () => {
    test('should split code using AstCodeSplitter and process with ASTCodeParser', async () => {
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

// Some additional code to make it longer
const variable = "test";
if (variable) {
  console.log("Variable exists");
}
      `;

      // Test AstCodeSplitter
      const splitterChunks = await astCodeSplitter.split(code, 'javascript', '/test/example.js');
      expect(splitterChunks).toBeDefined();
      expect(Array.isArray(splitterChunks)).toBe(true);

      // Test ASTCodeParser with overlap
      const filePath = '/test/example.js';
      const parsedFile = await astCodeParser.parseFile(filePath, code, {
        addOverlap: true,
        overlapSize: 50,
      });

      expect(parsedFile).toBeDefined();
      expect(parsedFile.chunks.length).toBeGreaterThan(0);
      expect(parsedFile.language).toBe('javascript');
    });

    test('should handle C# code with new language support', async () => {
      const code = `
using System;

class Program
{
    static void Main()
    {
        Console.WriteLine("Hello, World!");
    }
}
      `;

      // Test AstCodeSplitter with C#
      const splitterChunks = await astCodeSplitter.split(code, 'csharp', '/test/example.cs');
      expect(splitterChunks).toBeDefined();
      expect(Array.isArray(splitterChunks)).toBe(true);

      // Test ASTCodeParser with C#
      const filePath = '/test/example.cs';
      const parsedFile = await astCodeParser.parseFile(filePath, code);

      expect(parsedFile).toBeDefined();
      expect(parsedFile.chunks.length).toBeGreaterThan(0);
      expect(parsedFile.language).toBe('csharp');
    });

    test('should handle Scala code with new language support', async () => {
      const code = `
object HelloWorld {
  def main(args: Array[String]): Unit = {
    println("Hello, World!")
  }
}
      `;

      // Test AstCodeSplitter with Scala
      const splitterChunks = await astCodeSplitter.split(code, 'scala', '/test/example.scala');
      expect(splitterChunks).toBeDefined();
      expect(Array.isArray(splitterChunks)).toBe(true);

      // Test ASTCodeParser with Scala
      const filePath = '/test/example.scala';
      const parsedFile = await astCodeParser.parseFile(filePath, code);

      expect(parsedFile).toBeDefined();
      expect(parsedFile.chunks.length).toBeGreaterThan(0);
      expect(parsedFile.language).toBe('scala');
    });
  });

  describe('Chunk Refinement Integration', () => {
    test('should refine chunks with overlap and splitting', () => {
      const chunks = [
        {
          id: 'chunk1',
          content: 'line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10',
          startLine: 1,
          endLine: 10,
          startByte: 0,
          endByte: 60,
          type: 'generic',
          imports: [],
          exports: [],
          metadata: {
            lineCount: 10,
            complexity: 1,
          },
        },
        {
          id: 'chunk2',
          content: 'line11\nline12\nline13\nline14\nline15',
          startLine: 11,
          endLine: 15,
          startByte: 61,
          endByte: 90,
          type: 'generic',
          imports: [],
          exports: [],
          metadata: {
            lineCount: 5,
            complexity: 1,
          },
        },
      ];

      const options = {
        maxChunkSize: 30,
        overlapSize: 2,
        addOverlap: true,
      };

      const refinedChunks = chunkRefinementService.refineChunks(chunks, options);

      expect(refinedChunks).toBeDefined();
      expect(Array.isArray(refinedChunks)).toBe(true);
    });
  });

  describe('Backward Compatibility', () => {
    test('should maintain backward compatibility with existing functionality', async () => {
      const code = `
function example() {
  console.log("This is a test");
}
      `;

      // Test that existing functionality still works
      const filePath = '/test/example.js';
      const parsedFile = await astCodeParser.parseFile(filePath, code);

      expect(parsedFile).toBeDefined();
      expect(parsedFile.chunks.length).toBeGreaterThan(0);
      expect(parsedFile.language).toBe('javascript');

      // Verify metadata is still populated
      expect(parsedFile.metadata).toBeDefined();
      expect(parsedFile.metadata.linesOfCode).toBeGreaterThan(0);
    });
  });
});