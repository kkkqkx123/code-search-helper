import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C#依赖关系提取器
 * 处理using指令、命名空间引用、程序集引用等
 */
export class DependencyRelationshipExtractor {
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
    const namespaceInfo = this.extractNamespaceInfoForNode(astNode);

    return {
      type: 'dependency',
      fromNodeId,
      toNodeId,
      dependencyType,
      target,
      importedSymbols,
      namespaceInfo,
      location: {
        filePath: symbolTable?.filePath || 'current_file.cs',
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
  private determineDependencyType(astNode: Parser.SyntaxNode): 'using' | 'namespace' | 'extern_alias' | 'assembly' | null {
    const nodeType = astNode.type;

    if (nodeType === 'using_directive') {
      return 'using';
    } else if (nodeType === 'namespace_declaration' || nodeType === 'file_scoped_namespace_declaration') {
      return 'namespace';
    } else if (nodeType === 'extern_alias_directive') {
      return 'extern_alias';
    } else if (nodeType === 'assembly_attribute') {
      return 'assembly';
    }

    return null;
  }

  /**
   * 提取依赖关系的节点
   */
  private extractDependencyNodes(astNode: Parser.SyntaxNode, dependencyType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = NodeIdGenerator.forAstNode(astNode);
    let toNodeId = 'unknown';

    if (dependencyType === 'using') {
      const usingTarget = this.extractUsingTarget(astNode);
      if (usingTarget) {
        toNodeId = NodeIdGenerator.forSymbol(usingTarget, 'using', 'current_file.cs', astNode.startPosition.row);
      }
    } else if (dependencyType === 'namespace') {
      const namespaceName = this.extractNamespaceName(astNode);
      if (namespaceName) {
        toNodeId = NodeIdGenerator.forSymbol(namespaceName, 'namespace', 'current_file.cs', astNode.startPosition.row);
      }
    } else if (dependencyType === 'extern_alias') {
      const aliasName = this.extractExternAliasName(astNode);
      if (aliasName) {
        toNodeId = NodeIdGenerator.forSymbol(aliasName, 'extern_alias', 'current_file.cs', astNode.startPosition.row);
      }
    } else if (dependencyType === 'assembly') {
      const assemblyName = this.extractAssemblyName(astNode);
      if (assemblyName) {
        toNodeId = NodeIdGenerator.forSymbol(assemblyName, 'assembly', 'current_file.cs', astNode.startPosition.row);
      }
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取using目标
   */
  private extractUsingTarget(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'using_directive') {
      const nameNode = astNode.childForFieldName('name');
      if (nameNode) {
        return nameNode.text || null;
      }
    }
    return null;
  }

  /**
   * 提取命名空间名称
   */
  private extractNamespaceName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'namespace_declaration' || astNode.type === 'file_scoped_namespace_declaration') {
      const nameNode = astNode.childForFieldName('name');
      if (nameNode) {
        return nameNode.text || null;
      }
    }
    return null;
  }

  /**
   * 提取外部别名名称
   */
  private extractExternAliasName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'extern_alias_directive') {
      const identifier = astNode.childForFieldName('identifier');
      if (identifier) {
        return identifier.text || null;
      }
    }
    return null;
  }

  /**
   * 提取程序集名称
   */
  private extractAssemblyName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'assembly_attribute') {
      // 查找程序集特性中的名称
      for (const child of astNode.children) {
        if (child.type === 'attribute') {
          const nameNode = child.childForFieldName('name');
          if (nameNode && nameNode.text?.includes('Assembly')) {
            return nameNode.text || null;
          }
        }
      }
    }
    return null;
  }

  /**
   * 提取目标
   */
  private extractTarget(astNode: Parser.SyntaxNode): string | null {
    const dependencyType = this.determineDependencyType(astNode);

    if (dependencyType === 'using') {
      return this.extractUsingTarget(astNode);
    } else if (dependencyType === 'namespace') {
      return this.extractNamespaceName(astNode);
    } else if (dependencyType === 'extern_alias') {
      return this.extractExternAliasName(astNode);
    } else if (dependencyType === 'assembly') {
      return this.extractAssemblyName(astNode);
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
      // 对于using指令，提取具体的符号
      const nameNode = astNode.childForFieldName('name');
      if (nameNode) {
        symbols.push(nameNode.text || '');
      }

      // 检查是否是静态using
      const staticModifier = astNode.childForFieldName('static');
      if (staticModifier) {
        symbols.push('static');
      }
    }

    return symbols;
  }

  /**
   * 提取命名空间信息
   */
  private extractNamespaceInfoForNode(astNode: Parser.SyntaxNode): any {
    const dependencyType = this.determineDependencyType(astNode);

    if (dependencyType === 'namespace') {
      // 使用现有的公共方法
      return this.extractNamespaceInfoFromNode(astNode);
    }

    return null;
  }

  /**
   * 从AST节点提取命名空间信息的辅助方法
   */
  private extractNamespaceInfoFromNode(astNode: Parser.SyntaxNode): any {
    const nameNode = astNode.childForFieldName('name');
    if (!nameNode) {
      return null;
    }

    return {
      name: nameNode.text || '',
      isFileScoped: astNode.type === 'file_scoped_namespace_declaration',
      isGlobal: nameNode.text === 'global'
    };
  }

  /**
   * 判断是否为依赖关系节点
   */
  private isDependencyNode(astNode: Parser.SyntaxNode): boolean {
    const dependencyNodeTypes = [
      'using_directive',
      'namespace_declaration',
      'file_scoped_namespace_declaration',
      'extern_alias_directive',
      'assembly_attribute'
    ];

    return dependencyNodeTypes.includes(astNode.type);
  }

  /**
   * 提取using指令信息
   */
  extractUsingInfo(usingStmt: Parser.SyntaxNode): {
    target: string;
    type: 'namespace' | 'alias' | 'static';
    symbols: string[];
  } | null {
    let target = '';
    let type: 'namespace' | 'alias' | 'static' = 'namespace';
    const symbols: string[] = [];

    // 检查是否是静态using
    const staticModifier = usingStmt.childForFieldName('static');
    if (staticModifier) {
      type = 'static';
    }

    // 检查是否是别名
    const nameNode = usingStmt.childForFieldName('name');
    const aliasNode = usingStmt.childForFieldName('alias');

    if (aliasNode) {
      type = 'alias';
      symbols.push(aliasNode.text || '');
    }

    if (nameNode) {
      target = nameNode.text || '';
      symbols.push(target);
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
   * 提取命名空间信息
   */
  extractNamespaceInfo(namespaceDecl: Parser.SyntaxNode): {
    name: string;
    isFileScoped: boolean;
    isGlobal: boolean;
  } | null {
    const nameNode = namespaceDecl.childForFieldName('name');
    if (!nameNode) {
      return null;
    }

    return {
      name: nameNode.text || '',
      isFileScoped: namespaceDecl.type === 'file_scoped_namespace_declaration',
      isGlobal: nameNode.text === 'global'
    };
  }

  /**
   * 生成节点ID
   */

  /**
   * 查找using指令
   */
  findUsingDirectives(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const usingDirectives: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'using_directive') {
        usingDirectives.push(node);
      }
    });

    return usingDirectives;
  }

  /**
   * 查找命名空间声明
   */
  findNamespaceDeclarations(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const namespaceDeclarations: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'namespace_declaration' || node.type === 'file_scoped_namespace_declaration') {
        namespaceDeclarations.push(node);
      }
    });

    return namespaceDeclarations;
  }

  /**
   * 查找外部别名指令
   */
  findExternAliasDirectives(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const externAliasDirectives: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'extern_alias_directive') {
        externAliasDirectives.push(node);
      }
    });

    return externAliasDirectives;
  }

  /**
   * 查找程序集特性
   */
  findAssemblyAttributes(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const assemblyAttributes: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'assembly_attribute') {
        assemblyAttributes.push(node);
      }
    });

    return assemblyAttributes;
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
    const usingDirectives = this.findUsingDirectives(ast);
    const namespaceDeclarations = this.findNamespaceDeclarations(ast);
    const externAliasDirectives = this.findExternAliasDirectives(ast);
    const assemblyAttributes = this.findAssemblyAttributes(ast);

    // 处理using指令
    for (const usingDirective of usingDirectives) {
      const usingInfo = this.extractUsingInfo(usingDirective);

      if (usingInfo) {
        dependencies.push({
          sourceId: NodeIdGenerator.forAstNode(usingDirective),
          targetId: NodeIdGenerator.forSymbol(usingInfo.target, 'using', filePath, usingDirective.startPosition.row + 1),
          dependencyType: 'using',
          target: usingInfo.target,
          importedSymbols: usingInfo.symbols,
          location: {
            filePath,
            lineNumber: usingDirective.startPosition.row + 1,
            columnNumber: usingDirective.startPosition.column + 1
          }
        });
      }
    }

    // 处理命名空间声明
    for (const namespaceDecl of namespaceDeclarations) {
      const namespaceInfo = this.extractNamespaceInfo(namespaceDecl);

      if (namespaceInfo) {
        dependencies.push({
          sourceId: NodeIdGenerator.forAstNode(namespaceDecl),
          targetId: NodeIdGenerator.forSymbol(namespaceInfo.name, 'namespace', filePath, namespaceDecl.startPosition.row + 1),
          dependencyType: 'namespace',
          target: namespaceInfo.name,
          importedSymbols: [],
          namespaceInfo,
          location: {
            filePath,
            lineNumber: namespaceDecl.startPosition.row + 1,
            columnNumber: namespaceDecl.startPosition.column + 1
          }
        });
      }
    }

    // 处理外部别名指令
    for (const externAlias of externAliasDirectives) {
      const aliasName = this.extractExternAliasName(externAlias);

      if (aliasName) {
        dependencies.push({
          sourceId: NodeIdGenerator.forAstNode(externAlias),
          targetId: NodeIdGenerator.forSymbol(aliasName, 'extern_alias', filePath, externAlias.startPosition.row + 1),
          dependencyType: 'extern_alias',
          target: aliasName,
          importedSymbols: [aliasName],
          location: {
            filePath,
            lineNumber: externAlias.startPosition.row + 1,
            columnNumber: externAlias.startPosition.column + 1
          }
        });
      }
    }

    // 处理程序集特性
    for (const assemblyAttr of assemblyAttributes) {
      const assemblyName = this.extractAssemblyName(assemblyAttr);

      if (assemblyName) {
        dependencies.push({
          sourceId: NodeIdGenerator.forAstNode(assemblyAttr),
          targetId: NodeIdGenerator.forSymbol(assemblyName, 'assembly', filePath, assemblyAttr.startPosition.row + 1),
          dependencyType: 'assembly',
          target: assemblyName,
          importedSymbols: [assemblyName],
          location: {
            filePath,
            lineNumber: assemblyAttr.startPosition.row + 1,
            columnNumber: assemblyAttr.startPosition.column + 1
          }
        });
      }
    }

    return dependencies;
  }
}