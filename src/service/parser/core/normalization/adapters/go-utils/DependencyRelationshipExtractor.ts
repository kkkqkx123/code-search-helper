import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { GoHelperMethods } from './GoHelperMethods';
import Parser from 'tree-sitter';

/**
 * Go依赖关系提取器
 * 处理导入声明、包引用等依赖关系
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
    const packageInfo = this.extractPackageInfo(astNode);

    return {
      type: 'dependency',
      fromNodeId,
      toNodeId,
      dependencyType,
      target,
      importedSymbols,
      packageInfo,
      location: {
        filePath: symbolTable?.filePath || 'current_file.go',
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
  private determineDependencyType(astNode: Parser.SyntaxNode): 'import' | 'package' | 'qualified_identifier' | null {
    const nodeType = astNode.type;

    if (nodeType === 'import_spec' || nodeType === 'import_declaration') {
      return 'import';
    } else if (nodeType === 'package_clause') {
      return 'package';
    } else if (nodeType === 'qualified_identifier' || nodeType === 'selector_expression') {
      return 'qualified_identifier';
    }

    return null;
  }

  /**
   * 提取依赖关系的节点
   */
  private extractDependencyNodes(astNode: Parser.SyntaxNode, dependencyType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = NodeIdGenerator.forAstNode(astNode);
    let toNodeId = 'unknown';

    if (dependencyType === 'import') {
      const importPath = this.extractImportPath(astNode);
      if (importPath) {
        toNodeId = NodeIdGenerator.forSymbol(importPath, 'module', importPath, astNode.startPosition.row);
      }
    } else if (dependencyType === 'package') {
      const packageName = this.extractPackageName(astNode);
      if (packageName) {
        toNodeId = NodeIdGenerator.forSymbol(packageName, 'package', 'current_file.go', astNode.startPosition.row);
      }
    } else if (dependencyType === 'qualified_identifier') {
      const qualifiedTarget = this.extractQualifiedTarget(astNode);
      if (qualifiedTarget) {
        toNodeId = NodeIdGenerator.forSymbol(qualifiedTarget, 'qualified', 'current_file.go', astNode.startPosition.row);
      }
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取导入路径
   */
  private extractImportPath(astNode: Parser.SyntaxNode): string | null {
    for (const child of astNode.children) {
      if (child.type === 'interpreted_string_literal' || child.type === 'raw_string_literal') {
        return child.text?.replace(/['"]/g, '') || null; // 移除引号
      }
    }
    return null;
  }

  /**
   * 提取包名称
   */
  private extractPackageName(astNode: Parser.SyntaxNode): string | null {
    for (const child of astNode.children) {
      if (child.type === 'package_identifier' || child.type === 'identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  /**
   * 提取限定标识符目标
   */
  private extractQualifiedTarget(astNode: Parser.SyntaxNode): string | null {
    // 对于限定标识符或选择器表达式，提取包名.标识符
    if (astNode.type === 'selector_expression') {
      const packageNode = astNode.childForFieldName('operand');
      const fieldNode = astNode.children[astNode.children.length - 1]; // 最后一个孩子通常是字段名

      if (packageNode && fieldNode) {
        return `${packageNode.text}.${fieldNode.text || ''}`;
      }
    }
    return null;
  }

  /**
   * 提取目标
   */
  private extractTarget(astNode: Parser.SyntaxNode): string | null {
    const dependencyType = this.determineDependencyType(astNode);

    if (dependencyType === 'import') {
      return this.extractImportPath(astNode);
    } else if (dependencyType === 'package') {
      return this.extractPackageName(astNode);
    } else if (dependencyType === 'qualified_identifier') {
      return this.extractQualifiedTarget(astNode);
    }

    return null;
  }

  /**
   * 提取导入的符号
   */
  private extractImportedSymbols(astNode: Parser.SyntaxNode): string[] {
    const dependencyType = this.determineDependencyType(astNode);
    const symbols: string[] = [];

    if (dependencyType === 'import') {
      // 对于import，如果是重命名导入或点导入
      for (const child of astNode.children) {
        if (child.type === 'identifier' && child.text !== this.extractImportPath(astNode)) {
          // 如果是重命名导入，如 import mypkg "package/path"
          symbols.push(child.text);
        }
      }
    } else if (dependencyType === 'qualified_identifier') {
      // 对于限定标识符，提取被访问的符号
      if (astNode.type === 'selector_expression') {
        const fieldNode = astNode.children[astNode.children.length - 1];
        if (fieldNode && (fieldNode.type === 'field_identifier' || fieldNode.type === 'identifier')) {
          symbols.push(fieldNode.text || '');
        }
      }
    }

    return symbols;
  }

  /**
   * 提取包信息
   */
  private extractPackageInfo(astNode: Parser.SyntaxNode): any {
    const dependencyType = this.determineDependencyType(astNode);

    if (dependencyType === 'import' || dependencyType === 'package') {
      return {
        name: dependencyType === 'import' ? this.extractImportPath(astNode) : this.extractPackageName(astNode),
        isRenamed: this.isRenamedImport(astNode),
        isDotImport: this.isDotImport(astNode)
      };
    }

    return null;
  }

  /**
   * 判断是否为重命名导入
   */
  private isRenamedImport(importNode: Parser.SyntaxNode): boolean {
    if (importNode.type !== 'import_spec') {
      return false;
    }

    // 检查是否有重命名标识符
    for (let i = 0; i < importNode.children.length; i++) {
      const child = importNode.children[i];
      if (child.type === 'identifier' && i < importNode.children.length - 1) { // 如果标识符不在最后（最后通常是字符串）
        const nextChild = importNode.children[i + 1];
        if (nextChild && (nextChild.type === 'interpreted_string_literal' || nextChild.type === 'raw_string_literal')) {
          // 找到标识符后跟着字符串的情况，这是重命名导入
          return true;
        }
      }
    }
    return false;
  }

  /**
   * 判断是否为点导入
   */
  private isDotImport(importNode: Parser.SyntaxNode): boolean {
    if (importNode.type !== 'import_spec') {
      return false;
    }

    // 检查是否有点标识符
    for (const child of importNode.children) {
      if (child.type === 'dot') {
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
      'import_spec',
      'import_declaration',
      'package_clause',
      'qualified_identifier',
      'selector_expression'
    ];

    return dependencyNodeTypes.includes(astNode.type);
  }

  /**
   * 提取导入信息
   */
  extractImportInfo(importStmt: Parser.SyntaxNode): {
    source: string;
    importedSymbols: string[];
    isRenamed: boolean;
    isDotImport: boolean;
  } | null {
    let source = '';
    const importedSymbols: string[] = [];
    let isRenamed = false;
    let isDotImport = false;

    for (const child of importStmt.children) {
      // Find the source (usually a string literal)
      if (child.type === 'interpreted_string_literal' || child.type === 'raw_string_literal') {
        source = child.text.replace(/['"]/g, ''); // Remove quotes
      } else if (child.type === 'identifier' && source) {
        // If there's an identifier before the string literal, it might be a rename
        importedSymbols.push(child.text);
        isRenamed = true;
      } else if (child.type === 'dot') {
        isDotImport = true;
      }
    }

    if (source) {
      return {
        source,
        importedSymbols,
        isRenamed,
        isDotImport
      };
    }
    return null;
  }

  /**
   * 提取包信息
   */
  extractPackageInfoStmt(packageStmt: Parser.SyntaxNode): {
    name: string;
    isMain: boolean;
  } | null {
    let name = '';
    let isMain = false;

    for (const child of packageStmt.children) {
      if (child.type === 'package_identifier' || child.type === 'identifier') {
        name = child.text;
        isMain = name === 'main';
      }
    }

    if (name) {
      return {
        name,
        isMain
      };
    }
    return null;
  }

  /**
   * 生成节点ID
   */

  /**
   * 查找导入语句
   */
  findImportStatements(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const importStatements: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'import_declaration' || node.type === 'import_spec') {
        importStatements.push(node);
      }
    });

    return importStatements;
  }

  /**
   * 查找包声明
   */
  findPackageStatements(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const packageStatements: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'package_clause') {
        packageStatements.push(node);
      }
    });

    return packageStatements;
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
    packageInfo?: any;
    location: {
      filePath: string;
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const dependencies: Array<any> = [];
    const importStatements = this.findImportStatements(ast);
    const packageStatements = this.findPackageStatements(ast);

    // 处理导入语句
    for (const importStmt of importStatements) {
      const importInfo = this.extractImportInfo(importStmt);

      if (importInfo) {
        dependencies.push({
          sourceId: NodeIdGenerator.forAstNode(importStmt),
          targetId: NodeIdGenerator.forSymbol(importInfo.source, 'module', importInfo.source, importStmt.startPosition.row + 1),
          dependencyType: 'import',
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
    for (const packageStmt of packageStatements) {
      const packageInfo = this.extractPackageInfoStmt(packageStmt);

      if (packageInfo) {
        dependencies.push({
          sourceId: NodeIdGenerator.forAstNode(packageStmt),
          targetId: NodeIdGenerator.forSymbol(packageInfo.name, 'package', filePath, packageStmt.startPosition.row + 1),
          dependencyType: 'package',
          target: packageInfo.name,
          importedSymbols: [],
          location: {
            filePath,
            lineNumber: packageStmt.startPosition.row + 1,
            columnNumber: packageStmt.startPosition.column + 1
          }
        });
      }
    }

    return dependencies;
  }
}