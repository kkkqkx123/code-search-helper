import Parser from 'tree-sitter';
import { FallbackExtractor } from '../FallbackExtractor';

// Mock TreeSitterQueryFacade
jest.mock('../../core/query/TreeSitterQueryFacade', () => ({
  TreeSitterQueryFacade: {
    findFunctions: jest.fn(),
    findClasses: jest.fn(),
    findImports: jest.fn(),
    findExports: jest.fn(),
  }
}));

// Mock LoggerService
jest.mock('../../../../utils/LoggerService', () => ({
  LoggerService: jest.fn().mockImplementation(() => ({
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }))
}));

describe('FallbackExtractor', () => {
  let mockAST: Parser.SyntaxNode;
  let mockTree: any;

  beforeEach(() => {
    // 创建模拟的 AST 节点
    mockTree = {
      language: {
        name: 'typescript'
      }
    };

    mockAST = {
      tree: mockTree,
      startIndex: 0,
      endIndex: 100,
      startPosition: { row: 0, column: 0 },
      endPosition: { row: 10, column: 0 },
      text: 'mock text',
      type: 'function_declaration',
      children: [],
      childForFieldName: jest.fn(),
    } as any;

    // 清除所有 mock 调用
    jest.clearAllMocks();
  });

  describe('detectLanguageFromAST', () => {
    test('应该检测并返回标准化的语言名称', () => {
      const result = FallbackExtractor.detectLanguageFromAST(mockAST);
      expect(result).toBe('typescript');
    });

    test('应该处理 c_sharp 语言映射', () => {
      mockTree.language.name = 'c_sharp';
      const result = FallbackExtractor.detectLanguageFromAST(mockAST);
      expect(result).toBe('csharp');
    });

    test('应该处理未知语言', () => {
      mockTree.language.name = 'unknown_language';
      const result = FallbackExtractor.detectLanguageFromAST(mockAST);
      expect(result).toBe('unknown_language');
    });

    test('应该处理没有语言信息的 AST', () => {
      mockAST = {} as any;
      const result = FallbackExtractor.detectLanguageFromAST(mockAST);
      expect(result).toBeNull();
    });
  });

  describe('特殊语言处理', () => {
    test('配置文件语言应该跳过函数提取', async () => {
      mockTree.language.name = 'json';
      const { TreeSitterQueryFacade } = require('../../core/query/TreeSitterQueryFacade');
      
      const result = await FallbackExtractor.extractFunctions(mockAST);
      
      expect(result).toEqual([]);
      expect(TreeSitterQueryFacade.findFunctions).not.toHaveBeenCalled();
    });

    test('前端语言应该正常提取函数', async () => {
      mockTree.language.name = 'tsx';
      const { TreeSitterQueryFacade } = require('../../core/query/TreeSitterQueryFacade');
      TreeSitterQueryFacade.findFunctions.mockResolvedValue([]);
      
      await FallbackExtractor.extractFunctions(mockAST);
      
      expect(TreeSitterQueryFacade.findFunctions).toHaveBeenCalledWith(mockAST, 'tsx');
    });

    test('配置文件语言应该跳过类提取', async () => {
      mockTree.language.name = 'yaml';
      const { TreeSitterQueryFacade } = require('../../core/query/TreeSitterQueryFacade');
      
      const result = await FallbackExtractor.extractClasses(mockAST);
      
      expect(result).toEqual([]);
      expect(TreeSitterQueryFacade.findClasses).not.toHaveBeenCalled();
    });

    test('标记语言应该跳过导入提取', async () => {
      mockTree.language.name = 'html';
      const { TreeSitterQueryFacade } = require('../../core/query/TreeSitterQueryFacade');
      
      const result = await FallbackExtractor.extractImports(mockAST);
      
      expect(result).toEqual([]);
      expect(TreeSitterQueryFacade.findImports).not.toHaveBeenCalled();
    });

    test('后端语言应该跳过导出提取', async () => {
      mockTree.language.name = 'python';
      const { TreeSitterQueryFacade } = require('../../core/query/TreeSitterQueryFacade');
      
      const result = await FallbackExtractor.extractExports(mockAST);
      
      expect(result).toEqual([]);
      expect(TreeSitterQueryFacade.findExports).not.toHaveBeenCalled();
    });

    test('JavaScript 应该正常提取导出', async () => {
      mockTree.language.name = 'javascript';
      const { TreeSitterQueryFacade } = require('../../core/query/TreeSitterQueryFacade');
      TreeSitterQueryFacade.findExports.mockResolvedValue([]);
      
      await FallbackExtractor.extractExports(mockAST);
      
      expect(TreeSitterQueryFacade.findExports).toHaveBeenCalledWith(mockAST, 'javascript');
    });
  });

  describe('getNodeText', () => {
    test('应该返回节点的文本内容', () => {
      const sourceCode = 'function test() { return "hello"; }';
      const result = FallbackExtractor.getNodeText(mockAST, sourceCode);
      expect(result).toBe(sourceCode.substring(0, 100));
    });
  });

  describe('getNodeLocation', () => {
    test('应该返回节点的位置信息（从1开始）', () => {
      const result = FallbackExtractor.getNodeLocation(mockAST);
      expect(result).toEqual({
        startLine: 1,
        endLine: 11,
        startColumn: 1,
        endColumn: 1,
      });
    });
  });

  describe('getNodeName', () => {
    test('应该根据语言提取节点名称', () => {
      const mockNode = {
        type: 'function_declaration',
        children: [
          { type: 'identifier', text: 'testFunction' }
        ],
        childForFieldName: jest.fn(),
      } as any;

      const result = FallbackExtractor.getNodeName(mockNode, 'javascript');
      expect(result).toBe('testFunction');
    });

    test('应该处理类声明节点', () => {
      const mockNode = {
        type: 'class_declaration',
        children: [
          { type: 'type_identifier', text: 'TestClass' }
        ],
        childForFieldName: jest.fn(),
      } as any;

      const result = FallbackExtractor.getNodeName(mockNode, 'typescript');
      expect(result).toBe('TestClass');
    });

    test('应该回退到节点类型', () => {
      const mockNode = {
        type: 'unknown_node',
        children: [],
        childForFieldName: jest.fn(),
      } as any;

      const result = FallbackExtractor.getNodeName(mockNode, 'javascript');
      expect(result).toBe('unknown_node');
    });
  });

  describe('extractNodesByTypes', () => {
    test('应该按类型提取节点', () => {
      const mockChild1 = { type: 'function_declaration', children: [], tree: mockTree } as any;
      const mockChild2 = { type: 'variable_declaration', children: [], tree: mockTree } as any;
      const mockChild3 = { type: 'function_declaration', children: [], tree: mockTree } as any;

      mockAST.children = [mockChild1, mockChild2, mockChild3];
      // 修改根节点类型，避免与子节点类型冲突
      mockAST.type = 'program';

      const types = new Set(['function_declaration']);
      const result = FallbackExtractor.extractNodesByTypes(mockAST, types);

      expect(result).toHaveLength(2);
      expect(result).toContain(mockChild1);
      expect(result).toContain(mockChild3);
    });
  });

  describe('同步方法兼容性', () => {
    test('extractImportTexts 应该正常工作', () => {
      const mockImportNode = {
        type: 'import_statement',
        text: 'import { test } from "test";',
        tree: mockTree
      } as any;

      mockAST.children = [mockImportNode];

      const sourceCode = 'import { test } from "test";';
      const result = FallbackExtractor.extractImportTexts(mockAST, sourceCode);

      expect(result).toContain('import { test } from "test";');
    });

    test('extractImportNodes 应该正常工作', () => {
      const mockImportNode = {
        type: 'import_statement',
        children: [],
        tree: mockTree
      } as any;

      mockAST.children = [mockImportNode];

      const result = FallbackExtractor.extractImportNodes(mockAST);

      expect(result).toContain(mockImportNode);
    });
  });
});