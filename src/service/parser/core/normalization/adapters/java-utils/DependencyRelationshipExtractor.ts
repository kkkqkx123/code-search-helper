import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * Java依赖关系提取器
 * 处理导入指令、包依赖、命名空间使用等
 */
export class JavaDependencyRelationshipExtractor {
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
        filePath: symbolTable?.filePath || 'current_file.java',
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
  private determineDependencyType(astNode: Parser.SyntaxNode): 'import' | 'package' | 'static_import' | null {
    const nodeType = astNode.type;

    if (nodeType === 'import_declaration') {
      // 检查是否为静态导入
      for (const child of astNode.children) {
        if (child.type === 'static' && child.text === 'static') {
          return 'static_import';
        }
      }
      return 'import';
    } else if (nodeType === 'package_declaration') {
      return 'package';
    }

    return null;
  }

  /**
   * 提取依赖关系的节点
   */
  private extractDependencyNodes(astNode: Parser.SyntaxNode, dependencyType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = generateDeterministicNodeId(astNode);
    let toNodeId = 'unknown';

    if (dependencyType === 'import') {
      const importPath = this.extractImportPath(astNode);
      if (importPath) {
        toNodeId = this.generateNodeId(importPath, 'import', importPath);
      }
    } else if (dependencyType === 'static_import') {
      const importPath = this.extractImportPath(astNode);
      if (importPath) {
        toNodeId = this.generateNodeId(importPath, 'static_import', importPath);
      }
    } else if (dependencyType === 'package') {
      const packageName = this.extractPackageName(astNode);
      if (packageName) {
        toNodeId = this.generateNodeId(packageName, 'package', packageName);
      }
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取导入路径
   */
  private extractImportPath(astNode: Parser.SyntaxNode): string | null {
    for (const child of astNode.children) {
      if (child.type === 'scoped_identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  /**
   * 提取包名称
   */
  private extractPackageName(astNode: Parser.SyntaxNode): string | null {
    const nameNode = astNode.childForFieldName('name');
    if (nameNode && (nameNode.type === 'scoped_identifier')) {
      return nameNode.text || null;
    }
    return null;
  }

  /**
   * 提取目标
   */
  private extractTarget(astNode: Parser.SyntaxNode): string | null {
    const dependencyType = this.determineDependencyType(astNode);
    
    if (dependencyType === 'import' || dependencyType === 'static_import') {
      return this.extractImportPath(astNode);
    } else if (dependencyType === 'package') {
      return this.extractPackageName(astNode);
    }
    
    return null;
  }

  /**
   * 提取导入的符号
   */
  private extractImportedSymbols(astNode: Parser.SyntaxNode): string[] {
    const dependencyType = this.determineDependencyType(astNode);
    const symbols: string[] = [];
    
    if (dependencyType === 'import' || dependencyType === 'static_import') {
      // 对于导入声明，提取具体的符号
      const nameNode = astNode.childForFieldName('name');
      if (nameNode) {
        // 从完全限定名中提取最后一个部分作为符号名
        const fullName = nameNode.text || '';
        const parts = fullName.split('.');
        if (parts.length > 0) {
          symbols.push(parts[parts.length - 1]);
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
    
    if (dependencyType === 'package') {
      return {
        name: this.extractPackageName(astNode),
        isQualified: this.isQualifiedPackage(astNode)
      };
    }
    
    return null;
  }

  /**
   * 判断是否为限定包名
   */
  private isQualifiedPackage(astNode: Parser.SyntaxNode): boolean {
    const nameNode = astNode.childForFieldName('name');
    if (nameNode) {
      return nameNode.text?.includes('.') || false;
    }
    return false;
  }

  /**
   * 判断是否为依赖关系节点
   */
  private isDependencyNode(astNode: Parser.SyntaxNode): boolean {
    const dependencyNodeTypes = [
      'import_declaration',
      'package_declaration'
    ];

    return dependencyNodeTypes.includes(astNode.type);
  }

  /**
   * 提取导入信息
   */
  extractImportInfo(importStmt: Parser.SyntaxNode): {
    source: string;
    importedSymbols: string[];
    isStatic: boolean;
  } | null {
    let source = '';
    const importedSymbols: string[] = [];
    let isStatic = false;

    // 检查是否为静态导入
    for (const child of importStmt.children) {
      if (child.type === 'static' && child.text === 'static') {
        isStatic = true;
        break;
      }
    }

    const nameNode = importStmt.childForFieldName('name');
    if (nameNode) {
      source = nameNode.text || '';
      
      // 从完全限定名中提取最后一个部分作为符号名
      const parts = source.split('.');
      if (parts.length > 0) {
        importedSymbols.push(parts[parts.length - 1]);
      }
    }

    if (source) {
      return {
        source,
        importedSymbols,
        isStatic
      };
    }
    return null;
  }

  /**
   * 提取包信息
   */
  extractPackageInfo(packageStmt: Parser.SyntaxNode): {
    name: string;
    isQualified: boolean;
  } | null {
    const nameNode = packageStmt.childForFieldName('name');
    if (nameNode) {
      const name = nameNode.text || '';
      return {
        name,
        isQualified: name.includes('.')
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
   * 查找导入语句
   */
  findImportStatements(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const importStatements: Parser.SyntaxNode[] = [];
    
    this.traverseTree(ast, (node) => {
      if (node.type === 'import_declaration') {
        importStatements.push(node);
      }
    });
    
    return importStatements;
  }

  /**
   * 查找包声明
   */
  findPackageDeclarations(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const packageDeclarations: Parser.SyntaxNode[] = [];
    
    this.traverseTree(ast, (node) => {
      if (node.type === 'package_declaration') {
        packageDeclarations.push(node);
      }
    });
    
    return packageDeclarations;
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
    const importStatements = this.findImportStatements(ast);
    const packageDeclarations = this.findPackageDeclarations(ast);

    // 处理导入语句
    for (const importStmt of importStatements) {
      const importInfo = this.extractImportInfo(importStmt);

      if (importInfo) {
        const dependencyType = importInfo.isStatic ? 'static_import' : 'import';
        
        dependencies.push({
          sourceId: generateDeterministicNodeId(importStmt),
          targetId: this.generateNodeId(importInfo.source, dependencyType, importInfo.source),
          dependencyType,
          target: importInfo.source,
          importedSymbols: importInfo.importedSymbols,
          location: {
            filePath,
            lineNumber: importStmt.startPosition.row + 1,
            columnNumber: importStmt.startPosition.column + 1
          }
        });
      }
    }

    // 处理包声明
    for (const packageDecl of packageDeclarations) {
      const packageInfo = this.extractPackageInfo(packageDecl);

      if (packageInfo) {
        dependencies.push({
          sourceId: generateDeterministicNodeId(packageDecl),
          targetId: this.generateNodeId(packageInfo.name, 'package', packageInfo.name),
          dependencyType: 'package',
          target: packageInfo.name,
          importedSymbols: [],
          namespaceInfo: {
            name: packageInfo.name,
            isQualified: packageInfo.isQualified
          },
          location: {
            filePath,
            lineNumber: packageDecl.startPosition.row + 1,
            columnNumber: packageDecl.startPosition.column + 1
          }
        });
      }
    }

    return dependencies;
  }
}