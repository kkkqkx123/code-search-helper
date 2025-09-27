import { TreeSitterService } from '../core/parse/TreeSitterService';
import { performance } from 'perf_hooks';
import { createTestContainer } from '@test/setup';
import { TYPES } from '../../../types';

// Mock tree-sitter for performance testing
jest.mock('tree-sitter', () => {
  return {
    default: jest.fn().mockImplementation(() => {
      return {
        parse: jest.fn().mockImplementation((code: string) => {
          // Create a mock AST structure for testing
          return {
            rootNode: createMockAST(code),
          };
        }),
        setLanguage: jest.fn(),
      };
    }),
  };
});

// Mock tree-sitter language parsers
jest.mock('tree-sitter-typescript', () => ({
  name: 'typescript',
}));
jest.mock('tree-sitter-javascript', () => ({
  name: 'javascript',
}));
jest.mock('tree-sitter-python', () => ({
  name: 'python',
}));
jest.mock('tree-sitter-java', () => ({
  name: 'java',
}));
jest.mock('tree-sitter-go', () => ({
  name: 'go',
}));
jest.mock('tree-sitter-rust', () => ({
  name: 'rust',
}));
jest.mock('tree-sitter-cpp', () => ({
  name: 'cpp',
}));

// Helper function to create mock AST nodes
function createMockSyntaxNode(
  type: string,
  text: string,
  startPosition: { row: number; column: number } = { row: 0, column: 0 },
  endPosition: { row: number; column: number } = { row: 0, column: 0 },
  startIndex: number = 0,
  endIndex: number = text.length,
  children: any[] = [],
  parent: any = null
): any {
  const node = {
    type,
    startPosition,
    endPosition,
    startIndex,
    endIndex,
    children,
    parent,
    childForFieldName: jest.fn().mockReturnValue(null),
  };

  // Set parent relationship for children
  children.forEach(child => {
    child.parent = node;
  });

  return node;
}

// Helper function to create mock AST with specified complexity
function createMockAST(code: string): any {
  const lines = code.split('\n');
  const nodes: any[] = [];

  // Create nodes based on code patterns
  lines.forEach((line, index) => {
    if (line.includes('if') || line.includes('for') || line.includes('while')) {
      nodes.push(
        createMockSyntaxNode(
          line.includes('if')
            ? 'if_statement'
            : line.includes('for')
              ? 'for_statement'
              : 'while_statement',
          line,
          { row: index, column: 0 },
          { row: index, column: line.length },
          code.indexOf(line),
          code.indexOf(line) + line.length,
          []
        )
      );
    }

    if (line.includes('try') || line.includes('catch')) {
      nodes.push(
        createMockSyntaxNode(
          line.includes('try') ? 'try_statement' : 'catch_clause',
          line,
          { row: index, column: 0 },
          { row: index, column: line.length },
          code.indexOf(line),
          code.indexOf(line) + line.length,
          []
        )
      );
    }

    if (line.includes('function') || line.includes('=>')) {
      // Find the complete function block (multiple lines)
      const functionStartIndex = code.indexOf(line);
      let functionEndIndex = functionStartIndex + line.length;
      let functionEndLine = index;

      // Look for the closing brace of the function
      let braceCount = 0;
      let currentIndex = functionStartIndex;

      while (currentIndex < code.length && braceCount >= 0) {
        if (code[currentIndex] === '{') {
          braceCount++;
        } else if (code[currentIndex] === '}') {
          braceCount--;
        }
        currentIndex++;
      }

      if (braceCount < 0) {
        // Found matching closing brace
        functionEndIndex = currentIndex;
        functionEndLine =
          index + code.substring(functionStartIndex, functionEndIndex).split('\n').length - 1;

        const functionContent = code.substring(functionStartIndex, functionEndIndex);

        nodes.push(
          createMockSyntaxNode(
            'function_definition',
            functionContent,
            { row: index, column: 0 },
            { row: functionEndLine, column: code.split('\n')[functionEndLine].length },
            functionStartIndex,
            functionEndIndex,
            []
          )
        );
      } else {
        // Fallback: single line function
        nodes.push(
          createMockSyntaxNode(
            'function_definition',
            line,
            { row: index, column: 0 },
            { row: index, column: line.length },
            code.indexOf(line),
            code.indexOf(line) + line.length,
            []
          )
        );
      }
    }

    // Create comment nodes for comment markers
    if (line.includes('@snippet') || line.includes('@code') || line.includes('@example')) {
      const commentNode = createMockSyntaxNode(
        'comment',
        line,
        { row: index, column: 0 },
        { row: index, column: line.length },
        code.indexOf(line),
        code.indexOf(line) + line.length,
        []
      );

      // Mock the childForFieldName method for comment nodes
      commentNode.childForFieldName = jest.fn().mockReturnValue(null);
      nodes.push(commentNode);
    }
  });

  // Create root node with all the created nodes as children
  const rootNode = createMockSyntaxNode(
    'program',
    code,
    { row: 0, column: 0 },
    { row: lines.length - 1, column: lines[lines.length - 1].length },
    0,
    code.length,
    nodes,
    null
  );

  return rootNode;
}

