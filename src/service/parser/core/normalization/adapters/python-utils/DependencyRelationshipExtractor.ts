import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * Python依赖关系提取器
 * 处理import语句、模块依赖、包依赖等
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
    const moduleInfo = this.extractModuleInfo(astNode);

    return {
      type: 'dependency',
      fromNodeId,
      toNodeId,
      dependencyType,
      target,
      importedSymbols,
      moduleInfo,
      location: {
        filePath: symbolTable?.filePath || 'current_file.py',
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
  private determineDependencyType(astNode: Parser.SyntaxNode): 'import' | 'from_import' | 'relative_import' | 'wildcard_import' | null {
    const nodeType = astNode.type;

    if (nodeType === 'import_statement') {
      return 'import';
    } else if (nodeType === 'import_from_statement') {
      const isRelative = this.isRelativeImport(astNode);
      const isWildcard = this.isWildcardImport(astNode);
      
      if (isWildcard) {
        return 'wildcard_import';
      } else if (isRelative) {
        return 'relative_import';
      } else {
        return 'from_import';
      }
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
    } else if (dependencyType === 'from_import' || dependencyType === 'relative_import') {
      const modulePath = this.extractFromModulePath(astNode);
      if (modulePath) {
        toNodeId = NodeIdGenerator.forSymbol(modulePath, 'module', modulePath, astNode.startPosition.row);
      }
    } else if (dependencyType === 'wildcard_import') {
      const modulePath = this.extractFromModulePath(astNode);
      if (modulePath) {
        toNodeId = NodeIdGenerator.forSymbol(`${modulePath}.*`, 'wildcard_module', modulePath, astNode.startPosition.row);
      }
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取导入路径
   */
  private extractImportPath(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'import_statement') {
      for (const child of astNode.children) {
        if (child.type === 'dotted_name' || child.type === 'aliased_import') {
          return child.text || null;
        }
      }
    }
    return null;
  }

  /**
   * 提取from语句的模块路径
   */
  private extractFromModulePath(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'import_from_statement') {
      const moduleNode = astNode.childForFieldName('module_name');
      if (moduleNode?.text) {
        return moduleNode.text;
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
    } else if (dependencyType === 'from_import' || dependencyType === 'relative_import' || dependencyType === 'wildcard_import') {
      return this.extractFromModulePath(astNode);
    }

    return null;
  }

  /**
   * 提取导入的符号
   */
  private extractImportedSymbols(astNode: Parser.SyntaxNode): string[] {
    const symbols: string[] = [];
    const dependencyType = this.determineDependencyType(astNode);

    if (dependencyType === 'import') {
      // 对于import语句，提取导入的模块或别名
      for (const child of astNode.children) {
        if (child.type === 'dotted_name') {
          symbols.push(child.text || '');
        } else if (child.type === 'aliased_import') {
          // 处理别名导入
          for (const aliasChild of child.children) {
            if (aliasChild.type === 'dotted_name' || aliasChild.type === 'identifier') {
              symbols.push(aliasChild.text || '');
            }
          }
        }
      }
    } else if (dependencyType === 'from_import' || dependencyType === 'relative_import') {
      // 对于from...import语句，提取导入的符号
      const importNode = astNode.childForFieldName('name');
      if (importNode) {
        if (importNode.type === 'dotted_name') {
          symbols.push(importNode.text || '');
        } else if (importNode.type === 'import_list') {
          // 处理多个导入
          for (const child of importNode.children) {
            if (child.type === 'dotted_name' || child.type === 'aliased_import') {
              if (child.type === 'dotted_name') {
                symbols.push(child.text || '');
              } else {
                // 处理别名
                for (const aliasChild of child.children) {
                  if (aliasChild.type === 'dotted_name' || aliasChild.type === 'identifier') {
                    symbols.push(aliasChild.text || '');
                  }
                }
              }
            }
          }
        }
      }
    } else if (dependencyType === 'wildcard_import') {
      // 对于通配符导入，添加'*'
      symbols.push('*');
    }

    return symbols;
  }

  /**
   * 提取模块信息
   */
  private extractModuleInfo(astNode: Parser.SyntaxNode): any {
    const dependencyType = this.determineDependencyType(astNode);
    const moduleInfo: any = {};

    if (dependencyType === 'relative_import') {
      moduleInfo.isRelative = true;
      moduleInfo.relativeLevel = this.calculateRelativeLevel(astNode);
    } else {
      moduleInfo.isRelative = false;
    }

    if (dependencyType === 'wildcard_import') {
      moduleInfo.isWildcard = true;
    } else {
      moduleInfo.isWildcard = false;
    }

    moduleInfo.hasAliases = this.hasAliases(astNode);
    moduleInfo.isStandardLibrary = this.isStandardLibraryModule(astNode);

    return moduleInfo;
  }

  /**
   * 判断是否为相对导入
   */
  private isRelativeImport(astNode: Parser.SyntaxNode): boolean {
    if (astNode.type === 'import_from_statement') {
      const moduleNode = astNode.childForFieldName('module_name');
      if (moduleNode?.text) {
        return moduleNode.text.startsWith('.');
      }
    }
    return false;
  }

  /**
   * 判断是否为通配符导入
   */
  private isWildcardImport(astNode: Parser.SyntaxNode): boolean {
    if (astNode.type === 'import_from_statement') {
      const importNode = astNode.childForFieldName('name');
      if (importNode?.type === 'import_list') {
        for (const child of importNode.children) {
          if (child.type === 'wildcard_import') {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * 计算相对导入级别
   */
  private calculateRelativeLevel(astNode: Parser.SyntaxNode): number {
    if (astNode.type === 'import_from_statement') {
      const moduleNode = astNode.childForFieldName('module_name');
      if (moduleNode?.text) {
        let level = 0;
        for (const char of moduleNode.text) {
          if (char === '.') {
            level++;
          } else {
            break;
          }
        }
        return level;
      }
    }
    return 0;
  }

  /**
   * 判断是否有别名
   */
  private hasAliases(astNode: Parser.SyntaxNode): boolean {
    for (const child of astNode.children) {
      if (child.type === 'aliased_import') {
        return true;
      }
    }
    return false;
  }

  /**
   * 判断是否为标准库模块
   */
  private isStandardLibraryModule(astNode: Parser.SyntaxNode): boolean {
    const standardLibraryModules = [
      'os', 'sys', 'json', 're', 'math', 'datetime', 'collections',
      'itertools', 'functools', 'operator', 'pathlib', 'urllib', 'http',
      'socket', 'threading', 'multiprocessing', 'asyncio', 'logging',
      'unittest', 'argparse', 'configparser', 'sqlite3', 'csv', 'xml',
      'email', 'mime', 'base64', 'hashlib', 'hmac', 'secrets', 'uuid',
      'random', 'statistics', 'decimal', 'fractions', 'numbers', 'enum',
      'typing', 'dataclasses', 'contextlib', 'abc', 'copy', 'pickle',
      'shelve', 'struct', 'codecs', 'io', 'stringio', 'bytesio'
    ];

    const target = this.extractTarget(astNode);
    if (target) {
      const moduleName = target.split('.')[0];
      return standardLibraryModules.includes(moduleName);
    }
    return false;
  }

  /**
   * 判断是否为依赖关系节点
   */
  private isDependencyNode(astNode: Parser.SyntaxNode): boolean {
    const dependencyNodeTypes = [
      'import_statement',
      'import_from_statement'
    ];

    return dependencyNodeTypes.includes(astNode.type);
  }

  /**
   * 提取导入信息
   */
  extractImportInfo(importStmt: Parser.SyntaxNode): {
    source: string;
    importedSymbols: string[];
    isRelative: boolean;
    isWildcard: boolean;
    hasAliases: boolean;
  } | null {
    let source = '';
    const importedSymbols: string[] = [];
    let isRelative = false;
    let isWildcard = false;
    let hasAliases = false;

    const dependencyType = this.determineDependencyType(importStmt);
    
    if (dependencyType === 'import') {
      source = this.extractImportPath(importStmt) || '';
      isRelative = false;
      isWildcard = false;
    } else if (dependencyType === 'from_import' || dependencyType === 'relative_import' || dependencyType === 'wildcard_import') {
      source = this.extractFromModulePath(importStmt) || '';
      isRelative = this.isRelativeImport(importStmt);
      isWildcard = this.isWildcardImport(importStmt);
    }

    importedSymbols.push(...this.extractImportedSymbols(importStmt));
    hasAliases = this.hasAliases(importStmt);

    if (source) {
      return {
        source,
        importedSymbols,
        isRelative,
        isWildcard,
        hasAliases
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
      if (node.type === 'import_statement' || node.type === 'import_from_statement') {
        importStatements.push(node);
      }
    });

    return importStatements;
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
    moduleInfo: any;
    location: {
      filePath: string;
      lineNumber: number;
      columnNumber: number;
    };
  }> {
    const dependencies: Array<any> = [];
    const importStatements = this.findImportStatements(ast);

    for (const importStmt of importStatements) {
      const importInfo = this.extractImportInfo(importStmt);
      const dependencyType = this.determineDependencyType(importStmt);
      const target = this.extractTarget(importStmt);
      const importedSymbols = this.extractImportedSymbols(importStmt);
      const moduleInfo = this.extractModuleInfo(importStmt);

      if (importInfo && target) {
        dependencies.push({
          sourceId: NodeIdGenerator.forAstNode(importStmt),
          targetId: NodeIdGenerator.forSymbol(target, 'module', target, importStmt.startPosition.row),
          dependencyType: dependencyType || 'import',
          target,
          importedSymbols,
          moduleInfo,
          location: {
            filePath,
            lineNumber: importStmt.startPosition.row + 1,
            columnNumber: importStmt.startPosition.column + 1
          }
        });
      }
    }

    return dependencies;
  }
}