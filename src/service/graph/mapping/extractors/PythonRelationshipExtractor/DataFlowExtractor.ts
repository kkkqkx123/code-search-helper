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
  DataFlowRelationship,
  LANGUAGE_NODE_MAPPINGS
} from '../types';
import { BasePythonRelationshipExtractor } from './BasePythonRelationshipExtractor';

export class DataFlowExtractor extends BasePythonRelationshipExtractor {
  async extract(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<DataFlowRelationship[]> {
    const relationships: DataFlowRelationship[] = [];

    // 提取变量赋值数据流
    const assignments = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['python'].variableDeclaration
    );

    for (const assignment of assignments) {
      const dataFlowRelations = this.extractAssignmentDataFlow(
        assignment, filePath
      );
      relationships.push(...dataFlowRelations);
    }

    // 提取函数参数传递数据流
    const functionCalls = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['python'].callExpression
    );

    for (const call of functionCalls) {
      const parameterFlows = this.extractParameterDataFlow(
        call, filePath
      );
      relationships.push(...parameterFlows);
    }

    // 提取返回值数据流
    const returnStatements = this.treeSitterService.findNodeByType(ast, 'return_statement');
    for (const returnStmt of returnStatements) {
      const returnFlows = this.extractReturnDataFlow(
        returnStmt, filePath
      );
      relationships.push(...returnFlows);
    }

    return relationships;
  }

  // 数据流关系提取辅助方法
  protected extractAssignmentDataFlow(
    assignment: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): DataFlowRelationship[] {
    const relationships: DataFlowRelationship[] = [];

    // 提取变量赋值的源和目标
    const leftHandSide = assignment.firstChild; // 变量名
    const rightHandSide = assignment.lastChild; // 赋值表达式

    if (leftHandSide && rightHandSide) {
      const targetVar = leftHandSide.text;
      const sourceExpr = rightHandSide.text;

      // 解析目标变量符号
      const resolvedTargetSymbol = symbolResolver.resolveSymbol(targetVar, filePath, leftHandSide);

      // 递归查找源表达式中的变量
      const sourceVars = this.findVariablesInExpression(rightHandSide);
      
      for (const sourceVar of sourceVars) {
        const resolvedSourceSymbol = symbolResolver.resolveSymbol(sourceVar, filePath, rightHandSide);

        relationships.push({
          sourceId: this.generateNodeId(sourceVar, 'variable', filePath),
          targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(targetVar, 'variable', filePath),
          flowType: 'variable_assignment',
          dataType: 'variable',
          flowPath: [sourceVar, targetVar],
          location: {
            filePath,
            lineNumber: assignment.startPosition.row + 1,
            columnNumber: assignment.startPosition.column + 1
          },
          resolvedSourceSymbol: resolvedSourceSymbol || undefined,
          resolvedTargetSymbol: resolvedTargetSymbol || undefined
        });
      }
    }

    return relationships;
  }

  protected extractParameterDataFlow(
    callExpr: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): DataFlowRelationship[] {
    const relationships: DataFlowRelationship[] = [];

    // 提取函数调用的参数传递
    const calleeName = this.extractCalleeName(callExpr);
    if (calleeName) {
      const resolvedTargetSymbol = symbolResolver.resolveSymbol(calleeName, filePath, callExpr);

      // 查找参数
      const args = this.extractCallArguments(callExpr);
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const sourceVars = this.findVariablesInExpression(arg.node);

        for (const sourceVar of sourceVars) {
          const resolvedSourceSymbol = symbolResolver.resolveSymbol(sourceVar, filePath, arg.node);

          relationships.push({
            sourceId: this.generateNodeId(sourceVar, 'parameter', filePath),
            targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(calleeName, 'function', filePath),
            flowType: 'parameter_passing',
            dataType: arg.type,
            flowPath: [sourceVar, calleeName],
            location: {
              filePath,
              lineNumber: callExpr.startPosition.row + 1,
              columnNumber: callExpr.startPosition.column + 1
            },
            resolvedSourceSymbol: resolvedSourceSymbol || undefined,
            resolvedTargetSymbol: resolvedTargetSymbol || undefined
          });
        }
      }
    }

    return relationships;
  }

  protected extractReturnDataFlow(
    returnStmt: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): DataFlowRelationship[] {
    const relationships: DataFlowRelationship[] = [];

    // 查找return语句中的表达式
    const returnExpr = returnStmt.lastChild;
    if (returnExpr) {
      // 查找返回的变量
      const returnVars = this.findVariablesInExpression(returnExpr);

      // 找到包含return语句的函数
      const containingFunction = this.findContainingFunction(returnStmt);
      if (containingFunction) {
        const funcName = this.extractFunctionName(containingFunction);
        if (funcName) {
          const resolvedFuncSymbol = symbolResolver.resolveSymbol(funcName, filePath, containingFunction);

          for (const returnVar of returnVars) {
            const resolvedReturnSymbol = symbolResolver.resolveSymbol(returnVar, filePath, returnExpr);

            relationships.push({
              sourceId: this.generateNodeId(returnVar, 'return_value', filePath),
              targetId: resolvedFuncSymbol ? this.generateSymbolId(resolvedFuncSymbol) : this.generateNodeId(funcName, 'function', filePath),
              flowType: 'return_value',
              dataType: 'return',
              flowPath: [returnVar, funcName],
              location: {
                filePath,
                lineNumber: returnStmt.startPosition.row + 1,
                columnNumber: returnStmt.startPosition.column + 1
              },
              resolvedSourceSymbol: resolvedReturnSymbol || undefined,
              resolvedTargetSymbol: resolvedFuncSymbol || undefined
            });
          }
        }
      }
    }

    return relationships;
  }
}