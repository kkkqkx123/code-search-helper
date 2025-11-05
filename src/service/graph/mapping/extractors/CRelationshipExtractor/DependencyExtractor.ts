import {
  DependencyRelationship,
  Parser,
  LANGUAGE_NODE_MAPPINGS,
  BaseCRelationshipExtractor,
  injectable,
  generateDeterministicNodeId
} from '../types';

@injectable()
export class DependencyExtractor extends BaseCRelationshipExtractor {
  async extractDependencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<DependencyRelationship[]> {
    const relationships: DependencyRelationship[] = [];

    // 查找预处理器包含指令
    const includeStatements = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].importDeclaration
    );

    for (const includeStmt of includeStatements) {
      const includeInfo = this.extractIncludeInfo(includeStmt);

      if (includeInfo) {
        relationships.push({
          sourceId: generateDeterministicNodeId(includeStmt),
          targetId: this.generateNodeId(includeInfo.source, 'header', includeInfo.source),
          dependencyType: 'include',
          target: includeInfo.source,
          importedSymbols: includeInfo.importedSymbols,
          location: {
            filePath,
            lineNumber: includeStmt.startPosition.row + 1
          }
        });
      }
    }

    return relationships;
  }
}