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
  ControlFlowRelationship
} from '../types';
import { BasePythonRelationshipExtractor } from './BasePythonRelationshipExtractor';

export class ControlFlowExtractor extends BasePythonRelationshipExtractor {
  async extract(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ControlFlowRelationship[]> {
    const relationships: ControlFlowRelationship[] = [];

    // 提取条件语句控制流
    const ifStatements = this.treeSitterService.findNodeByType(ast, 'if_statement');
    for (const ifStmt of ifStatements) {
      const conditionalFlows = this.extractConditionalControlFlow(
        ifStmt, filePath, symbolResolver
      );
      relationships.push(...conditionalFlows);
    }

    // 提取异常处理控制流
    const tryStatements = this.treeSitterService.findNodeByType(ast, 'try_statement');
    for (const tryStmt of tryStatements) {
      const exceptionFlows = this.extractExceptionControlFlow(
        tryStmt, filePath, symbolResolver
      );
      relationships.push(...exceptionFlows);
    }

    // 提取异步控制流
    const awaitExpressions = this.treeSitterService.findNodeByType(ast, 'await');
    for (const awaitExpr of awaitExpressions) {
      const asyncFlows = this.extractAsyncControlFlow(
        awaitExpr, filePath, symbolResolver
      );
      relationships.push(...asyncFlows);
    }

    // 提取循环控制流
    const forStatements = this.treeSitterService.findNodeByType(ast, 'for_statement');
    const whileStatements = this.treeSitterService.findNodeByType(ast, 'while_statement');
    for (const loopStmt of [...forStatements, ...whileStatements]) {
      const loopFlows = this.extractLoopControlFlow(
        loopStmt, filePath, symbolResolver
      );
      relationships.push(...loopFlows);
    }

    return relationships;
  }

  // 控制流关系提取辅助方法
  protected extractConditionalControlFlow(
    ifStmt: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): ControlFlowRelationship[] {
    const relationships: ControlFlowRelationship[] = [];

    // 提取条件表达式
    const condition = ifStmt.child(0); // if的条件部分
    if (condition && condition.text) {
      // 查找条件中涉及的变量
      const conditionVars = this.findVariablesInExpression(condition);

      // 找到条件语句中的函数
      const containingFunction = this.findContainingFunction(ifStmt);
      if (containingFunction) {
        const funcName = this.extractFunctionName(containingFunction);
        if (funcName) {
          for (const varName of conditionVars) {
            const resolvedVarSymbol = symbolResolver.resolveSymbol(varName, filePath, condition);
            const resolvedFuncSymbol = symbolResolver.resolveSymbol(funcName, filePath, containingFunction);

            relationships.push({
              sourceId: this.generateNodeId(varName, 'condition', filePath),
              targetId: resolvedFuncSymbol ? this.generateSymbolId(resolvedFuncSymbol) : this.generateNodeId(funcName, 'function', filePath),
              flowType: 'conditional',
              condition: condition.text,
              isExceptional: false,
              location: {
                filePath,
                lineNumber: ifStmt.startPosition.row + 1,
                columnNumber: ifStmt.startPosition.column + 1
              },
              resolvedSymbol: resolvedVarSymbol || undefined
            });
          }
        }
      }
    }

    return relationships;
  }

  protected extractExceptionControlFlow(
    tryStmt: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): ControlFlowRelationship[] {
    const relationships: ControlFlowRelationship[] = [];

    // 查找try块中的代码
    const tryBlock = tryStmt.child(1); // try块通常在第二个子节点
    if (tryBlock) {
      // 提取try块中可能抛出异常的代码
      const containingFunction = this.findContainingFunction(tryStmt);
      if (containingFunction) {
        const funcName = this.extractFunctionName(containingFunction);
        if (funcName) {
          const resolvedFuncSymbol = symbolResolver.resolveSymbol(funcName, filePath, containingFunction);

          relationships.push({
            sourceId: this.generateNodeId(`try_block_${tryStmt.startPosition.row}`, 'exception', filePath),
            targetId: resolvedFuncSymbol ? this.generateSymbolId(resolvedFuncSymbol) : this.generateNodeId(funcName, 'function', filePath),
            flowType: 'exception',
            condition: 'try-except block',
            isExceptional: true,
            location: {
              filePath,
              lineNumber: tryStmt.startPosition.row + 1,
              columnNumber: tryStmt.startPosition.column + 1
            },
            resolvedSymbol: resolvedFuncSymbol || undefined
          });
        }
      }
    }

    return relationships;
  }

  protected extractAsyncControlFlow(
    awaitExpr: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): ControlFlowRelationship[] {
    const relationships: ControlFlowRelationship[] = [];

    // 查找await表达式中的函数调用
    const awaitContent = awaitExpr.child(0);
    if (awaitContent) {
      const funcName = awaitContent.text;
      if (funcName) {
        const resolvedFuncSymbol = symbolResolver.resolveSymbol(funcName, filePath, awaitExpr);

        // 查找包含await的异步函数
        const containingFunction = this.findContainingAsyncFunction(awaitExpr);
        if (containingFunction) {
          const asyncFuncName = this.extractFunctionName(containingFunction);
          if (asyncFuncName) {
            const resolvedAsyncFuncSymbol = symbolResolver.resolveSymbol(asyncFuncName, filePath, containingFunction);

            relationships.push({
              sourceId: resolvedFuncSymbol ? this.generateSymbolId(resolvedFuncSymbol) : this.generateNodeId(funcName, 'async_function', filePath),
              targetId: resolvedAsyncFuncSymbol ? this.generateSymbolId(resolvedAsyncFuncSymbol) : this.generateNodeId(asyncFuncName, 'async_function', filePath),
              flowType: 'async_await',
              condition: funcName,
              isExceptional: false,
              location: {
                filePath,
                lineNumber: awaitExpr.startPosition.row + 1,
                columnNumber: awaitExpr.startPosition.column + 1
              },
              resolvedSymbol: resolvedAsyncFuncSymbol || undefined
            });
          }
        }
      }
    }

    return relationships;
  }

  protected extractLoopControlFlow(
    loopStmt: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): ControlFlowRelationship[] {
    const relationships: ControlFlowRelationship[] = [];

    // 提取循环条件和循环体
    const condition = loopStmt.child(0);
    if (condition && condition.text) {
      const conditionVars = this.findVariablesInExpression(condition);

      const containingFunction = this.findContainingFunction(loopStmt);
      if (containingFunction) {
        const funcName = this.extractFunctionName(containingFunction);
        if (funcName) {
          const resolvedFuncSymbol = symbolResolver.resolveSymbol(funcName, filePath, containingFunction);

          for (const varName of conditionVars) {
            const resolvedVarSymbol = symbolResolver.resolveSymbol(varName, filePath, condition);

            relationships.push({
              sourceId: this.generateNodeId(varName, 'loop_condition', filePath),
              targetId: resolvedFuncSymbol ? this.generateSymbolId(resolvedFuncSymbol) : this.generateNodeId(funcName, 'function', filePath),
              flowType: 'loop',
              condition: condition.text,
              isExceptional: false,
              location: {
                filePath,
                lineNumber: loopStmt.startPosition.row + 1,
                columnNumber: loopStmt.startPosition.column + 1
              },
              resolvedSymbol: resolvedVarSymbol || undefined
            });
          }
        }
      }
    }

    return relationships;
  }
}