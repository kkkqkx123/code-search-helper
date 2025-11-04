import {
  SymbolResolver,
  Symbol,
  SymbolType,
  TreeSitterService,
  LoggerService,
  inject,
  injectable,
  TYPES,
  Parser,
  CreationRelationship,
  LANGUAGE_NODE_MAPPINGS
} from '../types';
import { BasePythonRelationshipExtractor } from './BasePythonRelationshipExtractor';

export class CreationExtractor extends BasePythonRelationshipExtractor {
  async extract(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<CreationRelationship[]> {
    const relationships: CreationRelationship[] = [];

    // 查找类实例化调用
    const callExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['python'].callExpression
    );

    for (const callExpr of callExpressions) {
      const className = this.extractClassNameFromCallExpression(callExpr);

      if (className) {
        // 使用符号解析器解析类符号
        const resolvedSymbol = symbolResolver.resolveSymbol(className, filePath, callExpr);

        relationships.push({
          sourceId: this.generateNodeId(`creation_${callExpr.startPosition.row}`, 'creation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(className, 'class', filePath),
          creationType: 'instantiation',
          targetName: className,
          location: {
            filePath,
            lineNumber: callExpr.startPosition.row + 1,
            columnNumber: callExpr.startPosition.column + 1
          },
          resolvedTargetSymbol: resolvedSymbol || undefined
        });
      }
    }

    // 查找Lambda表达式
    const lambdaExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['python'].lambdaExpression
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

    // 查找变量声明中的对象创建
    const variableDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['python'].variableDeclaration
    );

    for (const varDecl of variableDeclarations) {
      // 查找字典字面量
      const dictLiterals = this.treeSitterService.findNodeByType(varDecl, 'dictionary');
      for (const dictLiteral of dictLiterals) {
        relationships.push({
          sourceId: this.generateNodeId(`dict_creation_${dictLiteral.startPosition.row}`, 'creation', filePath),
          targetId: this.generateNodeId('dict', 'builtin', filePath),
          creationType: 'instantiation',
          targetName: 'dict',
          location: {
            filePath,
            lineNumber: dictLiteral.startPosition.row + 1,
            columnNumber: dictLiteral.startPosition.column + 1
          },
          resolvedTargetSymbol: undefined
        });
      }

      // 查找列表字面量
      const listLiterals = this.treeSitterService.findNodeByType(varDecl, 'list');
      for (const listLiteral of listLiterals) {
        relationships.push({
          sourceId: this.generateNodeId(`list_creation_${listLiteral.startPosition.row}`, 'creation', filePath),
          targetId: this.generateNodeId('list', 'builtin', filePath),
          creationType: 'instantiation',
          targetName: 'list',
          location: {
            filePath,
            lineNumber: listLiteral.startPosition.row + 1,
            columnNumber: listLiteral.startPosition.column + 1
          },
          resolvedTargetSymbol: undefined
        });
      }

      // 查找集合字面量
      const setLiterals = this.treeSitterService.findNodeByType(varDecl, 'set');
      for (const setLiteral of setLiterals) {
        relationships.push({
          sourceId: this.generateNodeId(`set_creation_${setLiteral.startPosition.row}`, 'creation', filePath),
          targetId: this.generateNodeId('set', 'builtin', filePath),
          creationType: 'instantiation',
          targetName: 'set',
          location: {
            filePath,
            lineNumber: setLiteral.startPosition.row + 1,
            columnNumber: setLiteral.startPosition.column + 1
          },
          resolvedTargetSymbol: undefined
        });
      }
    }

    return relationships;
  }
}