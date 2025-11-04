import {
  CreationRelationship,
  SymbolResolver,
  Symbol,
  Parser,
  LANGUAGE_NODE_MAPPINGS,
  injectable
} from '../types';
import { BaseJavaScriptRelationshipExtractor } from './BaseJavaScriptRelationshipExtractor';

@injectable()
export class CreationExtractor extends BaseJavaScriptRelationshipExtractor {
  async extractCreationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<CreationRelationship[]> {
    const relationships: CreationRelationship[] = [];

    // 查找new表达式
    const newExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].callExpression.filter(type => type === 'new_expression')
    );

    for (const newExpr of newExpressions) {
      const className = this.extractClassNameFromNewExpression(newExpr);

      if (className) {
        // 使用符号解析器解析类符号
        const resolvedSymbol = symbolResolver.resolveSymbol(className, filePath, newExpr);

        relationships.push({
          sourceId: this.generateNodeId(`creation_${newExpr.startPosition.row}`, 'creation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(className, 'class', filePath),
          creationType: 'instantiation',
          targetName: className,
          location: {
            filePath,
            lineNumber: newExpr.startPosition.row + 1,
            columnNumber: newExpr.startPosition.column + 1
          },
          resolvedTargetSymbol: resolvedSymbol || undefined
        });
      }
    }

    // 查找箭头函数、Lambda表达式
    const lambdaExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].lambdaExpression
    );

    for (const lambdaExpr of lambdaExpressions) {
      relationships.push({
        sourceId: this.generateNodeId(`lambda_creation_${lambdaExpr.startPosition.row}`, 'creation', filePath),
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
    const variableDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].variableDeclaration
    );

    for (const varDecl of variableDeclarations) {
      // 查找对象字面量
      const objectLiterals = this.treeSitterService.findNodeByType(varDecl, 'object');
      for (const objectLiteral of objectLiterals) {
        const objectType = this.inferObjectType(objectLiteral);
        if (objectType) {
          const resolvedSymbol = symbolResolver.resolveSymbol(objectType, filePath, objectLiteral);

          relationships.push({
            sourceId: this.generateNodeId(`object_creation_${objectLiteral.startPosition.row}`, 'creation', filePath),
            targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(objectType, 'object', filePath),
            creationType: 'instantiation',
            targetName: objectType,
            location: {
              filePath,
              lineNumber: objectLiteral.startPosition.row + 1,
              columnNumber: objectLiteral.startPosition.column + 1
            },
            resolvedTargetSymbol: resolvedSymbol || undefined
          });
        }
      }

      // 查找数组字面量
      const arrayLiterals = this.treeSitterService.findNodeByType(varDecl, 'array');
      for (const arrayLiteral of arrayLiterals) {
        relationships.push({
          sourceId: this.generateNodeId(`array_creation_${arrayLiteral.startPosition.row}`, 'creation', filePath),
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
}