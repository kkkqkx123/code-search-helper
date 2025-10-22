import { RustLanguageAdapter } from '../RustLanguageAdapter';
import { StandardizedQueryResult } from '../../types';

describe('RustLanguageAdapter', () => {
  let adapter: RustLanguageAdapter;

  beforeEach(() => {
    adapter = new RustLanguageAdapter();
  });

  describe('normalize', () => {
    it('should normalize function query results', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.function',
            node: {
              text: 'my_function',
              startPosition: { row: 5, column: 0 },
              endPosition: { row: 10, column: 0 }
            }
          }
        ]
      };

      const results = adapter.normalize([mockResult], 'functions', 'rust');
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        type: 'function',
        name: 'my_function',
        startLine: 6, // 从0-based转换为1-based
        endLine: 11,  // 从0-based转换为1-based
        content: 'my_function',
        metadata: {
          language: 'rust',
          complexity: expect.any(Number),
          dependencies: expect.any(Array),
          modifiers: expect.any(Array)
        }
      });
    });

    it('should normalize struct query results', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.struct',
            node: {
              text: 'MyStruct',
              startPosition: { row: 0, column: 0 },
              endPosition: { row: 5, column: 0 }
            }
          }
        ]
      };

      const results = adapter.normalize([mockResult], 'classes', 'rust');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('class');
      expect(results[0].name).toBe('MyStruct');
    });

    it('should normalize use declaration query results', () => {
      const mockResult = {
        captures: [
          {
            name: 'definition.use_declaration',
            node: {
              text: 'use std::collections::HashMap;',
              startPosition: { row: 0, column: 0 },
              endPosition: { row: 0, column: 32 }
            }
          }
        ]
      };

      const results = adapter.normalize([mockResult], 'imports', 'rust');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('import');
      expect(results[0].content).toBe('use std::collections::HashMap;');
    });

    it('should normalize variable declaration query results', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.variable',
            node: {
              text: 'my_var',
              startPosition: { row: 2, column: 0 },
              endPosition: { row: 2, column: 15 }
            }
          }
        ]
      };

      const results = adapter.normalize([mockResult], 'variables', 'rust');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('variable');
      expect(results[0].name).toBe('my_var');
    });
 });

  describe('getSupportedQueryTypes', () => {
    it('should return correct query types for Rust', () => {
      const supportedTypes = adapter.getSupportedQueryTypes();
      
      expect(supportedTypes).toContain('functions');
      expect(supportedTypes).toContain('classes');
      expect(supportedTypes).toContain('methods');
      expect(supportedTypes).toContain('imports');
      expect(supportedTypes).toContain('variables');
      expect(supportedTypes).toContain('control-flow');
      expect(supportedTypes).toContain('types');
      expect(supportedTypes).toContain('expressions');
      expect(supportedTypes).toContain('macros');
      expect(supportedTypes).toContain('modules');
    });
  });

  describe('mapNodeType', () => {
    it('should map function_item to function', () => {
      expect(adapter.mapNodeType('function_item')).toBe('function');
    });

    it('should map struct_item to class', () => {
      expect(adapter.mapNodeType('struct_item')).toBe('class');
    });

    it('should map enum_item to class', () => {
      expect(adapter.mapNodeType('enum_item')).toBe('class');
    });

    it('should map use_declaration to import', () => {
      expect(adapter.mapNodeType('use_declaration')).toBe('import');
    });

    it('should return unknown node type as is', () => {
      expect(adapter.mapNodeType('unknown_type')).toBe('unknown_type');
    });
  });

  describe('extractName', () => {
    it('should extract name from name.definition.function capture', () => {
      const result = {
        captures: [
          {
            name: 'name.definition.function',
            node: { text: 'my_function' }
          }
        ]
      };

      const name = adapter.extractName(result);
      expect(name).toBe('my_function');
    });

    it('should extract name from identifier field', () => {
      const result = {
        captures: [
          {
            name: 'name',
            node: { 
              text: 'full_node_text',
              childForFieldName: (field: string) => {
                if (field === 'name') {
                  return { text: 'extracted_name' };
                }
                return null;
              }
            }
          }
        ]
      };

      const name = adapter.extractName(result);
      expect(name).toBe('extracted_name');
    });

    it('should return "unnamed" if no name is found', () => {
      const result = { captures: [] };
      const name = adapter.extractName(result);
      expect(name).toBe('unnamed');
    });
  });

 describe('extractContent', () => {
    it('should extract content from main node', () => {
      const result = {
        captures: [
          {
            node: { text: 'fn test_function() { println!("Hello"); }' }
          }
        ]
      };

      const content = adapter.extractContent(result);
      expect(content).toBe('fn test_function() { println!("Hello"); }');
    });

    it('should return empty string if no main node', () => {
      const result = { captures: [] };
      const content = adapter.extractContent(result);
      expect(content).toBe('');
    });
  });

  describe('extractStartLine and extractEndLine', () => {
    it('should convert 0-based positions to 1-based lines', () => {
      const result = {
        captures: [
          {
            node: {
              startPosition: { row: 5, column: 0 },
              endPosition: { row: 10, column: 5 }
            }
          }
        ]
      };

      const startLine = adapter.extractStartLine(result);
      const endLine = adapter.extractEndLine(result);
      
      expect(startLine).toBe(6); // 5 + 1
      expect(endLine).toBe(11); // 10 + 1
    });

    it('should return 1 if no position data', () => {
      const result = { captures: [] };
      const startLine = adapter.extractStartLine(result);
      const endLine = adapter.extractEndLine(result);
      
      expect(startLine).toBe(1);
      expect(endLine).toBe(1);
    });
  });

  describe('calculateComplexity', () => {
    it('should return at least 1 as base complexity', () => {
      const result = {
        captures: [
          {
            node: {
              type: 'simple_type',
              startPosition: { row: 0, column: 0 },
              endPosition: { row: 0, column: 0 },
              text: 'i32'
            }
          }
        ]
      };

      const complexity = adapter.calculateComplexity(result);
      expect(complexity).toBeGreaterThanOrEqual(1);
    });
 });

  describe('extractModifiers', () => {
    it('should identify unsafe modifier', () => {
      const result = {
        captures: [
          {
            node: { text: 'unsafe fn dangerous_function() {}' }
          }
        ]
      };

      const modifiers = adapter.extractModifiers(result);
      expect(modifiers).toContain('unsafe');
    });

    it('should identify async modifier', () => {
      const result = {
        captures: [
          {
            node: { text: 'async fn async_function() {}' }
          }
        ]
      };

      const modifiers = adapter.extractModifiers(result);
      expect(modifiers).toContain('async');
    });

    it('should identify pub modifier', () => {
      const result = {
        captures: [
          {
            node: { text: 'pub fn public_function() {}' }
          }
        ]
      };

      const modifiers = adapter.extractModifiers(result);
      expect(modifiers).toContain('public');
    });
  });
});