// Helper function to generate test code with specified complexity
function generateTestCode(lines: number, complexity: number): string {
  let code = '';

  for (let i = 0; i < lines; i++) {
    if (i % 10 === 0) {
      // Add a function definition
      code += `function testFunction${i}() {\n`;

      // Add complexity based on the parameter
      for (let j = 0; j < complexity; j++) {
        if (j % 3 === 0) {
          code += `  if (condition${j}) {\n`;
          code += `    console.log("condition${j} is true");\n`;
          code += `  }\n`;
        } else if (j % 3 === 1) {
          code += `  for (let k = 0; k < 10; k++) {\n`;
          code += `    console.log("loop iteration", k);\n`;
          code += `  }\n`;
        } else {
          code += `  try {\n`;
          code += `    riskyOperation${j}();\n`;
          code += `  } catch (error) {\n`;
          code += `    console.error(error);\n`;
          code += `  }\n`;
        }
      }

      code += `}\n\n`;
    } else if (i % 10 === 5) {
      // Add a comment marker for snippet extraction
      code += `// @snippet: Example snippet ${i}\n`;
      code += `function snippetFunction${i}() {\n`;
      code += `  console.log("This is a snippet ${i}");\n`;
      code += `  return true;\n`;
      code += `}\n\n`;
    } else {
      // Add a regular line of code
      code += `const variable${i} = "value${i}";\n`;
    }
  }

  return code;
}

