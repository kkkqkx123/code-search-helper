import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C语言依赖关系提取器
 * 处理预处理器包含指令和模块依赖
 */
export class CDependencyRelationshipExtractor {
  /**
   * 提取依赖关系元数据
   */
  extractDependencyMetadata(result: any, astNode: Parser.SyntaxNode, symbolTable: any): any {
    const dependencyType = this.determineDependencyType(astNode);

    if (!dependencyType) {
      return null;
    }

    const { fromNodeId, toNodeId } = this.extractDependencyNodes(astNode, dependencyType);
    const target = this.extractTarget(astNode);
    const importedSymbols = this.extractImportedSymbols(astNode);

    return {
      type: 'dependency',
      fromNodeId,
      toNodeId,
      dependencyType,
      target,
      importedSymbols,
      location: {
        filePath: symbolTable?.filePath || 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  /**
   * 提取依赖关系数组
   */
  extractDependencyRelationships(result: any): Array<any> {
    const relationships: Array<any> = [];
    const astNode = result.captures?.[0]?.node;

    if (!astNode) {
      return relationships;
    }

    // 检查是否为依赖相关的节点类型
    if (!this.isDependencyNode(astNode)) {
      return relationships;
    }

    const dependencyMetadata = this.extractDependencyMetadata(result, astNode, null);
    if (dependencyMetadata) {
      relationships.push(dependencyMetadata);
    }

    return relationships;
  }

  /**
   * 确定依赖类型
   */
  private determineDependencyType(astNode: Parser.SyntaxNode): 'include' | 'import' | 'link' | null {
    const nodeType = astNode.type;

    if (nodeType === 'preproc_include') {
      return 'include';
    } else if (nodeType === 'preproc_def' && astNode.text?.includes('import')) {
      return 'import';
    }

    return null;
  }

  /**
   * 提取依赖关系的节点
   */
  private extractDependencyNodes(astNode: Parser.SyntaxNode, dependencyType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = generateDeterministicNodeId(astNode);
    let toNodeId = 'unknown';

    if (dependencyType === 'include') {
      const includePath = this.extractIncludePath(astNode);
      if (includePath) {
        toNodeId = this.generateNodeId(includePath, 'header', includePath);
      }
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取包含路径
   */
  private extractIncludePath(astNode: Parser.SyntaxNode): string | null {
    for (const child of astNode.children) {
      if (child.type === 'string_literal' || child.type === 'system_lib_string') {
        return child.text?.replace(/['"<>/]/g, '') || null; // 移除引号和尖括号
      }
    }
    return null;
  }

  /**
   * 提取目标
   */
  private extractTarget(astNode: Parser.SyntaxNode): string | null {
    return this.extractIncludePath(astNode);
  }

  /**
   * 提取导入的符号
   */
  private extractImportedSymbols(astNode: Parser.SyntaxNode): string[] {
    // C语言的#include通常导入所有符号，这里返回空数组
    // 可以根据需要扩展以支持特定的符号导入
    return [];
  }

  /**
   * 判断是否为依赖关系节点
   */
  private isDependencyNode(astNode: Parser.SyntaxNode): boolean {
    const dependencyNodeTypes = [
      'preproc_include',
      'preproc_def'
    ];

    return dependencyNodeTypes.includes(astNode.type);
  }

  /**
   * 提取包含信息
   */
  extractIncludeInfo(includeStmt: Parser.SyntaxNode): {
    source: string;
    importedSymbols: string[];
  } | null {
    let source = '';
    const importedSymbols: string[] = [];

    for (const child of includeStmt.children) {
      // Find the source (usually a string literal)
      if (child.type === 'string_literal' || child.type === 'system_lib_string') {
        source = child.text.replace(/['"<>/]/g, ''); // Remove quotes and angle brackets
      }
    }

    if (source) {
      return {
        source,
        importedSymbols
      };
    }
    return null;
  }

  /**
   * 生成节点ID
   */
  private generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }

  /**
   * 查找预处理器包含指令
   */
  findIncludeStatements(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const includeStatements: Parser.SyntaxNode[] = [];
    
    this.traverseTree(ast, (node) => {
      if (node.type === 'preproc_include') {
        includeStatements.push(node);
      }
    });
    
    return includeStatements;
  }

  /**
   * 遍历AST树
   */
  private traverseTree(node: Parser.SyntaxNode, callback: (node: Parser.SyntaxNode) => void): void {
    callback(node);
    
    if (node.children) {
      for (const child of node.children) {
        this.traverseTree(child, callback);
      }
    }
  }

  /**
   * 分析依赖关系
   */
  analyzeDependencies(ast: Parser.SyntaxNode, filePath: string): Array<{
    sourceId: string;
    targetId: string;
    dependencyType: string;
    target: string;
    importedSymbols: string[];
    location: {
      filePath: string;
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const dependencies: Array<any> = [];
    const includeStatements = this.findIncludeStatements(ast);

    for (const includeStmt of includeStatements) {
      const includeInfo = this.extractIncludeInfo(includeStmt);

      if (includeInfo) {
        dependencies.push({
          sourceId: generateDeterministicNodeId(includeStmt),
          targetId: this.generateNodeId(includeInfo.source, 'header', includeInfo.source),
          dependencyType: 'include',
          target: includeInfo.source,
          importedSymbols: includeInfo.importedSymbols,
          location: {
            filePath,
            lineNumber: includeStmt.startPosition.row + 1,
            columnNumber: includeStmt.startPosition.column + 1
          }
        });
      }
    }

    return dependencies;
  }
}