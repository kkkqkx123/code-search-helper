import { generateDeterministicNodeId } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * Rust依赖关系提取器
 * 处理use语句、extern crate声明、模块依赖等
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
        filePath: symbolTable?.filePath || 'current_file.rs',
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
  private determineDependencyType(astNode: Parser.SyntaxNode): 'use' | 'extern_crate' | 'mod' | 'macro_use' | 'macro_export' | null {
    const nodeType = astNode.type;

    if (nodeType === 'use_declaration') {
      return 'use';
    } else if (nodeType === 'extern_crate_declaration') {
      return 'extern_crate';
    } else if (nodeType === 'mod_item') {
      return 'mod';
    } else if (nodeType === 'attribute_item' && astNode.text?.includes('macro_use')) {
      return 'macro_use';
    } else if (nodeType === 'attribute_item' && astNode.text?.includes('macro_export')) {
      return 'macro_export';
    }

    return null;
  }

  /**
   * 提取依赖关系的节点
   */
  private extractDependencyNodes(astNode: Parser.SyntaxNode, dependencyType: string): { fromNodeId: string; toNodeId: string } {
    let fromNodeId = generateDeterministicNodeId(astNode);
    let toNodeId = 'unknown';

    if (dependencyType === 'use') {
      const usePath = this.extractUsePath(astNode);
      if (usePath) {
        toNodeId = this.generateNodeId(usePath, 'module', usePath);
      }
    } else if (dependencyType === 'extern_crate') {
      const crateName = this.extractCrateName(astNode);
      if (crateName) {
        toNodeId = this.generateNodeId(crateName, 'crate', crateName);
      }
    } else if (dependencyType === 'mod') {
      const moduleName = this.extractModuleName(astNode);
      if (moduleName) {
        toNodeId = this.generateNodeId(moduleName, 'module', 'current_file.rs');
      }
    } else if (dependencyType === 'macro_use' || dependencyType === 'macro_export') {
      const macroName = this.extractMacroName(astNode);
      if (macroName) {
        toNodeId = this.generateNodeId(macroName, 'macro', 'current_file.rs');
      }
    }

    return { fromNodeId, toNodeId };
  }

  /**
   * 提取use路径
   */
  private extractUsePath(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'use_declaration') {
      const argument = astNode.childForFieldName('argument');
      if (argument?.text) {
        return argument.text;
      }
    }
    return null;
  }

  /**
   * 提取crate名称
   */
  private extractCrateName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'extern_crate_declaration') {
      const nameNode = astNode.childForFieldName('name');
      if (nameNode?.type === 'identifier') {
        return nameNode.text || null;
      }
    }
    return null;
  }

  /**
   * 提取模块名称
   */
  private extractModuleName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'mod_item') {
      const nameNode = astNode.childForFieldName('name');
      if (nameNode?.type === 'identifier') {
        return nameNode.text || null;
      }
    }
    return null;
  }

  /**
   * 提取宏名称
   */
  private extractMacroName(astNode: Parser.SyntaxNode): string | null {
    if (astNode.type === 'attribute_item') {
      const text = astNode.text || '';
      const macroMatch = text.match(/macro_use\s*\(\s*([^\)]+)\s*\)/);
      if (macroMatch) {
        return macroMatch[1];
      }
    }
    return null;
  }

  /**
   * 提取目标
   */
  private extractTarget(astNode: Parser.SyntaxNode): string | null {
    const dependencyType = this.determineDependencyType(astNode);

    if (dependencyType === 'use') {
      return this.extractUsePath(astNode);
    } else if (dependencyType === 'extern_crate') {
      return this.extractCrateName(astNode);
    } else if (dependencyType === 'mod') {
      return this.extractModuleName(astNode);
    } else if (dependencyType === 'macro_use' || dependencyType === 'macro_export') {
      return this.extractMacroName(astNode);
    }

    return null;
  }

  /**
   * 提取导入的符号
   */
  private extractImportedSymbols(astNode: Parser.SyntaxNode): string[] {
    const symbols: string[] = [];
    const dependencyType = this.determineDependencyType(astNode);

    if (dependencyType === 'use') {
      const argument = astNode.childForFieldName('argument');
      if (argument) {
        // 处理不同的use语法
        if (argument.type === 'use_as_clause') {
          // 处理别名导入
          const path = argument.childForFieldName('path');
          const alias = argument.childForFieldName('alias');
          if (path?.text) {
            symbols.push(path.text);
          }
          if (alias?.text) {
            symbols.push(alias.text);
          }
        } else if (argument.type === 'use_list') {
          // 处理列表导入
          for (const child of argument.children) {
            if (child.type === 'scoped_identifier' || child.type === 'identifier') {
              symbols.push(child.text || '');
            } else if (child.type === 'use_as_clause') {
              const path = child.childForFieldName('path');
              const alias = child.childForFieldName('alias');
              if (path?.text) {
                symbols.push(path.text);
              }
              if (alias?.text) {
                symbols.push(alias.text);
              }
            }
          }
        } else if (argument.type === 'scoped_identifier' || argument.type === 'identifier') {
          // 处理简单导入
          symbols.push(argument.text || '');
        }
      }
    } else if (dependencyType === 'extern_crate') {
      const crateName = this.extractCrateName(astNode);
      if (crateName) {
        symbols.push(crateName);
      }
    } else if (dependencyType === 'mod') {
      const moduleName = this.extractModuleName(astNode);
      if (moduleName) {
        symbols.push(moduleName);
      }
    }

    return symbols;
  }

  /**
   * 提取模块信息
   */
  private extractModuleInfo(astNode: Parser.SyntaxNode): any {
    const moduleInfo: any = {};
    const dependencyType = this.determineDependencyType(astNode);

    if (dependencyType === 'use') {
      const usePath = this.extractUsePath(astNode);
      if (usePath) {
        moduleInfo.isExternal = this.isExternalModule(usePath);
        moduleInfo.isStandardLibrary = this.isStandardLibraryModule(usePath);
        moduleInfo.isCrate = this.isCrateModule(usePath);
        moduleInfo.isSelf = usePath === 'self';
        moduleInfo.isSuper = usePath === 'super';
        moduleInfo.pathComponents = usePath.split('::');
      }
    } else if (dependencyType === 'extern_crate') {
      moduleInfo.isExternal = true;
      moduleInfo.isCrate = true;
    } else if (dependencyType === 'mod') {
      moduleInfo.isLocal = true;
    } else if (dependencyType === 'macro_use' || dependencyType === 'macro_export') {
      moduleInfo.isMacro = true;
    }

    return moduleInfo;
  }

  /**
   * 判断是否为外部模块
   */
  private isExternalModule(usePath: string): boolean {
    // 简单启发式：以大写字母开头的可能是外部crate
    const firstComponent = usePath.split('::')[0];
    return !!(firstComponent && firstComponent[0] === firstComponent[0].toUpperCase());
  }

  /**
   * 判断是否为标准库模块
   */
  private isStandardLibraryModule(usePath: string): boolean {
    const standardLibraryCrates = [
      'std', 'core', 'alloc', 'proc_macro', 'test'
    ];

    const firstComponent = usePath.split('::')[0];
    return standardLibraryCrates.includes(firstComponent);
  }

  /**
   * 判断是否为crate模块
   */
  private isCrateModule(usePath: string): boolean {
    return usePath.startsWith('crate::');
  }

  /**
   * 判断是否为依赖关系节点
   */
  private isDependencyNode(astNode: Parser.SyntaxNode): boolean {
    const dependencyNodeTypes = [
      'use_declaration',
      'extern_crate_declaration',
      'mod_item',
      'attribute_item'
    ];

    return dependencyNodeTypes.includes(astNode.type);
  }

  /**
   * 提取导入信息
   */
  extractImportInfo(importStmt: Parser.SyntaxNode): {
    source: string;
    importedSymbols: string[];
    isExternal: boolean;
    isStandardLibrary: boolean;
    isCrate: boolean;
  } | null {
    let source = '';
    const importedSymbols: string[] = [];
    let isExternal = false;
    let isStandardLibrary = false;
    let isCrate = false;

    const dependencyType = this.determineDependencyType(importStmt);
    
    if (dependencyType === 'use') {
      source = this.extractUsePath(importStmt) || '';
      const usePath = source;
      isExternal = this.isExternalModule(usePath);
      isStandardLibrary = this.isStandardLibraryModule(usePath);
      isCrate = this.isCrateModule(usePath);
    } else if (dependencyType === 'extern_crate') {
      source = this.extractCrateName(importStmt) || '';
      isExternal = true;
      isCrate = true;
    } else if (dependencyType === 'mod') {
      source = this.extractModuleName(importStmt) || '';
    }

    importedSymbols.push(...this.extractImportedSymbols(importStmt));

    if (source) {
      return {
        source,
        importedSymbols,
        isExternal,
        isStandardLibrary,
        isCrate
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
   * 查找use声明
   */
  findUseDeclarations(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const useDeclarations: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'use_declaration') {
        useDeclarations.push(node);
      }
    });

    return useDeclarations;
  }

  /**
   * 查找extern crate声明
   */
  findExternCrateDeclarations(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const externCrateDeclarations: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'extern_crate_declaration') {
        externCrateDeclarations.push(node);
      }
    });

    return externCrateDeclarations;
  }

  /**
   * 查找模块声明
   */
  findModDeclarations(ast: Parser.SyntaxNode): Parser.SyntaxNode[] {
    const modDeclarations: Parser.SyntaxNode[] = [];

    this.traverseTree(ast, (node) => {
      if (node.type === 'mod_item') {
        modDeclarations.push(node);
      }
    });

    return modDeclarations;
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
    const useDeclarations = this.findUseDeclarations(ast);
    const externCrateDeclarations = this.findExternCrateDeclarations(ast);
    const modDeclarations = this.findModDeclarations(ast);

    // 处理use声明
    for (const useDecl of useDeclarations) {
      const importInfo = this.extractImportInfo(useDecl);
      const dependencyType = this.determineDependencyType(useDecl);
      const target = this.extractTarget(useDecl);
      const importedSymbols = this.extractImportedSymbols(useDecl);
      const moduleInfo = this.extractModuleInfo(useDecl);

      if (importInfo && target) {
        dependencies.push({
          sourceId: generateDeterministicNodeId(useDecl),
          targetId: this.generateNodeId(target, 'module', target),
          dependencyType: dependencyType || 'use',
          target,
          importedSymbols,
          moduleInfo,
          location: {
            filePath,
            lineNumber: useDecl.startPosition.row + 1,
            columnNumber: useDecl.startPosition.column + 1
          }
        });
      }
    }

    // 处理extern crate声明
    for (const externCrateDecl of externCrateDeclarations) {
      const dependencyType = this.determineDependencyType(externCrateDecl);
      const target = this.extractTarget(externCrateDecl);
      const importedSymbols = this.extractImportedSymbols(externCrateDecl);
      const moduleInfo = this.extractModuleInfo(externCrateDecl);

      if (target) {
        dependencies.push({
          sourceId: generateDeterministicNodeId(externCrateDecl),
          targetId: this.generateNodeId(target, 'crate', target),
          dependencyType: dependencyType || 'extern_crate',
          target,
          importedSymbols,
          moduleInfo,
          location: {
            filePath,
            lineNumber: externCrateDecl.startPosition.row + 1,
            columnNumber: externCrateDecl.startPosition.column + 1
          }
        });
      }
    }

    // 处理模块声明
    for (const modDecl of modDeclarations) {
      const dependencyType = this.determineDependencyType(modDecl);
      const target = this.extractTarget(modDecl);
      const importedSymbols = this.extractImportedSymbols(modDecl);
      const moduleInfo = this.extractModuleInfo(modDecl);

      if (target) {
        dependencies.push({
          sourceId: generateDeterministicNodeId(modDecl),
          targetId: this.generateNodeId(target, 'module', filePath),
          dependencyType: dependencyType || 'mod',
          target,
          importedSymbols,
          moduleInfo,
          location: {
            filePath,
            lineNumber: modDecl.startPosition.row + 1,
            columnNumber: modDecl.startPosition.column + 1
          }
        });
      }
    }

    return dependencies;
  }
}