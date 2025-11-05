import {
  DependencyRelationship,
  Parser,
  LANGUAGE_NODE_MAPPINGS,
  injectable,
  generateDeterministicNodeId
} from '../types';
import { BaseJavaScriptRelationshipExtractor } from './BaseJavaScriptRelationshipExtractor';

@injectable()
export class DependencyExtractor extends BaseJavaScriptRelationshipExtractor {
  async extractDependencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<DependencyRelationship[]> {
    const relationships: DependencyRelationship[] = [];

    // 查找导入语句
    const importStatements = this.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].importDeclaration
    );

    for (const importStmt of importStatements) {
      const importInfo = this.extractImportInfo(importStmt);

      if (importInfo) {
        relationships.push({
          sourceId: generateDeterministicNodeId(importStmt),
          targetId: this.generateNodeId(importInfo.source, 'module', importInfo.source),
          dependencyType: 'import',
          target: importInfo.source,
          importedSymbols: importInfo.importedSymbols,
          location: {
            filePath,
            lineNumber: importStmt.startPosition.row + 1,
            columnNumber: importStmt.startPosition.column + 1
          },
          resolvedTargetSymbol: undefined
        });
      }
    }

    // 查找导出语句 (JavaScript also has export statements)
    const exportStatements = this.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].exportDeclaration
    );

    for (const exportStmt of exportStatements) {
      const exportInfo = this.extractExportInfo(exportStmt);

      if (exportInfo) {
        relationships.push({
          sourceId: generateDeterministicNodeId(exportStmt),
          targetId: this.generateNodeId(exportInfo.target, 'symbol', filePath),
          dependencyType: 'export',
          target: exportInfo.target,
          importedSymbols: exportInfo.exportedSymbols,
          location: {
            filePath,
            lineNumber: exportStmt.startPosition.row + 1,
            columnNumber: exportStmt.startPosition.column + 1
          },
          resolvedTargetSymbol: undefined
        });
      }
    }

    return relationships;
  }

  // JavaScript特定的辅助方法
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

  // 辅助方法：按类型查找节点
  private findNodesByTypes(ast: Parser.SyntaxNode, types: string[]): Parser.SyntaxNode[] {
    const nodes: Parser.SyntaxNode[] = [];
    
    function traverse(node: Parser.SyntaxNode) {
      if (types.includes(node.type)) {
        nodes.push(node);
      }
      for (const child of node.children) {
        traverse(child);
      }
    }
    
    traverse(ast);
    return nodes;
  }
}