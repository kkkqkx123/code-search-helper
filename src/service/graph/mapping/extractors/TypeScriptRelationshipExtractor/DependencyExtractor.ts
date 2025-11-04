import {
  DependencyRelationship,
  SymbolResolver,
  Symbol,
  Parser,
  LANGUAGE_NODE_MAPPINGS,
  BaseJavaScriptRelationshipExtractor,
  injectable
} from '../types';

@injectable()
export class DependencyExtractor extends BaseJavaScriptRelationshipExtractor {
  async extractDependencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DependencyRelationship[]> {
    const relationships: DependencyRelationship[] = [];

    // 查找导入和导出语句
    const importDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].importDeclaration
    );

    for (const importStmt of importDeclarations) {
      const importInfo = this.extractImportInfo(importStmt);

      if (importInfo) {
        // 使用符号解析器解析导入的模块
        const resolvedTargetSymbol = symbolResolver.resolveSymbol(importInfo.source, filePath, importStmt);

        relationships.push({
          sourceId: this.generateNodeId(filePath, 'file', filePath),
          targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(importInfo.source, 'module', importInfo.source),
          dependencyType: 'import',
          target: importInfo.source,
          importedSymbols: importInfo.importedSymbols,
          location: {
            filePath,
            lineNumber: importStmt.startPosition.row + 1
          },
          resolvedTargetSymbol: resolvedTargetSymbol || undefined
        });
      }
    }

    // 查找导出语句 (TypeScript specific)
    const exportDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].exportDeclaration
    );

    for (const exportStmt of exportDeclarations) {
      const exportInfo = this.extractExportInfo(exportStmt);

      if (exportInfo) {
        const resolvedTargetSymbol = symbolResolver.resolveSymbol(exportInfo.target, filePath, exportStmt);

        relationships.push({
          sourceId: this.generateNodeId(filePath, 'file', filePath),
          targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(exportInfo.target, 'symbol', filePath),
          dependencyType: 'export',
          target: exportInfo.target,
          importedSymbols: exportInfo.exportedSymbols,
          location: {
            filePath,
            lineNumber: exportStmt.startPosition.row + 1
          },
          resolvedTargetSymbol: resolvedTargetSymbol || undefined
        });
      }
    }

    // 查找类型导入 (TypeScript specific)
    const typeImports = this.treeSitterService.findNodeByType(ast, 'import_type');
    for (const typeImport of typeImports) {
      const sourceNode = this.treeSitterService.findNodeByType(typeImport, 'literal')[0];
      if (sourceNode) {
        const source = sourceNode.text.replace(/['"]/g, '');

        relationships.push({
          sourceId: this.generateNodeId(filePath, 'file', filePath),
          targetId: this.generateNodeId(source, 'module', source),
          dependencyType: 'type_dependency',
          target: source,
          importedSymbols: [],
          location: {
            filePath,
            lineNumber: typeImport.startPosition.row + 1
          }
        });
      }
    }

    return relationships;
  }

  // TypeScript特定的辅助方法
  protected extractExportInfo(exportStmt: Parser.SyntaxNode): {
    target: string;
    exportedSymbols: string[];
  } | null {
    // 实现提取导出信息逻辑
    let target = '';
    const exportedSymbols: string[] = [];

    for (const child of exportStmt.children) {
      // Find the source (usually a string literal in export from statements)
      if (child.type === 'string' || child.type === 'template_string') {
        target = child.text.replace(/['"`]/g, ''); // Remove quotes
      }
      // Find the export specifiers
      else if (child.type === 'export_clause' || child.type === 'export_specifier') {
        exportedSymbols.push(...this.extractExportSpecifiers(child));
      }
    }

    if (target || exportedSymbols.length > 0) {
      return {
        target: target || 'local',
        exportedSymbols
      };
    }
    return null;
  }

  protected extractExportSpecifiers(node: Parser.SyntaxNode): string[] {
    // 提取导出符号
    const specifiers: string[] = [];

    if (node.type === 'export_specifier') {
      for (const child of node.children) {
        if (child.type === 'identifier' || child.type === 'property_identifier') {
          specifiers.push(child.text || '');
          break;
        }
      }
    } else if (node.type === 'export_clause') {
      for (const child of node.children) {
        if (child.type === 'export_specifier') {
          specifiers.push(...this.extractExportSpecifiers(child));
        }
      }
    }

    return specifiers;
  }
}