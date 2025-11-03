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

describe('GraphDataMappingService', () => {
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

  describe('isFunctionNode', () => {
    it('should correctly identify JavaScript function declaration nodes', () => {
      const node = { type: 'function_declaration' };
      expect((service as any).isFunctionNode(node)).toBe(true);
    });

    it('should correctly identify Python function definition nodes', () => {
      const node = { type: 'function_definition' };
      expect((service as any).isFunctionNode(node)).toBe(true);
    });

    it('should correctly identify Java method declaration nodes', () => {
      const node = { type: 'method_declaration' };
      expect((service as any).isFunctionNode(node)).toBe(true);
    });

    it('should return false for non-function nodes', () => {
      const node = { type: 'variable_declaration' };
      expect((service as any).isFunctionNode(node)).toBe(false);
    });
  });

  describe('extractFunctionName', () => {
    it('should extract function name from JavaScript function declaration', () => {
      const node = {
        type: 'function_declaration',
        children: [
          { type: 'identifier', text: 'function' },
          { type: 'identifier', text: 'myFunction' }
        ]
      };
      expect((service as any).extractFunctionName(node, 'javascript')).toBe('myFunction');
    });

    it('should extract function name from Python function definition', () => {
      const node = {
        type: 'function_definition',
        children: [
          { type: 'identifier', text: 'def' },
          { type: 'identifier', text: 'my_function' }
        ]
      };
      expect((service as any).extractFunctionName(node, 'python')).toBe('my_function');
    });

    it('should return anonymous for nodes without identifiable name', () => {
      const node = {
        type: 'function_declaration',
        children: []
      };
      expect((service as any).extractFunctionName(node, 'javascript')).toBe('anonymous');
    });
  });

  describe('determineCallType', () => {
    it('should identify JavaScript function calls', () => {
      const node = { type: 'call_expression' };
      expect((service as any).determineCallType(node, 'javascript')).toBe('function');
    });

    it('should identify JavaScript constructor calls', () => {
      const node = { type: 'new_expression' };
      expect((service as any).determineCallType(node, 'javascript')).toBe('constructor');
    });

    it('should identify Python function calls', () => {
      const node = { type: 'call' };
      expect((service as any).determineCallType(node, 'python')).toBe('function');
    });

    it('should identify Java method calls', () => {
      const node = { type: 'method_invocation' };
      expect((service as any).determineCallType(node, 'java')).toBe('method');
    });
  });

  describe('findCallerFunctionContext', () => {
    it('should find caller function context for a call node', () => {
      const callNode = {
        parent: {
          parent: {
            type: 'function_declaration',
            children: [
              { type: 'identifier', text: 'function' },
              { type: 'identifier', text: 'parentFunction' }
            ]
          }
        }
      };

      const result = (service as any).findCallerFunctionContext(callNode, '/test/file.js', 'javascript');
      expect(result).toEqual({
        functionId: expect.stringContaining('function_'),
        functionName: 'parentFunction'
      });
    });

    it('should return null when no caller function context is found', () => {
      const callNode = {
        parent: {
          parent: null
        }
      };

      const result = (service as any).findCallerFunctionContext(callNode, '/test/file.js', 'javascript');
      expect(result).toBeNull();
    });
  });
});