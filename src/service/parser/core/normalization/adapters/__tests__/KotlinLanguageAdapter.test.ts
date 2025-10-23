import { KotlinLanguageAdapter } from '../KotlinLanguageAdapter';
import { StandardizedQueryResult } from '../../types';

describe('KotlinLanguageAdapter', () => {
  let adapter: KotlinLanguageAdapter;

  beforeEach(() => {
    adapter = new KotlinLanguageAdapter();
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

      const results = adapter.normalize([mockResult], 'classes', 'kotlin');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('class');
      expect(results[0].name).toBe('TestClass');
      expect(results[0].startLine).toBe(6); // 从0-based转换为1-based
      expect(results[0].endLine).toBe(11);  // 从0-based转换为1-based
      expect(results[0].content).toBe('TestClass');
      expect(results[0].metadata.language).toBe('kotlin');
    });

    it('should normalize data class query results', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.data_class',
            node: {
              text: 'DataClass',
              startPosition: { row: 2, column: 0 },
              endPosition: { row: 4, column: 0 },
              type: 'class_declaration'
            }
          }
        ]
      };

      // Mock the extractContent method to return the full class text
      jest.spyOn(adapter, 'extractContent').mockReturnValue('data class DataClass(val value: String)');

      const results = adapter.normalize([mockResult], 'classes', 'kotlin');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('class');
      expect(results[0].name).toBe('DataClass');
      expect(results[0].metadata.modifiers).toContain('data');
      
      // Restore the original method
      jest.restoreAllMocks();
    });

    it('should normalize function query results', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.function',
            node: {
              text: 'testFunction',
              startPosition: { row: 8, column: 2 },
              endPosition: { row: 12, column: 2 },
              type: 'function_declaration'
            }
          }
        ]
      };

      const results = adapter.normalize([mockResult], 'functions', 'kotlin');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('function');
      expect(results[0].name).toBe('testFunction');
      expect(results[0].startLine).toBe(9);
      expect(results[0].endLine).toBe(13);
    });

    it('should normalize suspend function query results', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.suspend_function',
            node: {
              text: 'suspendFunction',
              startPosition: { row: 3, column: 2 },
              endPosition: { row: 6, column: 2 },
              type: 'function_declaration'
            }
          }
        ]
      };

      const results = adapter.normalize([mockResult], 'functions', 'kotlin');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('function');
      expect(results[0].name).toBe('suspendFunction');
      expect(results[0].metadata.modifiers).toContain('suspend');
    });

    it('should normalize extension function query results', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.extension_function',
            node: {
              text: 'extensionFunction',
              startPosition: { row: 7, column: 2 },
              endPosition: { row: 10, column: 2 },
              type: 'function_declaration'
            }
          }
        ]
      };

      const results = adapter.normalize([mockResult], 'extensions', 'kotlin');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('function');
      expect(results[0].name).toBe('extensionFunction');
    });

    it('should normalize object declaration query results', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.object',
            node: {
              text: 'SingletonObject',
              startPosition: { row: 1, column: 0 },
              endPosition: { row: 5, column: 0 },
              type: 'object_declaration'
            }
          }
        ]
      };

      const results = adapter.normalize([mockResult], 'objects', 'kotlin');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('class');
      expect(results[0].name).toBe('SingletonObject');
    });

    it('should normalize property query results', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.property',
            node: {
              text: 'testProperty',
              startPosition: { row: 4, column: 2 },
              endPosition: { row: 4, column: 20 },
              type: 'property_declaration'
            }
          }
        ]
      };

      const results = adapter.normalize([mockResult], 'properties', 'kotlin');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('variable');
      expect(results[0].name).toBe('testProperty');
    });

    it('should normalize constructor property query results', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.constructor_property',
            node: {
              text: 'constructorProperty',
              startPosition: { row: 2, column: 15 },
              endPosition: { row: 2, column: 35 },
              type: 'class_parameter'
            }
          }
        ]
      };

      const results = adapter.normalize([mockResult], 'constructors-properties', 'kotlin');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('method');
      expect(results[0].name).toBe('constructorProperty');
    });

    it('should handle complex Kotlin code with modifiers and annotations', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.function',
            node: {
              text: 'complexFunction',
              startPosition: { row: 10, column: 2 },
              endPosition: { row: 15, column: 2 },
              type: 'function_declaration'
            }
          }
        ]
      };

      // Mock the extractContent method to return the full function text
      jest.spyOn(adapter, 'extractContent').mockReturnValue('@Override\n  suspend inline fun complexFunction(): String {\n    // function body\n  }');

      const results = adapter.normalize([mockResult], 'functions', 'kotlin');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('function');
      expect(results[0].name).toBe('complexFunction');
      expect(results[0].metadata.modifiers).toContain('suspend');
      expect(results[0].metadata.modifiers).toContain('inline');
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
                text: '<T : Comparable<T>>'
              })
            }
          }
        ]
      };

      const results = adapter.normalize([mockResult], 'classes', 'kotlin');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('class');
      expect(results[0].name).toBe('GenericClass');
      expect(results[0].metadata.extra?.hasGenerics).toBe(true);
    });
  });

  describe('getSupportedQueryTypes', () => {
    it('should return all supported query types', () => {
      const supportedTypes = adapter.getSupportedQueryTypes();
      
      expect(supportedTypes).toContain('classes-functions');
      expect(supportedTypes).toContain('constructors-properties');
      expect(supportedTypes).toContain('functions');
      expect(supportedTypes).toContain('classes');
      expect(supportedTypes).toContain('properties');
      expect(supportedTypes).toContain('variables');
      expect(supportedTypes).toContain('types');
      expect(supportedTypes).toContain('interfaces');
      expect(supportedTypes).toContain('enums');
      expect(supportedTypes).toContain('objects');
      expect(supportedTypes).toContain('constructors');
      expect(supportedTypes).toContain('extensions');
    });
  });

  describe('mapNodeType', () => {
    it('should map Kotlin node types to standard types', () => {
      expect(adapter.mapNodeType('class_declaration')).toBe('class');
      expect(adapter.mapNodeType('object_declaration')).toBe('class');
      expect(adapter.mapNodeType('function_declaration')).toBe('function');
      expect(adapter.mapNodeType('property_declaration')).toBe('variable');
      expect(adapter.mapNodeType('type_alias')).toBe('type');
      expect(adapter.mapNodeType('primary_constructor')).toBe('method');
      expect(adapter.mapNodeType('if_statement')).toBe('control-flow');
      expect(adapter.mapNodeType('when_expression')).toBe('control-flow');
      expect(adapter.mapNodeType('call_expression')).toBe('expression');
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

      const functionResult = {
        captures: [
          {
            name: 'name.definition.function',
            node: { text: 'testFunction' }
          }
        ]
      };

      expect(adapter.extractName(classResult)).toBe('TestClass');
      expect(adapter.extractName(functionResult)).toBe('testFunction');
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
            name: 'name.definition.function',
            node: {
              type: 'function_declaration',
              text: 'fun simpleFunction() {}',
              startPosition: { row: 1, column: 0 },
              endPosition: { row: 1, column: 25 }
            }
          }
        ]
      };

      const complexResult = {
        captures: [
          {
            name: 'name.definition.function',
            node: {
              type: 'function_declaration',
              text: 'suspend inline fun complexFunction(): String {\n  try {\n    // complex logic\n  } catch (e: Exception) {\n    // error handling\n  }\n}',
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
    it('should extract dependencies from type references', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.function',
            node: {
              text: 'processData',
              type: 'function_declaration',
              children: [
                {
                  type: 'user_type',
                  text: 'ArrayList'
                }
              ]
            }
          }
        ]
      };

      const dependencies = adapter.extractDependencies(mockResult);
      
      expect(dependencies).toContain('ArrayList');
    });
  });

  describe('extractModifiers', () => {
    it('should extract Kotlin modifiers and annotations', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.function',
            node: {
              text: 'suspend inline fun testFunction() {}',
              type: 'function_declaration'
            }
          }
        ]
      };

      const modifiers = adapter.extractModifiers(mockResult);
      
      expect(modifiers).toContain('suspend');
      expect(modifiers).toContain('inline');
    });

    it('should extract class modifiers', () => {
      const mockResult = {
        captures: [
          {
            name: 'name.definition.data_class',
            node: {
              text: 'data class TestDataClass(val value: String)',
              type: 'class_declaration'
            }
          }
        ]
      };

      const modifiers = adapter.extractModifiers(mockResult);
      
      expect(modifiers).toContain('data');
    });
  });
});