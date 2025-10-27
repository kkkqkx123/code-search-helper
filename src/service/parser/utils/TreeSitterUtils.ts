import Parser from 'tree-sitter';

export class TreeSitterUtils {
  static getNodeText(node: Parser.SyntaxNode, sourceCode: string): string {
    return sourceCode.substring(node.startIndex, node.endIndex);
  }

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

  static generateSnippetId(content: string, startLine: number): string {
    const hash = this.simpleHash(content).substring(0, 8);
    return `snippet_${startLine}_${hash}`;
  }

  static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash >>> 0; // 正确地保持为无符号32位整数
    }
    return hash.toString(36);
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
}