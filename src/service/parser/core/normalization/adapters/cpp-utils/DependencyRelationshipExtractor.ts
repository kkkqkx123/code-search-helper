import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C++依赖关系提取器
 * 处理预处理器包含指令、模块依赖、命名空间使用等
 */
export class CppDependencyRelationshipExtractor {
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
    const namespaceInfo = this.extractNamespaceInfo(astNode);

    return {
      type: 'dependency',
      fromNodeId,
      toNodeId,
      dependencyType,
      target,
      importedSymbols,
      namespaceInfo,
      location: {
        filePath: symbolTable?.filePath || 'current_file.cpp',
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
  private determineDependencyType(astNode: Parser.SyntaxNode): 'include' | 'import' | 'using' | 'namespace' | 'module' | null {
    const nodeType = astNode.type;

    if (nodeType === 'preproc_include') {
      return 'include';
    } else if (nodeType === 'preproc_def' && astNode.text?.includes('import')) {
      return 'import';
    } else if (nodeType === 'using_declaration' || nodeType === 'using_directive') {
      return 'using';
    } else if (nodeType === 'namespace_definition') {
      return 'namespace';
    } else if (nodeType === 'module_declaration' || nodeType === 'import_declaration') {
      return 'module';
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
    } else if (dependencyType === 'import') {
      const importPath = this.extractImportPath(astNode);
      if (importPath) {
        toNodeId = this.generateNodeId(importPath, 'module', importPath);
      }
    } else if (dependencyType === 'using') {
      const usingTarget = this.extractUsingTarget(astNode);
      if (usingTarget) {
        toNodeId = this.generateNodeId(usingTarget, 'using', 'current_file.cpp');
      }
    } else if (dependencyType === 'namespace') {
      const namespaceName = this.extractNamespaceName(astNode);
      if (namespaceName) {
        toNodeId = this.generateNodeId(namespaceName, 'namespace', 'current_file.cpp');
      }
    } else if (dependencyType === 'module') {
      const moduleName = this.extractModuleName(astNode);
      if (moduleName) {
        toNodeId = this.generateNodeId(moduleName, 'module', 'current_file.cpp');
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
   * 提取导入路径
   */
  private extractImportPath(astNode: Parser.SyntaxNode): string | null {
    // 对于import声明，提取模块名
    for (const child of astNode.children) {
      if (child.type === 'string_literal' || child.type === 'identifier') {
        return child.text?.replace(/['"<>/]/g, '') || null;
      }
    }
    return null;
  }

  /**
   * 提取using目标
   */
  private extractUsingTarget(astNode: Parser.SyntaxNode): string | null {
    // 对于using声明，提取使用的符号或命名空间
    for (const child of astNode.children) {
      if (child.type === 'identifier' || child.type === 'type_identifier' || child.type === 'namespace_identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  /**
   * 提取命名空间名称
   */
  private extractNamespaceName(astNode: Parser.SyntaxNode): string | null {
    const nameNode = astNode.childForFieldName('name');
    if (nameNode && (nameNode.type === 'namespace_identifier' || nameNode.type === 'identifier')) {
      return nameNode.text || null;
    }
    return null;
  }

  /**
   * 提取模块名称
   */
  private extractModuleName(astNode: Parser.SyntaxNode): string | null {
    for (const child of astNode.children) {
      if (child.type === 'identifier' || child.type === 'string_literal') {
        return child.text || null;
      }
    }
    return null;
  }

  /**
   * 提取目标
   */
  private extractTarget(astNode: Parser.SyntaxNode): string | null {
    const dependencyType = this.determineDependencyType(astNode);
    
    if (dependencyType === 'include') {
      return this.extractIncludePath(astNode);
    } else if (dependencyType === 'import') {
      return this.extractImportPath(astNode);
    } else if (dependencyType === 'using') {
      return this.extractUsingTarget(astNode);
    } else if (dependencyType === 'namespace') {
      return this.extractNamespaceName(astNode);
    } else if (dependencyType === 'module') {
      return this.extractModuleName(astNode);
    }
    
    return null;
  }

  /**
   * 提取导入的符号
   */
  private extractImportedSymbols(astNode: Parser.SyntaxNode): string[] {
    const dependencyType = this.determineDependencyType(astNode);
    const symbols: string[] = [];
    
    if (dependencyType === 'using') {
      // 对于using声明，提取具体的符号
      for (const child of astNode.children) {
        if (child.type === 'identifier' || child.type === 'type_identifier') {
          symbols.push(child.text || '');
        }
      }
    }
    
    return symbols;
  }

  /**
   * 提取命名空间信息
   */
  private extractNamespaceInfo(astNode: Parser.SyntaxNode): any {
    const dependencyType = this.determineDependencyType(astNode);
    
    if (dependencyType === 'namespace') {
      return {
        name: this.extractNamespaceName(astNode),
        isNested: this.isNestedNamespace(astNode),
        isInline: this.isInlineNamespace(astNode)
      };
    }
    
    return null;
  }

  /**
   * 判断是否为嵌套命名空间
   */
  private isNestedNamespace(astNode: Parser.SyntaxNode): boolean {
    return astNode.parent?.type === 'namespace_definition';
  }

  /**
   * 判断是否为内联命名空间
   */
  private isInlineNamespace(astNode: Parser.SyntaxNode): boolean {
    for (const child of astNode.children) {
      if (child.type === 'storage_class_specifier' && child.text === 'inline') {
        return true;
      }
    }
    return false;
  }

  /**
   * 判断是否为依赖关系节点
   */
  private isDependencyNode(astNode: Parser.SyntaxNode): boolean {
    const dependencyNodeTypes = [
      'preproc_include',
      'preproc_def',
      'using_declaration',
      'using_directive',
      'namespace_definition',
      'module_declaration',
      'import_declaration'
    ];

    return dependencyNodeTypes.includes(astNode.type);
  }

  /**
   * 提取包含信息
   */
  extractIncludeInfo(includeStmt: Parser.SyntaxNode): {
    source: string;
    importedSymbols: string[];
    isSystem: boolean;
  } | null {
    let source = '';
    const importedSymbols: string[] = [];
    let isSystem = false;

    for (const child of includeStmt.children) {
      // Find the source (usually a string literal)
      if (child.type === 'string_literal') {
        source = child.text.replace(/['"]/g, ''); // Remove quotes
        isSystem = false;
      } else if (child.type === 'system_lib_string') {
        source = child.text.replace(/[<>]/g, ''); // Remove angle brackets
        isSystem = true;
      }
    }

    if (source) {
      return {
        source,
        importedSymbols,
        isSystem
      };
    }
    return null;
  }

  /**
   * 提取using声明信息
   */
  extractUsingInfo(usingStmt: Parser.SyntaxNode): {
    target: string;
    type: 'declaration' | 'directive';
    symbols: string[];
  } | null {
    let target = '';
    let type: 'declaration' | 'directive' = 'declaration';
    const symbols: string[] = [];

    if (usingStmt.type === 'using_directive') {
      type = 'directive';
    }

    for (const child of usingStmt.children) {
      if (child.type === 'identifier' || child.type === 'type_identifier' || child.type === 'namespace_identifier') {
        const symbol = child.text || '';
        if (symbol) {
          symbols.push(symbol);
          if (!target) {
            target = symbol;
          }
        }
      }
    }

    if (target) {
      return {
        target,
        type,
        symbols
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
   * 查找using声明
   */
  findUsingStatements(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const usingStatements: Parser.SyntaxNode[] = [];
    
    this.traverseTree(ast, (node) => {
      if (node.type === 'using_declaration' || node.type === 'using_directive') {
        usingStatements.push(node);
      }
    });
    
    return usingStatements;
  }

  /**
   * 查找命名空间定义
   */
  findNamespaceDefinitions(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const namespaceDefinitions: Parser.SyntaxNode[] = [];
    
    this.traverseTree(ast, (node) => {
      if (node.type === 'namespace_definition') {
        namespaceDefinitions.push(node);
      }
    });
    
    return namespaceDefinitions;
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
    namespaceInfo?: any;
    location: {
      filePath: string;
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const dependencies: Array<any> = [];
    const includeStatements = this.findIncludeStatements(ast);
    const usingStatements = this.findUsingStatements(ast);
    const namespaceDefinitions = this.findNamespaceDefinitions(ast);

    // 处理包含语句
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

    // 处理using语句
    for (const usingStmt of usingStatements) {
      const usingInfo = this.extractUsingInfo(usingStmt);

      if (usingInfo) {
        dependencies.push({
          sourceId: generateDeterministicNodeId(usingStmt),
          targetId: this.generateNodeId(usingInfo.target, 'using', filePath),
          dependencyType: 'using',
          target: usingInfo.target,
          importedSymbols: usingInfo.symbols,
          location: {
            filePath,
            lineNumber: usingStmt.startPosition.row + 1,
            columnNumber: usingStmt.startPosition.column + 1
          }
        });
      }
    }

    // 处理命名空间定义
    for (const namespaceDef of namespaceDefinitions) {
      const namespaceName = this.extractNamespaceName(namespaceDef);
      const namespaceInfo = this.extractNamespaceInfo(namespaceDef);

      if (namespaceName) {
        dependencies.push({
          sourceId: generateDeterministicNodeId(namespaceDef),
          targetId: this.generateNodeId(namespaceName, 'namespace', filePath),
          dependencyType: 'namespace',
          target: namespaceName,
          importedSymbols: [],
          namespaceInfo,
          location: {
            filePath,
            lineNumber: namespaceDef.startPosition.row + 1,
            columnNumber: namespaceDef.startPosition.column + 1
          }
        });
      }
    }

    return dependencies;
  }
}