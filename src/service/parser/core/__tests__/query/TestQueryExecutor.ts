import Parser from 'tree-sitter';
import { QueryPattern, QueryMatch } from '../../query/TreeSitterQueryExecutor';

/**
 * 测试查询执行器
 * 专门用于测试环境的模拟查询结果生成
 */
export class TestQueryExecutor {
  /**
   * 为测试环境创建模拟查询结果
   * @param ast AST节点
   * @param pattern 查询模式
   * @returns 模拟查询结果
   */
  static createMockResults(ast: Parser.SyntaxNode, pattern: QueryPattern): QueryMatch[] {
    const results: QueryMatch[] = [];

    // 检查是否为空AST
    if ((ast as any)._stableId === 'empty_ast') {
      return []; // 空AST应该返回空结果
    }

    // 检查是否为错误AST
    if ((ast as any)._stableId === 'error_ast') {
      throw new Error('Simulated query error for testing');
    }

    // 根据查询类型创建模拟结果
    if (pattern.name.includes('functions')) {
      results.push(this.createMockFunctionNode(ast));
    }

    if (pattern.name.includes('classes')) {
      results.push(this.createMockClassNode(ast));
    }

    if (pattern.name.includes('imports')) {
      results.push(this.createMockImportNode(ast));
    }

    if (pattern.name.includes('exports')) {
      results.push(this.createMockExportNode(ast));
    }

    if (pattern.name.includes('methods')) {
      results.push(this.createMockMethodNode(ast));
    }

    if (pattern.name.includes('interfaces')) {
      results.push(this.createMockInterfaceNode(ast));
    }

    if (pattern.name.includes('types')) {
      results.push(this.createMockTypeNode(ast));
    }

    if (pattern.name.includes('properties')) {
      results.push(this.createMockPropertyNode(ast));
    }

    if (pattern.name.includes('variables')) {
      results.push(this.createMockVariableNode(ast));
    }

    return results;
  }

  /**
   * 创建模拟函数节点
   */
  private static createMockFunctionNode(ast: Parser.SyntaxNode): QueryMatch {
    const mockFunctionNode = {
      type: 'function_declaration',
      startPosition: { row: 1, column: 0 },
      endPosition: { row: 3, column: 1 },
      startIndex: 0,
      endIndex: 50,
      text: 'function mockFunction() { return 1; }',
      parent: ast,
      children: [],
      tree: ast.tree,
      id: 0,
      typeId: 0,
      grammarId: 0
    } as unknown as Parser.SyntaxNode;

    return {
      node: mockFunctionNode,
      captures: { function: mockFunctionNode },
      location: this.getNodeLocation(mockFunctionNode)
    };
  }

  /**
   * 创建模拟类节点
   */
  private static createMockClassNode(ast: Parser.SyntaxNode): QueryMatch {
    const mockClassNode = {
      type: 'class_declaration',
      startPosition: { row: 5, column: 0 },
      endPosition: { row: 8, column: 1 },
      startIndex: 52,
      endIndex: 120,
      text: 'class MockClass { method() { return 2; } }',
      parent: ast,
      children: [],
      tree: ast.tree,
      id: 1,
      typeId: 1,
      grammarId: 1
    } as unknown as Parser.SyntaxNode;

    return {
      node: mockClassNode,
      captures: { class: mockClassNode },
      location: this.getNodeLocation(mockClassNode)
    };
  }

  /**
   * 创建模拟导入节点
   */
  private static createMockImportNode(ast: Parser.SyntaxNode): QueryMatch {
    const mockImportNode = {
      type: 'import_statement',
      startPosition: { row: 0, column: 0 },
      endPosition: { row: 0, column: 30 },
      startIndex: 0,
      endIndex: 30,
      text: 'import { something } from "module";',
      parent: ast,
      children: [],
      tree: ast.tree,
      id: 2,
      typeId: 2,
      grammarId: 2
    } as unknown as Parser.SyntaxNode;

    return {
      node: mockImportNode,
      captures: { import: mockImportNode },
      location: this.getNodeLocation(mockImportNode)
    };
  }

  /**
   * 创建模拟导出节点
   */
  private static createMockExportNode(ast: Parser.SyntaxNode): QueryMatch {
    const mockExportNode = {
      type: 'export_statement',
      startPosition: { row: 10, column: 0 },
      endPosition: { row: 10, column: 25 },
      startIndex: 150,
      endIndex: 175,
      text: 'export default function() {}',
      parent: ast,
      children: [],
      tree: ast.tree,
      id: 3,
      typeId: 3,
      grammarId: 3
    } as unknown as Parser.SyntaxNode;

    return {
      node: mockExportNode,
      captures: { export: mockExportNode },
      location: this.getNodeLocation(mockExportNode)
    };
  }

