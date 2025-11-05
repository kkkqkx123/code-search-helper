import {
  LifecycleRelationship,
  Parser,
  BaseCRelationshipExtractor,
  injectable,
  generateDeterministicNodeId
} from '../types';

@injectable()
export class LifecycleExtractor extends BaseCRelationshipExtractor {
  async extractLifecycleRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<LifecycleRelationship[]> {
    const relationships: LifecycleRelationship[] = [];

    try {
      // 使用C语言的生命周期关系查询
      const lifecycleQuery = require('../../parser/constants/queries/c/lifecycle-relationships').default;
      const queryResults = this.treeSitterService.queryTree(ast, lifecycleQuery);

      for (const result of queryResults) {
        const captures = result.captures;

        // 处理内存分配关系
        const allocationFuncs = captures.filter((capture: any) =>
          capture.name.startsWith('allocation') || capture.name.includes('allocation')
        );
        const allocatedVars = captures.filter((capture: any) =>
          capture.name.startsWith('pointer') || capture.name.includes('variable')
        );

        for (const allocationFunc of allocationFuncs) {
          for (const allocatedVar of allocatedVars) {
            const funcName = allocationFunc.node.text;
            const varName = allocatedVar.node.text;

            if (funcName && varName) {
              relationships.push({
                sourceId: generateDeterministicNodeId(allocationFunc.node),
                targetId: generateDeterministicNodeId(allocatedVar.node),
                lifecycleType: 'instantiates',
                lifecyclePhase: 'creation',
                location: {
                  filePath,
                  lineNumber: allocationFunc.node.startPosition.row + 1,
                  columnNumber: allocationFunc.node.startPosition.column + 1
                }
              });
            }
          }
        }

        // 处理内存释放关系
        const deallocationFuncs = captures.filter((capture: any) =>
          capture.name.startsWith('deallocation') || capture.name.includes('free')
        );
        const deallocatedVars = captures.filter((capture: any) =>
          capture.name.includes('pointer') || capture.name.includes('variable')
        );

        for (const deallocationFunc of deallocationFuncs) {
          for (const deallocatedVar of deallocatedVars) {
            const funcName = deallocationFunc.node.text;
            const varName = deallocatedVar.node.text;

            if (funcName && varName) {
              relationships.push({
                sourceId: generateDeterministicNodeId(deallocationFunc.node),
                targetId: generateDeterministicNodeId(deallocatedVar.node),
                lifecycleType: 'destroys',
                lifecyclePhase: 'teardown',
                location: {
                  filePath,
                  lineNumber: deallocationFunc.node.startPosition.row + 1,
                  columnNumber: deallocationFunc.node.startPosition.column + 1
                }
              });
            }
          }
        }

        // 处理文件操作关系
        const fileOpenFuncs = captures.filter((capture: any) =>
          capture.name.includes('open') && capture.name.includes('function')
        );
        const fileHandles = captures.filter((capture: any) =>
          capture.name.includes('handle')
        );

        for (const fileOpenFunc of fileOpenFuncs) {
          for (const fileHandle of fileHandles) {
            const funcName = fileOpenFunc.node.text;
            const handleName = fileHandle.node.text;

            if (funcName && handleName) {
              relationships.push({
                sourceId: generateDeterministicNodeId(fileOpenFunc.node),
                targetId: generateDeterministicNodeId(fileHandle.node),
                lifecycleType: 'manages',
                lifecyclePhase: 'setup',
                location: {
                  filePath,
                  lineNumber: fileOpenFunc.node.startPosition.row + 1,
                  columnNumber: fileOpenFunc.node.startPosition.column + 1
                }
              });
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('C语言生命周期关系提取失败:', error);
    }

    return relationships;
  }
}