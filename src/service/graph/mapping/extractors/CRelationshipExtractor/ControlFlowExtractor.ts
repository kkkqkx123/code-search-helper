import {
  ControlFlowRelationship,
  Parser,
  BaseCRelationshipExtractor,
  injectable,
  generateDeterministicNodeId
} from '../types';

@injectable()
export class ControlFlowExtractor extends BaseCRelationshipExtractor {
  async extractControlFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
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
              relationships.push({
                sourceId: generateDeterministicNodeId(conditionVar.node),
                targetId: generateDeterministicNodeId(blockTarget.node),
                flowType: 'conditional',
                condition: conditionName,
                isExceptional: false,
                location: {
                  filePath,
                  lineNumber: conditionVar.node.startPosition.row + 1,
                  columnNumber: conditionVar.node.startPosition.column + 1
                }
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
              relationships.push({
                sourceId: generateDeterministicNodeId(loopCondition.node),
                targetId: generateDeterministicNodeId(loopBlock.node),
                flowType: 'loop',
                condition: conditionName,
                isExceptional: false,
                location: {
                  filePath,
                  lineNumber: loopCondition.node.startPosition.row + 1,
                  columnNumber: loopCondition.node.startPosition.column + 1
                }
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
          relationships.push({
            sourceId: generateDeterministicNodeId(gotoTarget.node),
            targetId: this.generateNodeId(labelName, 'label', filePath),
            flowType: 'exception',
            condition: `goto ${labelName}`,
            isExceptional: true,
            location: {
              filePath,
              lineNumber: gotoTarget.node.startPosition.row + 1,
              columnNumber: gotoTarget.node.startPosition.column + 1
            }
          });
        }

        // 处理函数调用控制流
        const funcCalls = captures.filter(capture =>
          capture.name.startsWith('target') && capture.name.includes('function')
        );

        for (const funcCall of funcCalls) {
          const funcName = funcCall.node.text;
          relationships.push({
            sourceId: generateDeterministicNodeId(funcCall.node),
            targetId: this.generateNodeId(funcName, 'function', filePath),
            flowType: 'callback',
            condition: funcName,
            isExceptional: false,
            location: {
              filePath,
              lineNumber: funcCall.node.startPosition.row + 1,
              columnNumber: funcCall.node.startPosition.column + 1
            }
          });
        }
      }
    } catch (error) {
      this.logger.error('C语言控制流关系提取失败:', error);
    }

    return relationships;
  }
}