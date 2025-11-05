import {
  DataFlowRelationship,
  Parser,
  BaseCRelationshipExtractor,
  injectable,
  generateDeterministicNodeId
} from '../types';

@injectable()
export class DataFlowExtractor extends BaseCRelationshipExtractor {
  async extractDataFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<DataFlowRelationship[]> {
    const relationships: DataFlowRelationship[] = [];

    try {
      // 使用C语言的数据流查询
      const dataFlowQuery = require('../../parser/constants/queries/c/data-flow').default;
      const queryResults = this.treeSitterService.queryTree(ast, dataFlowQuery);

      for (const result of queryResults) {
        const captures = result.captures;

        // 查找源变量和目标变量
        const sourceVars = captures.filter(capture =>
          capture.name.startsWith('source') && capture.name.includes('variable')
        );
        const targetVars = captures.filter(capture =>
          capture.name.startsWith('target') && capture.name.includes('variable')
        );

        for (const sourceVar of sourceVars) {
          for (const targetVar of targetVars) {
            const sourceName = sourceVar.node.text;
            const targetName = targetVar.node.text;

            if (sourceName && targetName) {
              relationships.push({
                sourceId: generateDeterministicNodeId(sourceVar.node),
                targetId: generateDeterministicNodeId(targetVar.node),
                flowType: 'variable_assignment',
                dataType: 'variable',
                flowPath: [sourceName, targetName],
                location: {
                  filePath,
                  lineNumber: sourceVar.node.startPosition.row + 1,
                  columnNumber: sourceVar.node.startPosition.column + 1
                }
              });
            }
          }
        }

        // 处理参数传递数据流
        const sourceParams = captures.filter(capture =>
          capture.name.startsWith('source') && capture.name.includes('parameter')
        );
        const targetFuncs = captures.filter(capture =>
          capture.name.startsWith('target') && capture.name.includes('function')
        );

        for (const sourceParam of sourceParams) {
          for (const targetFunc of targetFuncs) {
            const paramName = sourceParam.node.text;
            const funcName = targetFunc.node.text;

            if (paramName && funcName) {
              relationships.push({
                sourceId: generateDeterministicNodeId(sourceParam.node),
                targetId: generateDeterministicNodeId(targetFunc.node),
                flowType: 'parameter_passing',
                dataType: 'parameter',
                flowPath: [paramName, funcName],
                location: {
                  filePath,
                  lineNumber: sourceParam.node.startPosition.row + 1,
                  columnNumber: sourceParam.node.startPosition.column + 1
                }
              });
            }
          }
        }

        // 处理返回值数据流
        const returnVars = captures.filter(capture =>
          capture.name.startsWith('source') && capture.name.includes('return')
        );
        const containingFunc = this.findContainingFunction(result.captures[0]?.node, filePath);

        if (containingFunc) {
          const funcName = this.extractFunctionNameFromNode(containingFunc);
          if (funcName) {
            for (const returnVar of returnVars) {
              const returnName = returnVar.node.text;

              relationships.push({
                sourceId: generateDeterministicNodeId(returnVar.node),
                targetId: generateDeterministicNodeId(containingFunc),
                flowType: 'return_value',
                dataType: 'return',
                flowPath: [returnName, funcName],
                location: {
                  filePath,
                  lineNumber: returnVar.node.startPosition.row + 1,
                  columnNumber: returnVar.node.startPosition.column + 1
                }
              });
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('C语言数据流关系提取失败:', error);
    }

    return relationships;
  }
}