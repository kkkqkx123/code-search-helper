import Parser from 'tree-sitter';

/**
 * TreeSitter 基础工具类
 * 提供语言无关的基础 AST 操作功能
 * 作为查询系统的回退机制和基础工具支持
 */
export class TreeSitterUtils {
  /**
   * 从节点提取文本内容
   * @param node 语法节点
   * @param sourceCode 源代码
   * @returns 节点文本
   */
  static getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    return sourceCode.substring(node.startIndex, node.endIndex);
  }

  /**
   * 获取节点位置信息
   * @param node 语法节点
   * @returns 位置信息（行和列，从1开始）
   */
  static getNodeLocation(node: Parser.SyntaxNode): {
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  } {
    return {
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      startColumn: node.startPosition.column + 1,
      endColumn: node.endPosition.column + 1,
    };
  }

  /**
   * 获取节点名称
   * @param node 语法节点
   * @returns 节点名称
   */
  static getNodeName(node: Parser.SyntaxNode): string {
    if (node.type === 'function_declaration' || node.type === 'method_definition') {
      const nameNode = node.children?.find(child => child.type === 'identifier');
      if (nameNode) {
        return nameNode.text || node.type;
      }
    }

    if (node.type === 'class_declaration') {
      const nameNode = node.children?.find(child => child.type === 'type_identifier' || child.type === 'identifier');
      if (nameNode) {
        return nameNode.text || node.type;
      }
    }

    return node.type;
  }

  static findNodeByType(ast: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
    const nodes: Parser.SyntaxNode[] = [];

    const traverse = (node: Parser.SyntaxNode, depth: number = 0) => {
      if (depth > 100) return;

      if (node.type === type) {
        nodes.push(node);
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
      }
    };

    traverse(ast);
    return nodes;
  }

  static extractImports(ast: Parser.SyntaxNode, sourceCode?: string): string[] {
    const imports: string[] = [];

    if (!sourceCode) {
      return imports;
    }

    const importTypes = new Set([
      'import_statement',
      'import_clause',
      'import_specifier',
      'require',
      'import_from_statement',
      'import_alias',
    ]);

    const traverse = (node: Parser.SyntaxNode, depth: number = 0) => {
      if (depth > 100) return;

      if (importTypes.has(node.type)) {
        const importText = this.getNodeText(node, sourceCode);
        if (importText.trim().length > 0) {
          imports.push(importText);
        }
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
      }
    };

    traverse(ast);
    return imports;
  }

  static extractImportNodes(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const importTypes = new Set([
      'import_statement',
      'import_clause',
      'import_specifier',
      'require',
      'import_from_statement',
      'import_alias',
    ]);

    const nodes: Parser.SyntaxNode[] = [];

    const traverse = (node: Parser.SyntaxNode, depth: number = 0) => {
      if (depth > 100) return;

      if (importTypes.has(node.type)) {
        nodes.push(node);
      }

      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child, depth + 1);
        }
      }
    };

    traverse(ast);
    return nodes;
  }

  /**
   * 生成代码片段ID
   * @param content 内容
   * @param startLine 起始行号
   * @returns 片段ID
   */
  static generateSnippetId(content: string, startLine: number): string {
    const hash = this.simpleHash(content).substring(0, 8);
    return `snippet_${startLine}_${hash}`;
  }

  /**
   * 简单哈希函数
   * @param str 输入字符串
   * @returns 哈希值
   */
  static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash >>> 0; // 正确地保持为无符号32位整数
    }
    return hash.toString(36);
  }
}