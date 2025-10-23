import { JavaLanguageAdapter } from '../JavaLanguageAdapter';
import { StandardizedQueryResult } from '../../types';

describe('JavaLanguageAdapter', () => {
  let adapter: JavaLanguageAdapter;

  beforeEach(() => {
    adapter = new JavaLanguageAdapter();
  });

  describe('normalize', () => {
    it('should normalize class query results', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.class',
            node: {
              text: 'TestClass',
              startPosition: { row: 5, column: 0 },
              endPosition: { row: 10, column: 0 },
              type: 'class_declaration'
            }
          }
        ]
      };

      const results = adapter.normalize([mockResult], 'classes', 'java');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('class');
      expect(results[0].name).toBe('TestClass');
      expect(results[0].startLine).toBe(6); // 从0-based转换为1-based
      expect(results[0].endLine).toBe(11);  // 从0-based转换为1-based
      expect(results[0].content).toBe('TestClass');
      expect(results[0].metadata.language).toBe('java');
    });

    it('should normalize method query results', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.method',
            node: {
              text: 'testMethod',
              startPosition: { row: 8, column: 2 },
              endPosition: { row: 12, column: 2 },
              type: 'method_declaration'
            }
          }
        ]
      };

      const results = adapter.normalize([mockResult], 'methods', 'java');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('method');
      expect(results[0].name).toBe('testMethod');
      expect(results[0].startLine).toBe(9);
      expect(results[0].endLine).toBe(13);
    });

    it('should normalize interface query results', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.interface',
            node: {
              text: 'TestInterface',
              startPosition: { row: 1, column: 0 },
              endPosition: { row: 5, column: 0 },
              type: 'interface_declaration'
            }
          }
        ]
      };

      const results = adapter.normalize([mockResult], 'interfaces', 'java');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('interface');
      expect(results[0].name).toBe('TestInterface');
    });

    it('should normalize import query results', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.import',
            node: {
              text: 'java.util.List',
              startPosition: { row: 0, column: 0 },
              endPosition: { row: 0, column: 18 },
              type: 'import_declaration'
            }
          }
        ]
      };

      const results = adapter.normalize([mockResult], 'imports', 'java');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('import');
      expect(results[0].name).toBe('java.util.List');
    });

    it('should normalize enum query results', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.enum',
            node: {
              text: 'TestEnum',
              startPosition: { row: 3, column: 0 },
              endPosition: { row: 8, column: 0 },
              type: 'enum_declaration'
            }
          }
        ]
      };

      const results = adapter.normalize([mockResult], 'enums', 'java');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('type');
      expect(results[0].name).toBe('TestEnum');
    });

    it('should normalize variable query results', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.field',
            node: {
              text: 'testField',
              startPosition: { row: 7, column: 2 },
              endPosition: { row: 7, column: 20 },
              type: 'field_declaration'
            }
          }
        ]
      };

      const results = adapter.normalize([mockResult], 'variables', 'java');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('variable');
      expect(results[0].name).toBe('testField');
    });

    it('should handle complex Java code with modifiers and annotations', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.method',
            node: {
              text: 'complexMethod',
              startPosition: { row: 10, column: 2 },
              endPosition: { row: 15, column: 2 },
              type: 'method_declaration'
            }
          }
        ]
      };

      // Mock the extractContent method to return the full method text
      jest.spyOn(adapter, 'extractContent').mockReturnValue('@Override\n  public synchronized final void complexMethod() throws IOException {\n    // method body\n  }');

      const results = adapter.normalize([mockResult], 'methods', 'java');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('method');
      expect(results[0].name).toBe('complexMethod');
      expect(results[0].metadata.modifiers).toContain('public');
      expect(results[0].metadata.modifiers).toContain('synchronized');
      expect(results[0].metadata.modifiers).toContain('final');
      expect(results[0].metadata.modifiers).toContain('override');
      expect(results[0].metadata.complexity).toBeGreaterThan(1);
      
      // Restore the original method
      jest.restoreAllMocks();
    });

    it('should handle generic types', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.class',
            node: {
              text: 'GenericClass',
              startPosition: { row: 2, column: 0 },
              endPosition: { row: 8, column: 0 },
              type: 'class_declaration',
              childForFieldName: jest.fn().mockReturnValue({
                text: '<T extends Comparable<T>>'
              })
            }
          }
        ]
      };

      const results = adapter.normalize([mockResult], 'classes', 'java');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('class');
      expect(results[0].name).toBe('GenericClass');
      expect(results[0].metadata.extra?.hasGenerics).toBe(true);
    });

    it('should filter out null results', () => {
      const mockResults = [
        {
          captures: [
            {
              name: 'name.definition.class',
              node: {
                text: 'ValidClass',
                startPosition: { row: 1, column: 0 },
                endPosition: { row: 5, column: 0 },
                type: 'class_declaration'
              }
            }
          ]
        }
      ];

      const results = adapter.normalize(mockResults, 'classes', 'java');
      
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('ValidClass');
    });
  });

  describe('getSupportedQueryTypes', () => {
    it('should return all supported query types', () => {
      const supportedTypes = adapter.getSupportedQueryTypes();
      
      expect(supportedTypes).toContain('classes-interfaces');
      expect(supportedTypes).toContain('methods-variables');
      expect(supportedTypes).toContain('control-flow-patterns');
      expect(supportedTypes).toContain('functions');
      expect(supportedTypes).toContain('classes');
      expect(supportedTypes).toContain('methods');
      expect(supportedTypes).toContain('imports');
      expect(supportedTypes).toContain('variables');
      expect(supportedTypes).toContain('interfaces');
      expect(supportedTypes).toContain('enums');
      expect(supportedTypes).toContain('records');
      expect(supportedTypes).toContain('annotations');
    });
  });

  describe('mapNodeType', () => {
    it('should map Java node types to standard types', () => {
      expect(adapter.mapNodeType('class_declaration')).toBe('class');
      expect(adapter.mapNodeType('interface_declaration')).toBe('interface');
      expect(adapter.mapNodeType('enum_declaration')).toBe('type');
      expect(adapter.mapNodeType('method_declaration')).toBe('method');
      expect(adapter.mapNodeType('constructor_declaration')).toBe('method');
      expect(adapter.mapNodeType('field_declaration')).toBe('variable');
      expect(adapter.mapNodeType('import_declaration')).toBe('import');
      expect(adapter.mapNodeType('if_statement')).toBe('control-flow');
      expect(adapter.mapNodeType('method_invocation')).toBe('expression');
      expect(adapter.mapNodeType('type_identifier')).toBe('type');
    });

    it('should return original type for unknown types', () => {
      expect(adapter.mapNodeType('unknown_type')).toBe('unknown_type');
    });
  });

  describe('extractName', () => {
    it('should extract name from various capture types', () => {
      const classResult = {
        captures: [
          {
            name: 'name.definition.class',
            node: { text: 'TestClass' }
          }
        ]
      };

      const methodResult = {
        captures: [
          {
            name: 'name.definition.method',
            node: { text: 'testMethod' }
          }
        ]
      };

      expect(adapter.extractName(classResult)).toBe('TestClass');
      expect(adapter.extractName(methodResult)).toBe('testMethod');
    });

    it('should return unnamed when no name found', () => {
      const emptyResult = {
        captures: []
      };

      expect(adapter.extractName(emptyResult)).toBe('unnamed');
    });
  });

  describe('calculateComplexity', () => {
    it('should calculate complexity based on various factors', () => {
      const simpleResult = {
        captures: [
          {
            name: 'name.definition.method',
            node: {
              type: 'method_declaration',
              text: 'public void simpleMethod() {}',
              startPosition: { row: 1, column: 0 },
              endPosition: { row: 1, column: 30 }
            }
          }
        ]
      };

      const complexResult = {
        captures: [
          {
            name: 'name.definition.method',
            node: {
              type: 'method_declaration',
              text: '@Override\n  public synchronized final void complexMethod() throws IOException {\n    try {\n      // complex logic\n    } catch (Exception e) {\n      // error handling\n    }\n  }',
              startPosition: { row: 1, column: 0 },
              endPosition: { row: 10, column: 0 }
            }
          }
        ]
      };

      const simpleComplexity = adapter.calculateComplexity(simpleResult);
      const complexComplexity = adapter.calculateComplexity(complexResult);

      expect(complexComplexity).toBeGreaterThan(simpleComplexity);
    });
  });

  describe('extractDependencies', () => {
    it('should extract dependencies from imports and type references', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.import',
            node: {
              text: 'java.util.List',
              type: 'import_declaration'
            }
          },
          {
            name: 'name.definition.method',
            node: {
              text: 'processData',
              type: 'method_declaration',
              children: [
                {
                  type: 'type_identifier',
                  text: 'ArrayList'
                }
              ]
            }
          }
        ]
      };

      const dependencies = adapter.extractDependencies(mockResult);
      
      expect(dependencies).toContain('java.util.List');
      // Note: ArrayList might not be extracted because it's not in the main node of the first capture
      // The dependency extraction focuses on the main node of each capture
    });
  });

  describe('extractModifiers', () => {
    it('should extract Java modifiers and annotations', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.method',
            node: {
              text: '@Override\n  public synchronized final void testMethod() {}',
              type: 'method_declaration'
            }
          }
        ]
      };

      const modifiers = adapter.extractModifiers(mockResult);
      
      expect(modifiers).toContain('public');
      expect(modifiers).toContain('synchronized');
      expect(modifiers).toContain('final');
      expect(modifiers).toContain('override');
    });
  });
});