import {
  ControlFlowRelationship,
  SymbolResolver,
  Parser,
  BaseCRelationshipExtractor,
  injectable
} from '../types';

@injectable()
export class ControlFlowExtractor extends BaseCRelationshipExtractor {
  async extractControlFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ControlFlowRelationship[]> {
    const relationships: ControlFlowRelationship[] = [];

    try {
      // 使用C语言的控制流关系查询
      const controlFlowQuery = require('../../parser/constants/queries/c/control-flow-relationships').default;
      const queryResults = this.treeSitterService.queryTree(ast, controlFlowQuery);

      for (const result of queryResults) {
        const captures = result.captures;

        // 处理条件控制流
        const conditionVars = captures.filter(capture =>
          capture.name.startsWith('source') && capture.name.includes('condition')
        );
        const blockTargets = captures.filter(capture =>
          capture.name.startsWith('target') && capture.name.includes('block')
        );

        for (const conditionVar of conditionVars) {
          for (const blockTarget of blockTargets) {
            const conditionName = conditionVar.node.text;
            const blockType = blockTarget.node.type;

            if (conditionName) {
              const resolvedSymbol = symbolResolver.resolveSymbol(conditionName, filePath, conditionVar.node);

              relationships.push({
                sourceId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(conditionName, 'condition', filePath),
                targetId: this.generateNodeId(`block_${blockTarget.node.startPosition.row}`, 'control_block', filePath),
                flowType: 'conditional',
                condition: conditionName,
                isExceptional: false,
                location: {
                  filePath,
                  lineNumber: conditionVar.node.startPosition.row + 1,
                  columnNumber: conditionVar.node.startPosition.column + 1
                },
                resolvedSymbol: resolvedSymbol || undefined
              });
            }
          }
        }

        // 处理循环控制流
        const loopConditions = captures.filter(capture =>
          capture.name.startsWith('source') && capture.name.includes('condition')
        );
        const loopBlocks = captures.filter(capture =>
          capture.name.startsWith('target') && capture.name.includes('block')
        );

        for (const loopCondition of loopConditions) {
          for (const loopBlock of loopBlocks) {
            const conditionName = loopCondition.node.text;
            const blockType = loopBlock.node.type;

            if (conditionName) {
              const resolvedSymbol = symbolResolver.resolveSymbol(conditionName, filePath, loopCondition.node);

              relationships.push({
                sourceId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(conditionName, 'loop_condition', filePath),
                targetId: this.generateNodeId(`loop_block_${loopBlock.node.startPosition.row}`, 'loop_block', filePath),
                flowType: 'loop',
                condition: conditionName,
                isExceptional: false,
                location: {
                  filePath,
                  lineNumber: loopCondition.node.startPosition.row + 1,
                  columnNumber: loopCondition.node.startPosition.column + 1
                },
                resolvedSymbol: resolvedSymbol || undefined
              });
            }
          }
        }

        // 处理异常控制流（如goto语句）
        const gotoTargets = captures.filter(capture =>
          capture.name.startsWith('target') && capture.name.includes('label')
        );

        for (const gotoTarget of gotoTargets) {
          const labelName = gotoTarget.node.text;
          const resolvedSymbol = symbolResolver.resolveSymbol(labelName, filePath, gotoTarget.node);

          relationships.push({
            sourceId: this.generateNodeId(`goto_${gotoTarget.node.startPosition.row}`, 'goto', filePath),
            targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(labelName, 'label', filePath),
            flowType: 'exception',
            condition: `goto ${labelName}`,
            isExceptional: true,
            location: {
              filePath,
              lineNumber: gotoTarget.node.startPosition.row + 1,
              columnNumber: gotoTarget.node.startPosition.column + 1
            },
            resolvedSymbol: resolvedSymbol || undefined
          });
        }

        // 处理函数调用控制流
        const funcCalls = captures.filter(capture =>
          capture.name.startsWith('target') && capture.name.includes('function')
        );

        for (const funcCall of funcCalls) {
          const funcName = funcCall.node.text;
          const resolvedSymbol = symbolResolver.resolveSymbol(funcName, filePath, funcCall.node);

          relationships.push({
            sourceId: this.generateNodeId(`call_${funcCall.node.startPosition.row}`, 'function_call', filePath),
            targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(funcName, 'function', filePath),
            flowType: 'callback',
            condition: funcName,
            isExceptional: false,
            location: {
              filePath,
              lineNumber: funcCall.node.startPosition.row + 1,
              columnNumber: funcCall.node.startPosition.column + 1
            },
            resolvedSymbol: resolvedSymbol || undefined
          });
        }
      }
    } catch (error) {
      this.logger.error('C语言控制流关系提取失败:', error);
    }

    return relationships;
  }
}