  /**
   * 创建模拟方法节点
   */
  private static createMockMethodNode(ast: Parser.SyntaxNode): QueryMatch {
    const mockMethodNode = {
      type: 'method_definition',
      startPosition: { row: 6, column: 2 },
      endPosition: { row: 6, column: 25 },
      startIndex: 70,
      endIndex: 93,
      text: 'method() { return 2; }',
      parent: ast,
      children: [],
      tree: ast.tree,
      id: 4,
      typeId: 4,
      grammarId: 4
    } as unknown as Parser.SyntaxNode;

    return {
      node: mockMethodNode,
      captures: { method: mockMethodNode },
      location: this.getNodeLocation(mockMethodNode)
    };
  }

  /**
   * 创建模拟接口节点
   */
  private static createMockInterfaceNode(ast: Parser.SyntaxNode): QueryMatch {
    const mockInterfaceNode = {
      type: 'interface_declaration',
      startPosition: { row: 12, column: 0 },
      endPosition: { row: 14, column: 1 },
      startIndex: 200,
      endIndex: 250,
      text: 'interface MockInterface { prop: string; }',
      parent: ast,
      children: [],
      tree: ast.tree,
      id: 5,
      typeId: 5,
      grammarId: 5
    } as unknown as Parser.SyntaxNode;

    return {
      node: mockInterfaceNode,
      captures: { interface: mockInterfaceNode },
      location: this.getNodeLocation(mockInterfaceNode)
    };
  }

  /**
   * 创建模拟类型节点
   */
  private static createMockTypeNode(ast: Parser.SyntaxNode): QueryMatch {
    const mockTypeNode = {
      type: 'type_alias_declaration',
      startPosition: { row: 15, column: 0 },
      endPosition: { row: 15, column: 30 },
      startIndex: 251,
      endIndex: 281,
      text: 'type MockType = string | number;',
      parent: ast,
      children: [],
      tree: ast.tree,
      id: 6,
      typeId: 6,
      grammarId: 6
    } as unknown as Parser.SyntaxNode;

    return {
      node: mockTypeNode,
      captures: { type: mockTypeNode },
      location: this.getNodeLocation(mockTypeNode)
    };
  }

  /**
   * 创建模拟属性节点
   */
  private static createMockPropertyNode(ast: Parser.SyntaxNode): QueryMatch {
    const mockPropertyNode = {
      type: 'property_definition',
      startPosition: { row: 7, column: 4 },
      endPosition: { row: 7, column: 15 },
      startIndex: 95,
      endIndex: 106,
      text: 'property: string',
      parent: ast,
      children: [],
      tree: ast.tree,
      id: 7,
      typeId: 7,
      grammarId: 7
    } as unknown as Parser.SyntaxNode;

    return {
      node: mockPropertyNode,
      captures: { property: mockPropertyNode },
      location: this.getNodeLocation(mockPropertyNode)
    };
  }

  /**
   * 创建模拟变量节点
   */
  private static createMockVariableNode(ast: Parser.SyntaxNode): QueryMatch {
    const mockVariableNode = {
      type: 'variable_declaration',
      startPosition: { row: 2, column: 0 },
      endPosition: { row: 2, column: 20 },
      startIndex: 51,
      endIndex: 71,
      text: 'const variable = 42;',
      parent: ast,
      children: [],
      tree: ast.tree,
      id: 8,
      typeId: 8,
      grammarId: 8
    } as unknown as Parser.SyntaxNode;

    return {
      node: mockVariableNode,
      captures: { variable: mockVariableNode },
      location: this.getNodeLocation(mockVariableNode)
    };
  }

  /**
   * 获取节点位置
   */
  private static getNodeLocation(node: Parser.SyntaxNode): QueryMatch['location'] {
    return {
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      startColumn: node.startPosition.column + 1,
      endColumn: node.endPosition.column + 1
    };
  }

  /**
   * 检查是否为测试环境
   * @param language 语言对象
   * @returns 是否为测试环境
   */
  static isTestEnvironment(language: any): boolean {
    return language && language.query && typeof language.query === 'function';
  }
}