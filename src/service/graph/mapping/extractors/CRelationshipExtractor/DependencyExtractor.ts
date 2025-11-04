import {
  DependencyRelationship,
  SymbolResolver,
  Parser,
  LANGUAGE_NODE_MAPPINGS,
  BaseCRelationshipExtractor,
  injectable
} from '../types';

@injectable()
export class DependencyExtractor extends BaseCRelationshipExtractor {
  async extractDependencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DependencyRelationship[]> {
    const relationships: DependencyRelationship[] = [];

    // 查找预处理器包含指令
    const includeStatements = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].importDeclaration
    );

    for (const includeStmt of includeStatements) {
      const includeInfo = this.extractIncludeInfo(includeStmt);

      if (includeInfo) {
        // 使用符号解析器解析包含的头文件
        const resolvedTargetSymbol = symbolResolver.resolveSymbol(includeInfo.source, filePath, includeStmt);

        relationships.push({
          sourceId: this.generateNodeId(filePath, 'file', filePath),
          targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(includeInfo.source, 'header', includeInfo.source),
          dependencyType: 'include',
          target: includeInfo.source,
          importedSymbols: includeInfo.importedSymbols,
          location: {
            filePath,
            lineNumber: includeStmt.startPosition.row + 1
          },
          resolvedTargetSymbol: resolvedTargetSymbol || undefined
        });
      }
    }

    return relationships;
  }
}