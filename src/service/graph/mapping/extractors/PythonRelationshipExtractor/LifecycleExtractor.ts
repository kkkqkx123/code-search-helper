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
  LifecycleRelationship
} from '../types';
import { BasePythonRelationshipExtractor } from './BasePythonRelationshipExtractor';

export class LifecycleExtractor extends BasePythonRelationshipExtractor {
  async extract(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<LifecycleRelationship[]> {
    const relationships: LifecycleRelationship[] = [];

    // 提取类实例化关系
    const newExpressions = this.treeSitterService.findNodeByType(ast, 'call');
    for (const newExpr of newExpressions) {
      const instantiationRelations = this.extractInstantiationRelations(
        newExpr, filePath, symbolResolver
      );
      relationships.push(...instantiationRelations);
    }

    // 提取构造函数初始化关系
    const initMethods = this.treeSitterService.findNodesByTypes(ast,
      ['function_definition'] // In Python, __init__ is a function definition
    );
    for (const initMethod of initMethods) {
      const initRelations = this.extractInitializationRelations(
        initMethod, filePath, symbolResolver
      );
      relationships.push(...initRelations);
    }

    return relationships;
  }

  // 生命周期关系提取辅助方法
  protected extractInstantiationRelations(
    callExpr: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): LifecycleRelationship[] {
    const relationships: LifecycleRelationship[] = [];

    // 检查是否是类实例化调用
    const className = this.extractClassNameFromCallExpression(callExpr);
    if (className) {
      // 检查是否是对象实例化
      if (className[0] === className[0].toUpperCase()) { // 大写字母开头的通常为类名
        const resolvedTargetSymbol = symbolResolver.resolveSymbol(className, filePath, callExpr);

        // 查找调用实例化的位置
        const containingFunction = this.findContainingFunction(callExpr);
        if (containingFunction) {
          const funcName = this.extractFunctionName(containingFunction);
          if (funcName) {
            const resolvedSourceSymbol = symbolResolver.resolveSymbol(funcName, filePath, containingFunction);

            relationships.push({
              sourceId: resolvedSourceSymbol ? this.generateSymbolId(resolvedSourceSymbol) : this.generateNodeId(funcName, 'function', filePath),
              targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(className, 'class', filePath),
              lifecycleType: 'instantiates',
              lifecyclePhase: 'creation',
              location: {
                filePath,
                lineNumber: callExpr.startPosition.row + 1,
                columnNumber: callExpr.startPosition.column + 1
              },
              resolvedTargetSymbol: resolvedTargetSymbol || undefined
            });
          }
        }
      }
    }

    return relationships;
  }

  protected extractInitializationRelations(
    initMethod: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): LifecycleRelationship[] {
    const relationships: LifecycleRelationship[] = [];

    // 提取__init__方法中的初始化逻辑
    const className = this.findContainingClassName(initMethod);
    if (className) {
      const resolvedTargetSymbol = symbolResolver.resolveSymbol(className, filePath, initMethod);

      // 查找init方法的名称
      const initName = this.extractMethodName(initMethod);
      if (initName) {
        const resolvedSourceSymbol = symbolResolver.resolveSymbol(initName, filePath, initMethod);

        relationships.push({
          sourceId: resolvedSourceSymbol ? this.generateSymbolId(resolvedSourceSymbol) : this.generateNodeId(initName, 'method', filePath),
          targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(className, 'class', filePath),
          lifecycleType: 'initializes',
          lifecyclePhase: 'setup',
          location: {
            filePath,
            lineNumber: initMethod.startPosition.row + 1,
            columnNumber: initMethod.startPosition.column + 1
          },
          resolvedTargetSymbol: resolvedTargetSymbol || undefined
        });
      }
    }

    return relationships;
  }
}