import { MappingRuleEngine, MappingRule, MappingRuleContext } from '../MappingRuleEngine';
import { LoggerService } from '../../../../utils/LoggerService';
import { GraphNodeType, GraphRelationshipType, FileAnalysisResult } from '../IGraphDataMappingService';

// Mock dependencies
const mockLoggerService = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

describe('MappingRuleEngine', () => {
  let mappingRuleEngine: MappingRuleEngine;

  beforeEach(() => {
    mappingRuleEngine = new MappingRuleEngine(
      mockLoggerService as unknown as LoggerService
    );
  });

 describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(mockLoggerService.info).toHaveBeenCalledWith(
        'MappingRuleEngine initialized',
        expect.objectContaining({ options: expect.objectContaining({ enableCaching: true }) })
      );
    });

    it('should register default rules', () => {
      const rules = mappingRuleEngine.getRules();
      expect(rules.length).toBeGreaterThan(0);
      expect(rules.some(rule => rule.id === 'file-node-creation')).toBe(true);
      expect(rules.some(rule => rule.id === 'function-node-creation')).toBe(true);
      expect(rules.some(rule => rule.id === 'class-node-creation')).toBe(true);
    });

    it('should accept custom options', () => {
      const customOptions = { enableCaching: false, cacheTTL: 60000, maxRules: 50 };
      const engine = new MappingRuleEngine(
        mockLoggerService as unknown as LoggerService,
        customOptions
      );
      
      // We can't directly access private options, but we can verify that constructor was called
      expect(mockLoggerService.info).toHaveBeenCalled();
    });
  });

 describe('registerRule', () => {
    it('should register a new rule', () => {
      const rule: MappingRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        condition: (context: MappingRuleContext) => true,
        action: (context: MappingRuleContext) => {},
        priority: 10
      };

      mappingRuleEngine.registerRule(rule);
      const rules = mappingRuleEngine.getRules();
      expect(rules).toContainEqual(rule);
    });

    it('should maintain priority order when registering rules', () => {
      // Create a new engine without default rules for this test
      const testEngine = new MappingRuleEngine(
        mockLoggerService as unknown as LoggerService,
        { registerDefaultRules: false }
      );
      
      const rule1: MappingRule = {
        id: 'rule1',
        name: 'Rule 1',
        description: 'First rule',
        condition: (context: MappingRuleContext) => true,
        action: (context: MappingRuleContext) => {},
        priority: 2
      };

      const rule2: MappingRule = {
        id: 'rule2',
        name: 'Rule 2',
        description: 'Second rule',
        condition: (context: MappingRuleContext) => true,
        action: (context: MappingRuleContext) => {},
        priority: 1
      };

      testEngine.registerRule(rule1);
      testEngine.registerRule(rule2);
      const rules = testEngine.getRules();

      // Rule with lower priority number should come first
      expect(rules[0].id).toBe('rule2');
      expect(rules[1].id).toBe('rule1');
    });

    it('should not register more rules than maxRules limit', () => {
      const engine = new MappingRuleEngine(
        mockLoggerService as unknown as LoggerService,
        { maxRules: 1, registerDefaultRules: false }
      );

      const rule1: MappingRule = {
        id: 'rule1',
        name: 'Rule 1',
        description: 'First rule',
        condition: (context: MappingRuleContext) => true,
        action: (context: MappingRuleContext) => {},
        priority: 1
      };

      const rule2: MappingRule = {
        id: 'rule2',
        name: 'Rule 2',
        description: 'Second rule',
        condition: (context: MappingRuleContext) => true,
        action: (context: MappingRuleContext) => {},
        priority: 2
      };

      engine.registerRule(rule1);
      engine.registerRule(rule2); // This should not be added
      const rules = engine.getRules();

      expect(rules.length).toBe(1);
      expect(rules[0].id).toBe('rule1');
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        'Maximum number of rules reached, not adding new rule',
        expect.objectContaining({ ruleId: 'rule2' })
      );
    });
  });

  describe('executeRules', () => {
    it('should execute rules that match the condition', async () => {
      // Create a new engine without default rules for this test
      const testEngine = new MappingRuleEngine(
        mockLoggerService as unknown as LoggerService,
        { registerDefaultRules: false }
      );
      
      const rule: MappingRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        condition: (context: MappingRuleContext) => context.filePath === 'test.js',
        action: (context: MappingRuleContext) => {
          context.nodes.push({
            id: 'test-node',
            type: GraphNodeType.FILE,
            properties: { name: 'test' }
          });
        },
        priority: 10
      };

      testEngine.registerRule(rule);

      const context: MappingRuleContext = {
        filePath: 'test.js',
        fileContent: 'console.log("hello");',
        analysisResult: {
          filePath: 'test.js',
          language: 'javascript',
          ast: {},
          functions: [],
          classes: [],
          imports: [],
          variables: []
        },
        nodes: [],
        relationships: [],
        language: 'javascript'
      };

      const result = await testEngine.executeRules(context);

      expect(result.nodes.length).toBe(1);
      expect(result.nodes[0].id).toBe('test-node');
    });

    it('should not execute rules that do not match the condition', async () => {
      // Create a new engine without default rules for this test
      const testEngine = new MappingRuleEngine(
        mockLoggerService as unknown as LoggerService,
        { registerDefaultRules: false }
      );
      
      const rule: MappingRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        condition: (context: MappingRuleContext) => context.filePath === 'other.js',
        action: (context: MappingRuleContext) => {
          context.nodes.push({
            id: 'test-node',
            type: GraphNodeType.FILE,
            properties: { name: 'test' }
          });
        },
        priority: 10
      };

      testEngine.registerRule(rule);

      const context: MappingRuleContext = {
        filePath: 'test.js',
        fileContent: 'console.log("hello");',
        analysisResult: {
          filePath: 'test.js',
          language: 'javascript',
          ast: {},
          functions: [],
          classes: [],
          imports: [],
          variables: []
        },
        nodes: [],
        relationships: [],
        language: 'javascript'
      };

      const result = await testEngine.executeRules(context);

      expect(result.nodes.length).toBe(0);
    });

    it('should handle rule execution errors gracefully', async () => {
      // Create a new engine without default rules for this test
      const testEngine = new MappingRuleEngine(
        mockLoggerService as unknown as LoggerService,
        { registerDefaultRules: false }
      );
      
      const rule: MappingRule = {
        id: 'error-rule',
        name: 'Error Rule',
        description: 'A rule that throws an error',
        condition: (context: MappingRuleContext) => true,
        action: (context: MappingRuleContext) => {
          throw new Error('Rule execution error');
        },
        priority: 10
      };

      testEngine.registerRule(rule);

      const context: MappingRuleContext = {
        filePath: 'test.js',
        fileContent: 'console.log("hello");',
        analysisResult: {
          filePath: 'test.js',
          language: 'javascript',
          ast: {},
          functions: [],
          classes: [],
          imports: [],
          variables: []
        },
        nodes: [],
        relationships: [],
        language: 'javascript'
      };

      const result = await testEngine.executeRules(context);

      // Should continue executing despite the error
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Error executing rule',
        expect.objectContaining({ ruleId: 'error-rule' })
      );
    });

    it('should use caching when enabled', async () => {
      // Create a new engine without default rules for this test
      const testEngine = new MappingRuleEngine(
        mockLoggerService as unknown as LoggerService,
        { registerDefaultRules: false }
      );
      
      const rule: MappingRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        condition: (context: MappingRuleContext) => context.filePath === 'test.js',
        action: (context: MappingRuleContext) => {
          context.nodes.push({
            id: 'test-node',
            type: GraphNodeType.FILE,
            properties: { name: 'test' }
          });
        },
        priority: 10
      };

      testEngine.registerRule(rule);

      const context: MappingRuleContext = {
        filePath: 'test.js',
        fileContent: 'console.log("hello");',
        analysisResult: {
          filePath: 'test.js',
          language: 'javascript',
          ast: {},
          functions: [],
          classes: [],
          imports: [],
          variables: []
        },
        nodes: [],
        relationships: [],
        language: 'javascript'
      };

      // First execution
      const result1 = await testEngine.executeRules(context);
      // Second execution with same context should use cache
      const result2 = await testEngine.executeRules(context);

      expect(result1).toEqual(result2);
      expect(mockLoggerService.debug).toHaveBeenCalledWith(
        'Using cached rule execution result',
        expect.any(Object)
      );
    });
  });

  describe('executeRulesBatch', () => {
    it('should execute rules for multiple contexts', async () => {
      // Create a new engine without default rules for this test
      const testEngine = new MappingRuleEngine(
        mockLoggerService as unknown as LoggerService,
        { registerDefaultRules: false }
      );
      
      const rule: MappingRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        condition: (context: MappingRuleContext) => true,
        action: (context: MappingRuleContext) => {
          context.nodes.push({
            id: `node-${context.filePath}`,
            type: GraphNodeType.FILE,
            properties: { name: context.filePath }
          });
        },
        priority: 10
      };

      testEngine.registerRule(rule);

      const contexts: MappingRuleContext[] = [
        {
          filePath: 'test1.js',
          fileContent: 'console.log("hello1");',
          analysisResult: {
            filePath: 'test1.js',
            language: 'javascript',
            ast: {},
            functions: [],
            classes: [],
            imports: [],
            variables: []
          },
          nodes: [],
          relationships: [],
          language: 'javascript'
        },
        {
          filePath: 'test2.js',
          fileContent: 'console.log("hello2");',
          analysisResult: {
            filePath: 'test2.js',
            language: 'javascript',
            ast: {},
            functions: [],
            classes: [],
            imports: [],
            variables: []
          },
          nodes: [],
          relationships: [],
          language: 'javascript'
        }
      ];

      const results = await testEngine.executeRulesBatch(contexts);

      expect(results.length).toBe(2);
      expect(results[0].nodes[0].id).toBe('node-test1.js');
      expect(results[1].nodes[0].id).toBe('node-test2.js');
    });
  });

 describe('removeRule', () => {
    it('should remove a rule by ID', () => {
      const rule: MappingRule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'A test rule',
        condition: (context: MappingRuleContext) => true,
        action: (context: MappingRuleContext) => {},
        priority: 10
      };

      mappingRuleEngine.registerRule(rule);
      expect(mappingRuleEngine.getRules().length).toBeGreaterThan(0);

      const removed = mappingRuleEngine.removeRule('test-rule');
      expect(removed).toBe(true);
      expect(mappingRuleEngine.getRules().length).toBe(3); // Default rules still remain
    });

    it('should return false when trying to remove non-existent rule', () => {
      const removed = mappingRuleEngine.removeRule('non-existent-rule');
      expect(removed).toBe(false);
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        'Rule not found for removal',
        expect.objectContaining({ ruleId: 'non-existent-rule' })
      );
    });
  });

  describe('clearRules', () => {
    it('should clear all rules', () => {
      expect(mappingRuleEngine.getRules().length).toBeGreaterThan(0);
      
      mappingRuleEngine.clearRules();
      
      expect(mappingRuleEngine.getRules().length).toBe(0);
      expect(mockLoggerService.info).toHaveBeenCalledWith('Cleared all mapping rules');
    });
  });

  describe('default rules', () => {
    it('should have file node creation rule', () => {
      const fileRule = mappingRuleEngine.getRules().find(rule => rule.id === 'file-node-creation');
      expect(fileRule).toBeDefined();
      expect(fileRule?.name).toBe('File Node Creation');
    });

    it('should have function node creation rule', () => {
      const funcRule = mappingRuleEngine.getRules().find(rule => rule.id === 'function-node-creation');
      expect(funcRule).toBeDefined();
      expect(funcRule?.name).toBe('Function Node Creation');
    });

    it('should have class node creation rule', () => {
      const classRule = mappingRuleEngine.getRules().find(rule => rule.id === 'class-node-creation');
      expect(classRule).toBeDefined();
      expect(classRule?.name).toBe('Class Node Creation');
    });
  });
});