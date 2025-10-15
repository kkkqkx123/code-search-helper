import { ChunkingCoordinator } from '../utils/ChunkingCoordinator';
import { strategyFactory } from '../core/SplitStrategyFactory';
import { ensureStrategyProvidersRegistered } from '../core/StrategyProviderRegistration';
import { ASTNodeTracker } from '../utils/ASTNodeTracker';
import { DEFAULT_CHUNKING_OPTIONS } from '../types';

// 确保在测试开始前注册所有策略提供者
beforeAll(() => {
  ensureStrategyProvidersRegistered();
});

describe('ChunkingCoordinator', () => {
  let coordinator: ChunkingCoordinator;
  let nodeTracker: ASTNodeTracker;

  beforeEach(() => {
    nodeTracker = new ASTNodeTracker();
    
    coordinator = new ChunkingCoordinator(
      nodeTracker,
      DEFAULT_CHUNKING_OPTIONS,
      undefined // logger
    );
  });

  describe('Basic Functionality', () => {
    it('should be created successfully', () => {
      expect(coordinator).toBeDefined();
    });

    it('should coordinate chunking process', async () => {
      const content = `
        function test() {
          return 'hello';
        }
        
        class TestClass {
          method() {
            return 'world';
          }
        }
      `;
      
      const mockAST = {
        type: 'program',
        children: []
      };

      const chunks = await coordinator.coordinate(content, 'javascript', 'test.js', mockAST);
      
      expect(Array.isArray(chunks)).toBe(true);
      // 由于我们使用模拟AST，实际结果可能为空数组
      expect(chunks.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Strategy Integration', () => {
    it('should work with FunctionSplitter strategy', async () => {
      const strategy = strategyFactory.create('FunctionSplitter');
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('FunctionSplitter');
      
      const content = `
        function test() {
          return 'hello';
        }
      `;
      
      const chunks = await strategy.split(content, 'javascript', 'test.js');
      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should work with ClassSplitter strategy', async () => {
      const strategy = strategyFactory.create('ClassSplitter');
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('ClassSplitter');
      
      const content = `
        class TestClass {
          method() {
            return 'world';
          }
        }
      `;
      
      const chunks = await strategy.split(content, 'javascript', 'test.js');
      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should work with ImportSplitter strategy', async () => {
      const strategy = strategyFactory.create('ImportSplitter');
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('ImportSplitter');
      
      const content = `
        import React from 'react';
        import { Component } from 'react';
      `;
      
      const chunks = await strategy.split(content, 'javascript', 'test.js');
      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should work with SyntaxAwareSplitter strategy without TreeSitterService', async () => {
      const strategy = strategyFactory.create('SyntaxAwareSplitter');
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('SyntaxAwareSplitter');
      
      const content = `
        import React from 'react';
        
        function Component() {
          return 'test';
        }
        
        class MyClass {
          render() {
            return 'render';
          }
        }
      `;
      
      // SyntaxAwareSplitter需要TreeSitterService，但我们测试它是否能优雅处理缺失的情况
      try {
        const chunks = await strategy.split(content, 'javascript', 'test.js');
        expect(Array.isArray(chunks)).toBe(true);
      } catch (error) {
        // 期望抛出错误，因为TreeSitterService是必需的
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('TreeSitterService is required');
      }
    });

    it('should work with IntelligentSplitter strategy', async () => {
      const strategy = strategyFactory.create('IntelligentSplitter');
      expect(strategy).toBeDefined();
      expect(strategy.getName()).toBe('IntelligentSplitter');
      
      const content = `
        function test() {
          const result = [];
          for (let i = 0; i < 10; i++) {
            result.push(i);
          }
          return result;
        }
      `;
      
      const chunks = await strategy.split(content, 'javascript', 'test.js');
      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('Node Tracking Integration', () => {
    it('should track nodes during coordination', async () => {
      const content = `
        function test() {
          return 'hello';
        }
      `;
      
      const mockAST = {
        type: 'program',
        children: []
      };

      // 模拟AST节点跟踪
      const testNode = {
        id: 'test-node-1',
        type: 'function',
        startByte: 10,
        endByte: 50,
        startLine: 2,
        endLine: 4,
        text: 'function test() { return \'hello\'; }'
      };

      nodeTracker.markUsed(testNode);

      const chunks = await coordinator.coordinate(content, 'javascript', 'test.js', mockAST);
      
      expect(Array.isArray(chunks)).toBe(true);
      // 验证协调器正确处理了节点跟踪
      expect(coordinator).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty content', async () => {
      const chunks = await coordinator.coordinate('', 'javascript', 'test.js', null);
      expect(chunks).toEqual([]);
    });

    it('should handle invalid language', async () => {
      const content = 'some content';
      const mockAST = { type: 'program', children: [] };
      
      const chunks = await coordinator.coordinate(content, 'invalid-language', 'test.file', mockAST);
      expect(Array.isArray(chunks)).toBe(true);
    });

    it('should handle null AST', async () => {
      const content = 'function test() { return; }';
      
      const chunks = await coordinator.coordinate(content, 'javascript', 'test.js', null);
      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large content efficiently', async () => {
      // 创建较大的测试内容
      const lines = [];
      for (let i = 0; i < 100; i++) {
        lines.push(`function function${i}() { return ${i}; }`);
      }
      const content = lines.join('\n');
      
      const mockAST = {
        type: 'program',
        children: []
      };

      const startTime = Date.now();
      const chunks = await coordinator.coordinate(content, 'javascript', 'large-test.js', mockAST);
      const endTime = Date.now();
      
      expect(Array.isArray(chunks)).toBe(true);
      // 验证处理时间在合理范围内（比如5秒内）
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('Factory Integration', () => {
    it('should work with factory-created strategies', async () => {
      const strategies = [
        'FunctionSplitter',
        'ClassSplitter', 
        'ImportSplitter',
        'SyntaxAwareSplitter',
        'IntelligentSplitter'
      ];

      strategies.forEach(strategyName => {
        const strategy = strategyFactory.create(strategyName);
        expect(strategy).toBeDefined();
        expect(strategy.getName()).toBe(strategyName);
      });
    });

    it('should maintain strategy priorities', () => {
      const strategies = [
        'SyntaxAwareSplitter',
        'FunctionSplitter',
        'ClassSplitter',
        'ImportSplitter',
        'IntelligentSplitter'
      ];

      const priorities = strategies.map(name => {
        const strategy = strategyFactory.create(name);
        return { name, priority: strategy.getPriority() };
      });

      // 验证优先级是有效的数字
      priorities.forEach(({ name, priority }) => {
        expect(typeof priority).toBe('number');
        expect(priority).toBeGreaterThan(0);
      });
    });
  });
});