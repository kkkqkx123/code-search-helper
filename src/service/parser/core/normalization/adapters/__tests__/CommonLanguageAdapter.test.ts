import { CCommonLanguageAdapter } from '../CCommonLanguageAdapter';

describe('CCommonLanguageAdapter', () => {
  let adapter: CCommonLanguageAdapter;

  beforeEach(() => {
    adapter = new CCommonLanguageAdapter();
  });

  describe('getSupportedQueryTypes', () => {
    it('should return supported query types', () => {
      const types = adapter.getSupportedQueryTypes();
      expect(types).toContain('functions');
      expect(types).toContain('classes');
      expect(types).toContain('methods');
      expect(types).toContain('imports');
      expect(types).toContain('variables');
      expect(types).toContain('control-flow');
      expect(types).toContain('types');
      expect(types).toContain('expressions');
      expect(types).toContain('namespaces');
    });
  });

 describe('mapNodeType', () => {
    it('should map function_definition to function', () => {
      expect(adapter.mapNodeType('function_definition')).toBe('function');
    });

    it('should map class_specifier to class', () => {
      expect(adapter.mapNodeType('class_specifier')).toBe('class');
    });

    it('should map method_declaration to method', () => {
      expect(adapter.mapNodeType('method_declaration')).toBe('method');
    });

    it('should return original type if not mapped', () => {
      expect(adapter.mapNodeType('unknown_type')).toBe('unknown_type');
    });
  });

  describe('extractName', () => {
    it('should extract name from result captures', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.function',
            node: {
              text: 'testFunction'
            }
          }
        ]
      };

      const name = adapter.extractName(mockResult);
      expect(name).toBe('testFunction');
    });

    it('should return unnamed if no name found', () => {
      const mockResult = {
        captures: []
      };

      const name = adapter.extractName(mockResult);
      expect(name).toBe('unnamed');
    });
  });

  describe('extractContent', () => {
    it('should extract content from main node', () => {
      const mockResult = {
        captures: [
          {
            node: {
              text: 'int main() { return 0; }'
            }
          }
        ]
      };

      const content = adapter.extractContent(mockResult);
      expect(content).toBe('int main() { return 0; }');
    });

    it('should return empty string if no content found', () => {
      const mockResult = {
        captures: []
      };

      const content = adapter.extractContent(mockResult);
      expect(content).toBe('');
    });
  });

  describe('extractStartLine and extractEndLine', () => {
    it('should extract start and end line numbers', () => {
      const mockResult = {
        captures: [
          {
            node: {
              startPosition: { row: 5 }, // 0-based
              endPosition: { row: 10 }   // 0-based
            }
          }
        ]
      };

      expect(adapter.extractStartLine(mockResult)).toBe(6); // 1-based
      expect(adapter.extractEndLine(mockResult)).toBe(11);  // 1-based
    });

    it('should return 1 if positions not found', () => {
      const mockResult = {
        captures: []
      };

      expect(adapter.extractStartLine(mockResult)).toBe(1);
      expect(adapter.extractEndLine(mockResult)).toBe(1);
    });
  });

  describe('extractModifiers', () => {
    it('should extract modifiers from function text', () => {
      const mockResult = {
        captures: [
          {
            node: {
              text: 'virtual void myFunction() const'
            }
          }
        ]
      };

      const modifiers = adapter.extractModifiers(mockResult);
      expect(modifiers).toContain('virtual');
      expect(modifiers).toContain('const');
    });
  });

  describe('calculateComplexity', () => {
    it('should calculate basic complexity', () => {
      const mockResult = {
        captures: [
          {
            node: {
              text: 'int func() { return 0; }',
              type: 'function_definition',
              startPosition: { row: 0 },
              endPosition: { row: 2 }
            }
          }
        ]
      };

      const complexity = adapter.calculateComplexity(mockResult);
      expect(complexity).toBeGreaterThanOrEqual(1);
    });
  });

  describe('normalize', () => {
    it('should normalize query results for C language', async () => {
      const mockQueryResult = {
        captures: [
          {
            name: 'name.definition.function',
            node: {
              text: 'main',
              type: 'function_definition',
              startPosition: { row: 0, column: 0 },
              endPosition: { row: 2, column: 0 }
            }
          }
        ]
      };

      const results = await adapter.normalize([mockQueryResult], 'functions', 'c');
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        type: 'function',
        name: 'main',
        startLine: 1,
        endLine: 3,
        content: 'main',
        metadata: {
          language: 'c',
          complexity: expect.any(Number),
          dependencies: expect.any(Array),
          modifiers: expect.any(Array),
          extra: undefined
        }
      });
    });
  });
});