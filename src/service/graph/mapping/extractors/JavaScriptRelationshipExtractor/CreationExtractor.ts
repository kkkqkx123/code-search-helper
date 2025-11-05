import {
  CreationRelationship,
  Parser,
  LANGUAGE_NODE_MAPPINGS,
  injectable,
  generateDeterministicNodeId
} from '../types';
import { BaseJavaScriptRelationshipExtractor } from './BaseJavaScriptRelationshipExtractor';

@injectable()
export class CreationExtractor extends BaseJavaScriptRelationshipExtractor {
  async extractCreationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<CreationRelationship[]> {
    const relationships: CreationRelationship[] = [];

    // 查找new表达式
    const newExpressions = this.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].callExpression.filter(type => type === 'new_expression')
    );

    for (const newExpr of newExpressions) {
      const className = this.extractClassNameFromNewExpression(newExpr);

      if (className) {
        relationships.push({
          sourceId: generateDeterministicNodeId(newExpr),
          targetId: this.generateNodeId(className, 'class', filePath),
          creationType: 'instantiation',
          targetName: className,
          location: {
            filePath,
            lineNumber: newExpr.startPosition.row + 1,
            columnNumber: newExpr.startPosition.column + 1
          },
          resolvedTargetSymbol: undefined
        });
      }
    }

    // 查找箭头函数、Lambda表达式
    const lambdaExpressions = this.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].lambdaExpression
    );

    for (const lambdaExpr of lambdaExpressions) {
      relationships.push({
        sourceId: generateDeterministicNodeId(lambdaExpr),
        targetId: this.generateNodeId('Function', 'builtin', filePath),
        creationType: 'instantiation',
        targetName: 'Function',
        location: {
          filePath,
          lineNumber: lambdaExpr.startPosition.row + 1,
          columnNumber: lambdaExpr.startPosition.column + 1
        },
        resolvedTargetSymbol: undefined
      });
    }

    // 查找变量声明、对象和数组字面量
    const variableDeclarations = this.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].variableDeclaration
    );

    for (const varDecl of variableDeclarations) {
      // 查找对象字面量
      const objectLiterals = this.findNodeByType(varDecl, 'object');
      for (const objectLiteral of objectLiterals) {
        const objectType = this.inferObjectType(objectLiteral);
        if (objectType) {
          relationships.push({
            sourceId: generateDeterministicNodeId(objectLiteral),
            targetId: this.generateNodeId(objectType, 'object', filePath),
            creationType: 'instantiation',
            targetName: objectType,
            location: {
              filePath,
              lineNumber: objectLiteral.startPosition.row + 1,
              columnNumber: objectLiteral.startPosition.column + 1
            },
            resolvedTargetSymbol: undefined
          });
        }
      }

      // 查找数组字面量
      const arrayLiterals = this.findNodeByType(varDecl, 'array');
      for (const arrayLiteral of arrayLiterals) {
        relationships.push({
          sourceId: generateDeterministicNodeId(arrayLiteral),
          targetId: this.generateNodeId('Array', 'builtin', filePath),
          creationType: 'instantiation',
          targetName: 'Array',
          location: {
            filePath,
            lineNumber: arrayLiteral.startPosition.row + 1,
            columnNumber: arrayLiteral.startPosition.column + 1
          },
          resolvedTargetSymbol: undefined
        });
      }
    }

    return relationships;
  }

  // JavaScript特定的辅助方法
  protected inferObjectType(objectLiteral: Parser.SyntaxNode): string | null {
    // 从对象字面量推断类型
    // This is a simplified implementation - in a real system you might look at properties
    // or assign a generic "Object" type
    return 'Object';
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

  // 辅助方法：按类型查找单个节点
  private findNodeByType(node: Parser.SyntaxNode, type: string): Parser.SyntaxNode[] {
    const nodes: Parser.SyntaxNode[] = [];
    
    function traverse(currentNode: Parser.SyntaxNode) {
      if (currentNode.type === type) {
        nodes.push(currentNode);
      }
      for (const child of currentNode.children) {
        traverse(child);
      }
    }
    
    traverse(node);
    return nodes;
  }
}