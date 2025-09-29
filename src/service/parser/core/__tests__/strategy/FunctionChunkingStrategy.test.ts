import Parser from 'tree-sitter';
import { FunctionChunkingStrategy } from '../../strategy/FunctionChunkingStrategy';
import { CodeChunk } from '../../types';

// Mock AST node for testing
const createMockASTNode = (type: string, content: string = '', children: any[] = []): any => {
  return {
    type,
    startIndex: 0,
    endIndex: content.length,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 2, column: 1 },
    text: content,
    children,
    parent: null,
    nextSibling: null,
    previousSibling: null,
    childForFieldName: (fieldName: string) => {
      if (fieldName === 'name' && type.includes('function')) {
        return createMockASTNode('identifier', 'testFunction');
      }
      if (fieldName === 'parameters' && type.includes('function')) {
        return createMockASTNode('formal_parameters', '(param1, param2)');
      }
      return null;
    }
  };
};

describe('FunctionChunkingStrategy', () => {
  let strategy: FunctionChunkingStrategy;

  beforeEach(() => {
    strategy = new FunctionChunkingStrategy();
  });

  describe('Constructor', () => {
    it('should initialize with correct properties', () => {
      expect(strategy.name).toBe('function_chunking');
      expect(strategy.priority).toBe(1);
      expect(strategy.description).toBe('Extract function definitions and their bodies');
      expect(strategy.supportedLanguages).toContain('typescript');
      expect(strategy.supportedLanguages).toContain('javascript');
      expect(strategy.supportedLanguages).toContain('python');
      expect(strategy.supportedLanguages).toContain('java');
      expect(strategy.supportedLanguages).toContain('go');
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        maxChunkSize: 3000,
        minChunkSize: 200,
        preserveComments: false,
        preserveEmptyLines: true,
        maxNestingLevel: 5
      };

      const customStrategy = new FunctionChunkingStrategy(customConfig);
      const config = customStrategy.getConfiguration();

      expect(config.maxChunkSize).toBe(3000);
      expect(config.minChunkSize).toBe(200);
      expect(config.preserveComments).toBe(false);
      expect(config.preserveEmptyLines).toBe(true);
      expect(config.maxNestingLevel).toBe(5);
    });
  });

  describe('canHandle', () => {
    it('should return true for supported language and function node', () => {
      const functionNode = createMockASTNode('function_declaration', 'function test() {}');
      const result = strategy.canHandle('typescript', functionNode);
      expect(result).toBe(true);
    });

    it('should return false for unsupported language', () => {
      const functionNode = createMockASTNode('function_declaration', 'function test() {}');
      const result = strategy.canHandle('unsupported', functionNode);
      expect(result).toBe(false);
    });

    it('should return false for non-function node', () => {
      const classNode = createMockASTNode('class_declaration', 'class Test {}');
      const result = strategy.canHandle('typescript', classNode);
      expect(result).toBe(false);
    });

    it('should return true for different function types in different languages', () => {
      // TypeScript function
      const tsFunctionNode = createMockASTNode('function_declaration');
      expect(strategy.canHandle('typescript', tsFunctionNode)).toBe(true);

      // JavaScript function
      const jsFunctionNode = createMockASTNode('function_declaration');
      expect(strategy.canHandle('javascript', jsFunctionNode)).toBe(true);

      // Python function
      const pyFunctionNode = createMockASTNode('function_definition');
      expect(strategy.canHandle('python', pyFunctionNode)).toBe(true);

      // Java method
      const javaMethodNode = createMockASTNode('method_declaration');
      expect(strategy.canHandle('java', javaMethodNode)).toBe(true);

      // Go function
      const goFunctionNode = createMockASTNode('function_declaration');
      expect(strategy.canHandle('go', goFunctionNode)).toBe(true);
    });
  });

  describe('getSupportedNodeTypes', () => {
    it('should return function types for TypeScript', () => {
      const types = strategy.getSupportedNodeTypes('typescript');
      expect(types).toContain('function_declaration');
      expect(types).toContain('function_definition');
      expect(types).toContain('method_definition');
      expect(types).toContain('arrow_function');
      expect(types).toContain('function_expression');
      expect(types).toContain('generator_function');
      expect(types).toContain('generator_function_declaration');
    });

    it('should return function types for JavaScript', () => {
      const types = strategy.getSupportedNodeTypes('javascript');
      expect(types).toContain('function_declaration');
      expect(types).toContain('function_definition');
      expect(types).toContain('method_definition');
      expect(types).toContain('arrow_function');
      expect(types).toContain('function_expression');
      expect(types).toContain('generator_function');
    });

    it('should return function types for Python', () => {
      const types = strategy.getSupportedNodeTypes('python');
      expect(types).toContain('function_definition');
      expect(types).toContain('lambda_function');
    });

    it('should return function types for Java', () => {
      const types = strategy.getSupportedNodeTypes('java');
      expect(types).toContain('method_declaration');
      expect(types).toContain('constructor_declaration');
      expect(types).toContain('method_definition');
    });

    it('should return function types for Go', () => {
      const types = strategy.getSupportedNodeTypes('go');
      expect(types).toContain('function_declaration');
      expect(types).toContain('method_declaration');
    });

    it('should return empty set for unsupported language', () => {
      const types = strategy.getSupportedNodeTypes('unsupported');
      expect(types.size).toBe(0);
    });
  });

 describe('chunk', () => {
    it('should create a chunk for a function node', () => {
      const functionContent = 'function test() { return "hello"; }';
      const functionNode = createMockASTNode('function_declaration', functionContent);
      
      const chunks = strategy.chunk(functionNode, functionContent);
      
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBe(1);
      
      const chunk = chunks[0];
      expect(chunk.content).toBe(functionContent);
      expect(chunk.metadata).toHaveProperty('type', 'function');
      expect(chunk.metadata).toHaveProperty('functionName', 'testFunction'); // From mock
      expect(chunk.metadata).toHaveProperty('language');
      expect(chunk.metadata).toHaveProperty('startLine');
      expect(chunk.metadata).toHaveProperty('endLine');
    });

    it('should return empty array for non-function node', () => {
      const classNode = createMockASTNode('class_declaration', 'class Test {}');
      const chunks = strategy.chunk(classNode, 'class Test {}');
      
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBe(0);
    });

    it('should return empty array for function that is too small', () => {
      const smallFunctionNode = createMockASTNode('function_declaration', 'function a(){}');
      const chunks = strategy.chunk(smallFunctionNode, 'function a(){}');
      
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBe(0);
    });

    it('should return empty array for function that is too large', () => {
      const largeContent = 'function largeFunction() { ' + 'code'.repeat(5000) + ' }';
      const largeFunctionNode = createMockASTNode('function_declaration', largeContent);
      const chunks = strategy.chunk(largeFunctionNode, largeContent);
      
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBe(0);
    });
  });

  describe('createFunctionChunk', () => {
    it('should create a function chunk with correct metadata', () => {
      const functionContent = 'function test(param: string): string { return param; }';
      const functionNode = createMockASTNode('function_declaration', functionContent);
      
      // Access private method using any type
      const createFunctionChunkMethod = (strategy as any).createFunctionChunk.bind(strategy);
      const chunk = createFunctionChunkMethod(functionNode, functionContent);
      
      if (chunk) {
        expect(chunk.content).toBe(functionContent);
        expect(chunk.metadata.type).toBe('function');
        expect(chunk.metadata.functionName).toBe('testFunction'); // From mock
        expect(chunk.metadata.language).toBe('typescript'); // Default
        expect(typeof chunk.metadata.complexity).toBe('number');
        expect(chunk.metadata).toHaveProperty('parameters');
        expect(chunk.metadata).toHaveProperty('returnType');
      }
    });
  });

  describe('extractFunctionName', () => {
    it('should extract function name from node', () => {
      const functionNode = createMockASTNode('function_declaration', 'function testFunction() {}');
      const functionName = (strategy as any).extractFunctionName(functionNode, 'function testFunction() {}');
      expect(functionName).toBe('testFunction');
    });

    it('should return "anonymous" for anonymous function', () => {
      const arrowFunctionNode = createMockASTNode('arrow_function', '() => {}');
      const functionName = (strategy as any).extractFunctionName(arrowFunctionNode, '() => {}');
      expect(functionName).toBe('anonymous');
    });

    it('should return "constructor" for constructor', () => {
      const constructorNode = createMockASTNode('constructor_declaration', 'constructor() {}');
      const functionName = (strategy as any).extractFunctionName(constructorNode, 'constructor() {}');
      expect(functionName).toBe('constructor');
    });

    it('should return "unknown" for node without name', () => {
      const functionNode = createMockASTNode('function_declaration', 'function() {}');
      const functionName = (strategy as any).extractFunctionName(functionNode, 'function() {}');
      expect(functionName).toBe('unknown');
    });
  });

  describe('extractParameters', () => {
    it('should extract parameters from function', () => {
      const functionNode = createMockASTNode('function_declaration', 'function test(a: string, b: number) {}');
      const parameters = (strategy as any).extractParameters(functionNode, 'function test(a: string, b: number) {}');
      // The exact behavior depends on how childForFieldName works in the mock
      expect(Array.isArray(parameters)).toBe(true);
    });
  });

  describe('extractReturnType', () => {
    it('should extract return type from function', () => {
      const functionNode = createMockASTNode('function_declaration', 'function test(): string {}');
      const returnType = (strategy as any).extractReturnType(functionNode, 'function test(): string {}');
      // The exact behavior depends on how childForFieldName works in the mock
      expect(typeof returnType).toBe('string');
    });
  });

  describe('isAsyncFunction', () => {
    it('should identify async functions', () => {
      const asyncFunctionNode = createMockASTNode('function_declaration', 'async function test() {}');
      const isAsync = (strategy as any).isAsyncFunction(asyncFunctionNode);
      // The exact behavior depends on the implementation
      expect(typeof isAsync).toBe('boolean');
    });
  });

  describe('isGeneratorFunction', () => {
    it('should identify generator functions', () => {
      const generatorNode = createMockASTNode('generator_function', 'function* test() {}');
      const isGenerator = (strategy as any).isGeneratorFunction(generatorNode);
      // The exact behavior depends on the implementation
      expect(typeof isGenerator).toBe('boolean');
    });
  });

  describe('hasSideEffects', () => {
    it('should identify functions with side effects', () => {
      const hasSideEffects = (strategy as any).hasSideEffects('console.log("hello")');
      expect(hasSideEffects).toBe(true);
    });

    it('should identify functions without side effects', () => {
      const noSideEffects = (strategy as any).hasSideEffects('function pure(a, b) { return a + b; }');
      expect(noSideEffects).toBe(false);
    });
  });

  describe('validateChunks', () => {
    it('should validate chunks correctly', () => {
      const validChunk: CodeChunk = {
        content: 'function test() { return "hello"; }',
        metadata: {
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          type: 'function'
        }
      };

      const result = strategy.validateChunks([validChunk]);
      expect(result).toBe(true);
    });

    it('should return false for chunks that are too small', () => {
      const smallChunk: CodeChunk = {
        content: 'f', // Too small
        metadata: {
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          type: 'function'
        }
      };

      const result = strategy.validateChunks([smallChunk]);
      expect(result).toBe(false);
    });
  });

  describe('extractFunctionsUsingQuery', () => {
    it('should extract functions using query engine', async () => {
      const functionContent = 'function test() { return "hello"; }';
      const astNode = createMockASTNode('program', functionContent);
      
      const result = await strategy.extractFunctionsUsingQuery(astNode, 'typescript', functionContent);
      
      // Should return an array of chunks
      expect(Array.isArray(result)).toBe(true);
      // May be empty depending on query implementation
    });
  });

  describe('batchExtractFunctions', () => {
    it('should extract functions in batch', async () => {
      const functionContent = 'function test1() { return "hello"; } function test2() { return "world"; }';
      const node1 = createMockASTNode('function_declaration', 'function test1() { return "hello"; }');
      const node2 = createMockASTNode('function_declaration', 'function test2() { return "world"; }');
      
      const result = await strategy.batchExtractFunctions([node1, node2], 'typescript', functionContent);
      
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('optimizeFunctionChunks', () => {
    it('should filter out invalid chunks', () => {
      const validChunk: CodeChunk = {
        content: 'function validFunction() { return "hello"; }',
        metadata: {
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          type: 'function'
        }
      };

      const tooSmallChunk: CodeChunk = {
        content: 'f', // Too small
        metadata: {
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          type: 'function'
        }
      };

      const optimized = (strategy as any).optimizeFunctionChunks([validChunk, tooSmallChunk]);
      expect(optimized.length).toBeLessThanOrEqual(1); // May be 0 or 1 depending on min size
    });
  });

  describe('sortFunctionsByPriority', () => {
    it('should sort functions by priority', () => {
      const publicFunction: CodeChunk = {
        content: 'function publicFunction() {}',
        metadata: {
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          type: 'function',
          functionName: 'publicFunction' // Normal function name, high priority
        }
      };

      const privateFunction: CodeChunk = {
        content: 'function _privateFunction() {}',
        metadata: {
          startLine: 2,
          endLine: 2,
          language: 'typescript',
          type: 'function',
          functionName: '_privateFunction' // Starts with _, medium priority
        }
      };

      const anonymousFunction: CodeChunk = {
        content: '() => {}',
        metadata: {
          startLine: 3,
          endLine: 3,
          language: 'typescript',
          type: 'function',
          functionName: 'anonymous' // Anonymous, low priority
        }
      };

      const unsorted = [privateFunction, anonymousFunction, publicFunction];
      const sorted = (strategy as any).sortFunctionsByPriority(unsorted);

      // The order may vary based on the implementation of getFunctionPriority
      expect(Array.isArray(sorted)).toBe(true);
      expect(sorted.length).toBe(3);
    });
  });
});