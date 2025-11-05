import {
  InheritanceRelationship,
  Parser,
  LANGUAGE_NODE_MAPPINGS,
  injectable,
  generateDeterministicNodeId
} from '../types';
import { BaseJavaScriptRelationshipExtractor } from './BaseJavaScriptRelationshipExtractor';

@injectable()
export class InheritanceExtractor extends BaseJavaScriptRelationshipExtractor {
  async extractInheritanceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<InheritanceRelationship[]> {
    const relationships: InheritanceRelationship[] = [];

    // 查找类声明
    const classDeclarations = this.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].classDeclaration
    );

    for (const classDecl of classDeclarations) {
      const className = this.extractClassName(classDecl);
      const heritageClauses = this.findHeritageClauses(classDecl);

      if (className && heritageClauses) {
        for (const heritageClause of heritageClauses) {
          const parentClassName = this.extractParentClassName(heritageClause);
          const inheritanceType = this.getInheritanceType(heritageClause);

          if (parentClassName) {
            relationships.push({
              parentId: this.generateNodeId(parentClassName, 'class', filePath),
              childId: this.generateNodeId(className, 'class', filePath),
              inheritanceType,
              location: {
                filePath,
                lineNumber: classDecl.startPosition.row + 1,
                columnNumber: classDecl.startPosition.column + 1
              },
              resolvedParentSymbol: undefined,
              resolvedChildSymbol: undefined
            });
          }
        }
      }
    }

    return relationships;
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