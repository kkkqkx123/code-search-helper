import Parser from 'tree-sitter';
import { FallbackExtractor } from '../FallbackExtractor';
import { TreeSitterUtils } from '../TreeSitterUtils';

// Mock TreeSitterQueryFacade
jest.mock('../../core/query/TreeSitterQueryFacade', () => ({
  TreeSitterQueryFacade: {
    findFunctions: jest.fn(),
    findClasses: jest.fn(),
    findImports: jest.fn(),
  }
}));

describe('FallbackExtractor', () => {
  let mockAST: Parser.SyntaxNode;

  beforeEach(() => {
    // Create a mock AST node
    mockAST = {
      id: 1,
      type: 'program',
      startIndex: 0,
      endIndex: 100,
      startPosition: { row: 0, column: 0 },
      endPosition: { row: 10, column: 0 },
      text: 'function test() { return "hello"; }',
      children: [],
      parent: null,
      childForFieldName: jest.fn(),
    } as any;
  });

  describe('基础工具方法', () => {
    it('应该正确提取节点文本', () => {
      const sourceCode = 'function test() { return "hello"; }';
      const text = FallbackExtractor.getNodeText(mockAST, sourceCode);
      expect(text).toBe(sourceCode);
    });

    it('应该正确获取节点位置', () => {
      const location = FallbackExtractor.getNodeLocation(mockAST);
      expect(location).toEqual({
        startLine: 1,
        endLine: 11,
        startColumn: 1,
        endColumn: 1,
      });
    });

    it('应该生成片段ID', () => {
      const content = 'function test() { return "hello"; }';
      const snippetId = TreeSitterUtils.generateSnippetId(content, 5);
      expect(snippetId).toMatch(/^snippet_5_[a-z0-9]+$/);
    });

    it('应该生成简单哈希', () => {
      const hash = TreeSitterUtils.simpleHash('test');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('语言检测', () => {
    it('应该从AST检测语言', () => {
      const mockASTWithLanguage = {
        ...mockAST,
        tree: {
          language: {
            name: 'javascript'
          }
        }
      } as any;

      // 由于这是私有方法，我们通过公共方法间接测试
      const language = (FallbackExtractor as any).detectLanguageFromAST(mockASTWithLanguage);
      expect(language).toBe('javascript');
    });

    it('应该处理未知语言', () => {
      const mockASTWithUnknownLanguage = {
        ...mockAST,
        tree: {
          language: {
            name: 'unknown_language'
          }
        }
      } as any;

      const language = (FallbackExtractor as any).detectLanguageFromAST(mockASTWithUnknownLanguage);
      expect(language).toBe('unknown_language');
    });
  });

  describe('节点名称提取', () => {
    it('应该为JavaScript函数提取名称', () => {
      const functionNode = {
        ...mockAST,
        type: 'function_declaration',
        children: [
          {
            type: 'identifier',
            text: 'testFunction'
          }
        ]
      } as any;

      const name = FallbackExtractor.getNodeName(functionNode, 'javascript');
      expect(name).toBe('testFunction');
    });

    it('应该为TypeScript类提取名称', () => {
      const classNode = {
        ...mockAST,
        type: 'class_declaration',
        children: [
          {
            type: 'type_identifier',
            text: 'TestClass'
          }
        ]
      } as any;

      const name = FallbackExtractor.getNodeName(classNode, 'typescript');
      expect(name).toBe('TestClass');
    });

    it('应该回退到节点类型', () => {
      const unknownNode = {
        ...mockAST,
        type: 'unknown_type',
        children: []
      } as any;

      const name = FallbackExtractor.getNodeName(unknownNode);
      expect(name).toBe('unknown_type');
    });
  });

  describe('回退提取功能', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('应该在查询失败时使用回退机制', async () => {
      const { TreeSitterQueryFacade } = require('../../core/query/TreeSitterQueryFacade');
      TreeSitterQueryFacade.findFunctions.mockRejectedValue(new Error('Query failed'));

      const functions = await FallbackExtractor.extractFunctions(mockAST, 'javascript');
      expect(Array.isArray(functions)).toBe(true);
      expect(TreeSitterQueryFacade.findFunctions).toHaveBeenCalledWith(mockAST, 'javascript');
    });

    it('应该在查询成功时返回结果', async () => {
      const mockFunctions = [{ type: 'function_declaration' }] as any;
      const { TreeSitterQueryFacade } = require('../../core/query/TreeSitterQueryFacade');
      TreeSitterQueryFacade.findFunctions.mockResolvedValue(mockFunctions);

      const functions = await FallbackExtractor.extractFunctions(mockAST, 'javascript');
      expect(functions).toBe(mockFunctions);
      expect(TreeSitterQueryFacade.findFunctions).toHaveBeenCalledWith(mockAST, 'javascript');
    });
  });

  describe('导入提取', () => {
    it('应该提取导入文本', () => {
      const sourceCode = 'import { Component } from "react";\nimport axios from "axios";';
      const importNode = {
        ...mockAST,
        type: 'import_statement',
        startIndex: 0,
        endIndex: 34,
        text: 'import { Component } from "react";'
      } as any;

      const imports = FallbackExtractor.extractImportTexts(importNode, sourceCode);
      expect(imports).toHaveLength(1);
      expect(imports[0]).toBe('import { Component } from "react";');
    });

    it('应该提取导入节点', () => {
      const importNode = {
        ...mockAST,
        type: 'import_statement'
      } as any;

      const imports = FallbackExtractor.extractImportNodes(importNode);
      expect(Array.isArray(imports)).toBe(true);
    });
  });
});