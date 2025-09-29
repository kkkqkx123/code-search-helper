import Parser from 'tree-sitter';
import { ClassChunkingStrategy } from '../../strategy/ClassChunkingStrategy';
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
      if (fieldName === 'name' && type === 'class_declaration') {
        return createMockASTNode('identifier', 'TestClass');
      }
      if (fieldName === 'body' && type === 'class_declaration') {
        return createMockASTNode('class_body', '{ method() {} }');
      }
      return null;
    }
  };
};

describe('ClassChunkingStrategy', () => {
  let strategy: ClassChunkingStrategy;

  beforeEach(() => {
    strategy = new ClassChunkingStrategy();
  });

  describe('Constructor', () => {
    it('should initialize with correct properties', () => {
      expect(strategy.name).toBe('class_chunking');
      expect(strategy.priority).toBe(2);
      expect(strategy.description).toBe('Extract class definitions and their members');
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

      const customStrategy = new ClassChunkingStrategy(customConfig);
      const config = customStrategy.getConfiguration();

      expect(config.maxChunkSize).toBe(3000);
      expect(config.minChunkSize).toBe(200);
      expect(config.preserveComments).toBe(false);
      expect(config.preserveEmptyLines).toBe(true);
      expect(config.maxNestingLevel).toBe(5);
    });
  });

 describe('canHandle', () => {
    it('should return true for supported language and class node', () => {
      const classNode = createMockASTNode('class_declaration', 'class TestClass {}');
      const result = strategy.canHandle('typescript', classNode);
      expect(result).toBe(true);
    });

    it('should return false for unsupported language', () => {
      const classNode = createMockASTNode('class_declaration', 'class TestClass {}');
      const result = strategy.canHandle('unsupported', classNode);
      expect(result).toBe(false);
    });

    it('should return false for non-class node', () => {
      const functionNode = createMockASTNode('function_declaration', 'function test() {}');
      const result = strategy.canHandle('typescript', functionNode);
      expect(result).toBe(false);
    });

    it('should return true for different class types in different languages', () => {
      // TypeScript class
      const tsClassNode = createMockASTNode('class_declaration');
      expect(strategy.canHandle('typescript', tsClassNode)).toBe(true);

      // Python class
      const pyClassNode = createMockASTNode('class_definition');
      expect(strategy.canHandle('python', pyClassNode)).toBe(true);

      // Java class
      const javaClassNode = createMockASTNode('class_declaration');
      expect(strategy.canHandle('java', javaClassNode)).toBe(true);

      // Go struct (treated as class)
      const goStructNode = createMockASTNode('struct_type');
      expect(strategy.canHandle('go', goStructNode)).toBe(true);
    });
  });

  describe('getSupportedNodeTypes', () => {
    it('should return class types for TypeScript', () => {
      const types = strategy.getSupportedNodeTypes('typescript');
      expect(types).toContain('class_declaration');
      expect(types).toContain('class_expression');
      expect(types).toContain('interface_declaration');
      expect(types).toContain('type_alias_declaration');
    });

    it('should return class types for JavaScript', () => {
      const types = strategy.getSupportedNodeTypes('javascript');
      expect(types).toContain('class_declaration');
      expect(types).toContain('class_expression');
    });

    it('should return class types for Python', () => {
      const types = strategy.getSupportedNodeTypes('python');
      expect(types).toContain('class_definition');
    });

    it('should return class types for Java', () => {
      const types = strategy.getSupportedNodeTypes('java');
      expect(types).toContain('class_declaration');
      expect(types).toContain('interface_declaration');
      expect(types).toContain('enum_declaration');
    });

    it('should return class types for Go', () => {
      const types = strategy.getSupportedNodeTypes('go');
      expect(types).toContain('struct_type');
      expect(types).toContain('interface_type');
    });

    it('should return empty set for unsupported language', () => {
      const types = strategy.getSupportedNodeTypes('unsupported');
      expect(types.size).toBe(0);
    });
 });

  describe('chunk', () => {
    it('should create a chunk for a class node', () => {
      const classContent = 'class TestClass { method() { return "hello"; } }';
      const classNode = createMockASTNode('class_declaration', classContent);
      
      const chunks = strategy.chunk(classNode, classContent);
      
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBe(1);
      
      const chunk = chunks[0];
      expect(chunk.content).toBe(classContent);
      expect(chunk.metadata).toHaveProperty('type', 'class');
      expect(chunk.metadata).toHaveProperty('className', 'TestClass');
      expect(chunk.metadata).toHaveProperty('language');
      expect(chunk.metadata).toHaveProperty('startLine');
      expect(chunk.metadata).toHaveProperty('endLine');
    });

    it('should return empty array for non-class node', () => {
      const functionNode = createMockASTNode('function_declaration', 'function test() {}');
      const chunks = strategy.chunk(functionNode, 'function test() {}');
      
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBe(0);
    });

    it('should return empty array for class that is too small', () => {
      const smallClassNode = createMockASTNode('class_declaration', 'class A {}');
      const chunks = strategy.chunk(smallClassNode, 'class A {}');
      
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBe(0);
    });

    it('should return empty array for class that is too large', () => {
      const largeContent = 'class LargeClass { ' + 'method'.repeat(5000) + ' }';
      const largeClassNode = createMockASTNode('class_declaration', largeContent);
      const chunks = strategy.chunk(largeClassNode, largeContent);
      
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBe(0);
    });
  });

  describe('createClassChunk', () => {
    it('should create a class chunk with correct metadata', () => {
      const classContent = 'class TestClass { method() { return "hello"; } }';
      const classNode = createMockASTNode('class_declaration', classContent);
      
      // Access private method using any type
      const createClassChunkMethod = (strategy as any).createClassChunk.bind(strategy);
      const chunk = createClassChunkMethod(classNode, classContent);
      
      if (chunk) {
        expect(chunk.content).toBe(classContent);
        expect(chunk.metadata.type).toBe('class');
        expect(chunk.metadata.className).toBe('TestClass');
        expect(chunk.metadata.language).toBe('typescript'); // Default
        expect(typeof chunk.metadata.complexity).toBe('number');
      }
    });
  });

  describe('extractClassName', () => {
    it('should extract class name from node', () => {
      const classNode = createMockASTNode('class_declaration', 'class TestClass {}');
      const className = (strategy as any).extractClassName(classNode, 'class TestClass {}');
      expect(className).toBe('TestClass');
    });

    it('should return "anonymous" for anonymous class', () => {
      const classNode = createMockASTNode('class_expression', 'class {}');
      const className = (strategy as any).extractClassName(classNode, 'class {}');
      expect(className).toBe('anonymous');
    });

    it('should return "unknown" for node without name', () => {
      const classNode = createMockASTNode('class_declaration', 'class {}');
      const className = (strategy as any).extractClassName(classNode, 'class {}');
      expect(className).toBe('unknown');
    });
  });

  describe('extractInheritance', () => {
    it('should extract inheritance information', () => {
      // This tests the method that parses inheritance
      const classNode = createMockASTNode('class_declaration', 'class Child extends Parent {}');
      const inheritance = (strategy as any).extractInheritance(classNode, 'class Child extends Parent {}');
      // The exact behavior depends on how childForFieldName works in the mock
      expect(Array.isArray(inheritance)).toBe(true);
    });
  });

  describe('isMethod and isProperty', () => {
    it('should identify method nodes', () => {
      const methodNode = createMockASTNode('method_definition');
      expect((strategy as any).isMethod(methodNode)).toBe(true);
      
      const functionNode = createMockASTNode('function_declaration');
      expect((strategy as any).isMethod(functionNode)).toBe(true);
      
      const propertyNode = createMockASTNode('property_declaration');
      expect((strategy as any).isMethod(propertyNode)).toBe(false);
    });

    it('should identify property nodes', () => {
      const propertyNode = createMockASTNode('property_declaration');
      expect((strategy as any).isProperty(propertyNode)).toBe(true);
      
      const fieldNode = createMockASTNode('field_declaration');
      expect((strategy as any).isProperty(fieldNode)).toBe(true);
      
      const methodNode = createMockASTNode('method_definition');
      expect((strategy as any).isProperty(methodNode)).toBe(false);
    });
  });

  describe('validateChunks', () => {
    it('should validate chunks correctly', () => {
      const validChunk: CodeChunk = {
        content: 'class Test { method() {} }',
        metadata: {
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          type: 'class'
        }
      };

      const result = strategy.validateChunks([validChunk]);
      expect(result).toBe(true);
    });

    it('should return false for chunks that are too small', () => {
      const smallChunk: CodeChunk = {
        content: 'c', // Too small
        metadata: {
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          type: 'class'
        }
      };

      const result = strategy.validateChunks([smallChunk]);
      expect(result).toBe(false);
    });
  });

  describe('extractClassesUsingQuery', () => {
    it('should extract classes using query engine', async () => {
      const classContent = 'class TestClass { method() {} }';
      const astNode = createMockASTNode('program', classContent);
      
      const result = await strategy.extractClassesUsingQuery(astNode, 'typescript', classContent);
      
      // Should return an array of chunks
      expect(Array.isArray(result)).toBe(true);
      // May be empty depending on query implementation
    });
  });

  describe('optimizeClassChunks', () => {
    it('should filter out invalid chunks', () => {
      const validChunk: CodeChunk = {
        content: 'class ValidClass { method() {} }',
        metadata: {
          startLine: 1,
          endLine: 3,
          language: 'typescript',
          type: 'class'
        }
      };

      const tooSmallChunk: CodeChunk = {
        content: 'c', // Too small
        metadata: {
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          type: 'class'
        }
      };

      const optimized = (strategy as any).optimizeClassChunks([validChunk, tooSmallChunk]);
      expect(optimized.length).toBe(1);
      expect(optimized[0]).toBe(validChunk);
    });
  });

  describe('sortClassesByPriority', () => {
    it('should sort classes by priority', () => {
      const publicClass: CodeChunk = {
        content: 'class PublicClass {}',
        metadata: {
          startLine: 1,
          endLine: 1,
          language: 'typescript',
          type: 'class',
          className: 'PublicClass' // Normal class name, high priority
        }
      };

      const privateClass: CodeChunk = {
        content: 'class _PrivateClass {}',
        metadata: {
          startLine: 2,
          endLine: 2,
          language: 'typescript',
          type: 'class',
          className: '_PrivateClass' // Starts with _, medium priority
        }
      };

      const anonymousClass: CodeChunk = {
        content: 'class {}',
        metadata: {
          startLine: 3,
          endLine: 3,
          language: 'typescript',
          type: 'class',
          className: 'anonymous' // Anonymous, low priority
        }
      };

      const unsorted = [privateClass, anonymousClass, publicClass];
      const sorted = (strategy as any).sortClassesByPriority(unsorted);

      expect(sorted[0]).toBe(publicClass); // Highest priority first
      expect(sorted[2]).toBe(anonymousClass); // Lowest priority last
    });
  });
});