describe('TreeSitterService Snippet Extraction Performance', () => {
  let treeSitterService: TreeSitterService;
  let container: any;

  beforeEach(() => {
    container = createTestContainer();
    treeSitterService = container.get(TYPES.TreeSitterService);
  });

  describe('Performance benchmarks', () => {
    test('should handle small codebases efficiently', () => {
      const code = generateTestCode(100, 2); // 100 lines, low complexity
      const mockAST = createMockAST(code);

      const startTime = performance.now();
      const snippets = treeSitterService.extractSnippets(mockAST, code);
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      console.log(
        `Small codebase (100 lines): ${processingTime.toFixed(2)}ms, ${snippets.length} snippets extracted`
      );

      // Should process small codebases in under 100ms (adjusted for enhanced validation)
      expect(processingTime).toBeLessThan(100);
      expect(snippets.length).toBeGreaterThan(0);
    });

    test('should handle medium codebases efficiently', () => {
      const code = generateTestCode(1000, 3); // 1000 lines, medium complexity
      const mockAST = createMockAST(code);

      const startTime = performance.now();
      const snippets = treeSitterService.extractSnippets(mockAST, code);
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      console.log(
        `Medium codebase (1000 lines): ${processingTime.toFixed(2)}ms, ${snippets.length} snippets extracted`
      );

      // Should process medium codebases in under 500ms (adjusted for enhanced validation)
      expect(processingTime).toBeLessThan(500);
      expect(snippets.length).toBeGreaterThan(0);
    });

    test('should handle large codebases efficiently', () => {
      const code = generateTestCode(5000, 4); // 5000 lines, high complexity
      const mockAST = createMockAST(code);

      const startTime = performance.now();
      const snippets = treeSitterService.extractSnippets(mockAST, code);
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      console.log(
        `Large codebase (5000 lines): ${processingTime.toFixed(2)}ms, ${snippets.length} snippets extracted`
      );

      // Should process large codebases in under 2000ms (adjusted for enhanced validation)
      expect(processingTime).toBeLessThan(2000);
      expect(snippets.length).toBeGreaterThan(0);
    });

    test('should handle very large codebases efficiently', () => {
      const code = generateTestCode(10000, 5); // 10000 lines, very high complexity
      const mockAST = createMockAST(code);

      const startTime = performance.now();
      const snippets = treeSitterService.extractSnippets(mockAST, code);
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      console.log(
        `Very large codebase (10000 lines): ${processingTime.toFixed(2)}ms, ${snippets.length} snippets extracted`
      );

      // Should process very large codebases in under 3000ms (adjusted for enhanced validation)
      expect(processingTime).toBeLessThan(3000);
      expect(snippets.length).toBeGreaterThan(0);
    });

    test('should maintain linear time complexity', () => {
      const sizes = [100, 500, 1000, 2000, 5000];
      const times: number[] = [];

      sizes.forEach(size => {
        const code = generateTestCode(size, 3);
        const mockAST = createMockAST(code);

        const startTime = performance.now();
        treeSitterService.extractSnippets(mockAST, code);
        const endTime = performance.now();

        times.push(endTime - startTime);
      });

      // Calculate the ratio between consecutive measurements
      const ratios = [];
      for (let i = 1; i < times.length; i++) {
        const sizeRatio = sizes[i] / sizes[i - 1];
        const timeRatio = times[i] / times[i - 1];
        ratios.push(timeRatio / sizeRatio);
      }

      // The average ratio should be close to 1 for linear time complexity
      const averageRatio = ratios.reduce((sum, ratio) => sum + ratio, 0) / ratios.length;

      console.log('Time complexity ratios:', ratios);
      console.log('Average ratio:', averageRatio);

      // Allow some deviation, but should be reasonably close to linear
      expect(averageRatio).toBeLessThan(1.7);
      expect(averageRatio).toBeGreaterThan(0.5);
    });

    test('should not excessively increase memory usage', () => {
      // This is a simplified memory usage test
      // In a real environment, you would use more sophisticated memory profiling tools

      const initialMemory = process.memoryUsage().heapUsed;

      // Process a large codebase
      const code = generateTestCode(10000, 5);
      const mockAST = createMockAST(code);

      treeSitterService.extractSnippets(mockAST, code);

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Memory increase should be reasonable (less than 120MB for this test with enhanced validation)
      expect(memoryIncrease).toBeLessThan(120 * 1024 * 1024);
    });

    test('should efficiently filter and deduplicate snippets', () => {
      // Create code with many duplicate snippets
      let code = '';
      for (let i = 0; i < 100; i++) {
        code += `function duplicateFunction() {\n`;
        code += `  if (condition) {\n`;
        code += `    console.log("duplicate");\n`;
        code += `  }\n`;
        code += `}\n\n`;
      }

      const mockAST = createMockAST(code);

      const startTime = performance.now();
      const snippets = treeSitterService.extractSnippets(mockAST, code);
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      console.log(
        `Deduplication test: ${processingTime.toFixed(2)}ms, ${snippets.length} unique snippets from 100 duplicates`
      );

      // Should have only one unique snippet despite 100 duplicates
      expect(snippets.length).toBe(1);

      // Should process quickly despite many duplicates
      expect(processingTime).toBeLessThan(100);
    });

    test('should handle code with many comment markers efficiently', () => {
      let code = '';
      for (let i = 0; i < 100; i++) {
        code += `// @snippet: Marker ${i}\n`;
        code += `function snippet${i}() {\n`;
        code += `  console.log("snippet ${i}");\n`;
        code += `  return ${i};\n`;
        code += `}\n\n`;
      }

      const mockAST = createMockAST(code);

      const startTime = performance.now();
      const snippets = treeSitterService
        .extractSnippets(mockAST, code)
        .filter(snippet => snippet.snippetMetadata.snippetType === 'comment_marked');
      const endTime = performance.now();

      const processingTime = endTime - startTime;

      console.log(
        `Comment markers test: ${processingTime.toFixed(2)}ms, ${snippets.length} snippets from 100 comment markers`
      );

      // Should extract all 100 snippets
      expect(snippets.length).toBe(100);

      // Should process quickly
      expect(processingTime).toBeLessThan(200);
    });
  });
});
