import { GraphDataMappingService } from '../../service/graph/mapping/GraphDataMappingService';

// Mock依赖项
const mockLoggerService = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

const mockValidator = {
  validateMappingResult: jest.fn().mockReturnValue(true)
};

const mockCache = {
  getMappingResult: jest.fn(),
  getFileAnalysis: jest.fn(),
  clear: jest.fn(),
  getStats: jest.fn()
};

const mockUnifiedCache = {
  getGraphData: jest.fn(),
  setGraphData: jest.fn(),
  clearGraphCache: jest.fn(),
  getGraphCacheStats: jest.fn()
};

const mockBatchOptimizer = {
  optimizeBatch: jest.fn()
};

const mockFaultToleranceHandler = {
  executeWithFaultTolerance: jest.fn().mockImplementation(async (fn) => {
    try {
      const result = await fn();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error };
    }
  })
};

describe('GraphDataMappingService - Comprehensive Tests', () => {
  let service: GraphDataMappingService;

  beforeEach(() => {
    // 重新创建服务实例
    service = new (GraphDataMappingService as any)(
      mockLoggerService,
      mockValidator,
      mockCache,
      mockUnifiedCache,
      mockBatchOptimizer,
      mockFaultToleranceHandler
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isFunctionNode - Comprehensive Language Support', () => {
    // JavaScript/TypeScript
    it('should identify JavaScript function types', () => {
      expect((service as any).isFunctionNode({ type: 'function_declaration' })).toBe(true);
      expect((service as any).isFunctionNode({ type: 'function_expression' })).toBe(true);
      expect((service as any).isFunctionNode({ type: 'arrow_function' })).toBe(true);
      expect((service as any).isFunctionNode({ type: 'method_definition' })).toBe(true);
    });

    // Python
    it('should identify Python function types', () => {
      expect((service as any).isFunctionNode({ type: 'function_definition' })).toBe(true);
    });

    // Java
    it('should identify Java function types', () => {
      expect((service as any).isFunctionNode({ type: 'method_declaration' })).toBe(true);
      expect((service as any).isFunctionNode({ type: 'constructor_declaration' })).toBe(true);
    });

    // Go
    it('should identify Go function types', () => {
      expect((service as any).isFunctionNode({ type: 'function_declaration' })).toBe(true);
    });

    // C/C++
    it('should identify C/C++ function types', () => {
      expect((service as any).isFunctionNode({ type: 'function_definition' })).toBe(true);
    });

    // C#
    it('should identify C# function types', () => {
      expect((service as any).isFunctionNode({ type: 'method_declaration' })).toBe(true);
      expect((service as any).isFunctionNode({ type: 'local_function_statement' })).toBe(true);
    });

    // Rust
    it('should identify Rust function types', () => {
      expect((service as any).isFunctionNode({ type: 'function_item' })).toBe(true);
    });

    // Lambda expressions
    it('should identify lambda expressions', () => {
      expect((service as any).isFunctionNode({ type: 'lambda' })).toBe(true);
      expect((service as any).isFunctionNode({ type: 'lambda_expression' })).toBe(true);
    });
  });

  describe('extractFunctionName - Comprehensive Language Support', () => {
    // JavaScript/TypeScript
    it('should extract JavaScript function names', () => {
      const node1 = {
        type: 'function_declaration',
        children: [
          { type: 'identifier', text: 'function' },
          { type: 'identifier', text: 'myFunction' }
        ]
      };
      expect((service as any).extractFunctionName(node1, 'javascript')).toBe('myFunction');

      const node2 = {
        type: 'method_definition',
        children: [
          { type: 'property_identifier', text: 'myMethod' }
        ]
      };
      expect((service as any).extractFunctionName(node2, 'javascript')).toBe('myMethod');
    });

    // Python
    it('should extract Python function names', () => {
      const node = {
        type: 'function_definition',
        children: [
          { type: 'identifier', text: 'def' },
          { type: 'identifier', text: 'my_function' }
        ]
      };
      expect((service as any).extractFunctionName(node, 'python')).toBe('my_function');
    });

    // Java
    it('should extract Java method names', () => {
      const node = {
        type: 'method_declaration',
        children: [
          { type: 'identifier', text: 'public' },
          { type: 'identifier', text: 'static' },
          { type: 'identifier', text: 'void' },
          { type: 'identifier', text: 'myMethod' }
        ]
      };
      expect((service as any).extractFunctionName(node, 'java')).toBe('myMethod');
    });

    // Go
    it('should extract Go function names', () => {
      const node = {
        type: 'function_declaration',
        children: [
          { type: 'identifier', text: 'func' },
          { type: 'identifier', text: 'MyFunction' }
        ]
      };
      expect((service as any).extractFunctionName(node, 'go')).toBe('MyFunction');
    });

    // C/C++
    it('should extract C/C++ function names', () => {
      const node = {
        type: 'function_definition',
        children: [
          { type: 'identifier', text: 'int' },
          { type: 'identifier', text: 'myFunction' }
        ]
      };
      expect((service as any).extractFunctionName(node, 'c')).toBe('myFunction');
    });

    // C#
    it('should extract C# method names', () => {
      const node = {
        type: 'method_declaration',
        children: [
          { type: 'identifier', text: 'public' },
          { type: 'identifier', text: 'static' },
          { type: 'identifier', text: 'void' },
          { type: 'identifier', text: 'MyMethod' }
        ]
      };
      expect((service as any).extractFunctionName(node, 'csharp')).toBe('MyMethod');
    });

    // Rust
    it('should extract Rust function names', () => {
      const node = {
        type: 'function_item',
        children: [
          { type: 'identifier', text: 'fn' },
          { type: 'identifier', text: 'my_function' }
        ]
      };
      expect((service as any).extractFunctionName(node, 'rust')).toBe('my_function');
    });
  });

  describe('determineCallType - Comprehensive Language Support', () => {
    // JavaScript/TypeScript
    it('should identify JavaScript call types', () => {
      expect((service as any).determineCallType({ type: 'call_expression' }, 'javascript')).toBe('function');
      expect((service as any).determineCallType({ type: 'new_expression' }, 'javascript')).toBe('constructor');
      expect((service as any).determineCallType({ type: 'member_expression' }, 'javascript')).toBe('method');
      expect((service as any).determineCallType({ type: 'optional_chain' }, 'javascript')).toBe('optional_call');
    });

    // Python
    it('should identify Python call types', () => {
      expect((service as any).determineCallType({ type: 'call' }, 'python')).toBe('function');
      expect((service as any).determineCallType({ type: 'attribute' }, 'python')).toBe('method');
    });

    // Java
    it('should identify Java call types', () => {
      expect((service as any).determineCallType({ type: 'method_invocation' }, 'java')).toBe('method');
      expect((service as any).determineCallType({ type: 'object_creation_expression' }, 'java')).toBe('constructor');
      expect((service as any).determineCallType({ type: 'super_method_invocation' }, 'java')).toBe('method');
    });

    // Go
    it('should identify Go call types', () => {
      expect((service as any).determineCallType({ type: 'call_expression' }, 'go')).toBe('function');
    });

    // C/C++
    it('should identify C/C++ call types', () => {
      expect((service as any).determineCallType({ type: 'call_expression' }, 'c')).toBe('function');
    });

    // C#
    it('should identify C# call types', () => {
      expect((service as any).determineCallType({ type: 'invocation_expression' }, 'csharp')).toBe('method');
      expect((service as any).determineCallType({ type: 'object_creation_expression' }, 'csharp')).toBe('constructor');
    });

    // Rust
    it('should identify Rust call types', () => {
      expect((service as any).determineCallType({ type: 'call_expression' }, 'rust')).toBe('function');
    });
  });

  describe('findCallerFunctionContext - Edge Cases', () => {
    it('should handle deeply nested function contexts', () => {
      const callNode = {
        parent: {
          parent: {
            parent: {
              parent: {
                type: 'function_declaration',
                children: [
                  { type: 'identifier', text: 'function' },
                  { type: 'identifier', text: 'deepFunction' }
                ]
              }
            }
          }
        }
      };

      const result = (service as any).findCallerFunctionContext(callNode, '/test/file.js', 'javascript');
      expect(result).toEqual({
        functionId: expect.stringContaining('function_'),
        functionName: 'deepFunction'
      });
    });

    it('should handle arrow functions in assignment expressions', () => {
      const callNode = {
        parent: {
          parent: {
            type: 'arrow_function'
            // 箭头函数没有直接的名称，应该返回匿名
          }
        }
      };

      const result = (service as any).findCallerFunctionContext(callNode, '/test/file.js', 'javascript');
      expect(result).toEqual({
        functionId: expect.stringContaining('function_'),
        functionName: 'anonymous'
      });
    });
  });

  describe('generateFunctionNodeId - Uniqueness', () => {
    it('should generate unique IDs for different functions', () => {
      const id1 = (service as any).generateFunctionNodeId('func1', '/path/file1.js');
      const id2 = (service as any).generateFunctionNodeId('func2', '/path/file1.js');
      const id3 = (service as any).generateFunctionNodeId('func1', '/path/file2.js');

      expect(id1).not.toBe(id2);
      expect(id1).not.toBe(id3);
      expect(id2).not.toBe(id3);
    });

    it('should generate consistent IDs for the same function', () => {
      const id1 = (service as any).generateFunctionNodeId('func1', '/path/file1.js');
      const id2 = (service as any).generateFunctionNodeId('func1', '/path/file1.js');

      expect(id1).toBe(id2);
    });
  });
});