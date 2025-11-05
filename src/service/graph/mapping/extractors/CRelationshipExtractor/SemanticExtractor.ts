import {
  SemanticRelationship,
  Parser,
  BaseCRelationshipExtractor,
  injectable,
  generateDeterministicNodeId
} from '../types';

@injectable()
export class SemanticExtractor extends BaseCRelationshipExtractor {
  async extractSemanticRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<SemanticRelationship[]> {
    const relationships: SemanticRelationship[] = [];

    try {
      // 使用C语言的语义关系查询
      const semanticQuery = require('../../parser/constants/queries/c/semantic-relationships').default;
      const queryResults = this.treeSitterService.queryTree(ast, semanticQuery);

      for (const result of queryResults) {
        const captures = result.captures;

        // 处理函数调用关系
        const sourceFuncs = captures.filter((capture: any) =>
          capture.name.startsWith('source') && capture.name.includes('function')
        );
        const targetFuncs = captures.filter((capture: any) =>
          capture.name.startsWith('target') && capture.name.includes('function')
        );

        for (const sourceFunc of sourceFuncs) {
          for (const targetFunc of targetFuncs) {
            const sourceName = sourceFunc.node.text;
            const targetName = targetFunc.node.text;

            if (sourceName && targetName) {
              relationships.push({
                sourceId: generateDeterministicNodeId(sourceFunc.node),
                targetId: generateDeterministicNodeId(targetFunc.node),
                semanticType: 'delegates',
                pattern: 'function_call',
                metadata: {
                  relationshipType: 'function_call'
                },
                location: {
                  filePath,
                  lineNumber: sourceFunc.node.startPosition.row + 1,
                  columnNumber: sourceFunc.node.startPosition.column + 1
                }
              });
            }
          }
        }

        // 处理结构体定义关系
        const structNames = captures.filter((capture: any) =>
          capture.name.startsWith('target') && capture.name.includes('struct')
        );
        const fieldTypes = captures.filter((capture: any) =>
          capture.name.startsWith('source') && capture.name.includes('field')
        );

        for (const structName of structNames) {
          for (const fieldType of fieldTypes) {
            const structTypeName = structName.node.text;
            const fieldTypeName = fieldType.node.text;

            if (structTypeName && fieldTypeName) {
              relationships.push({
                sourceId: generateDeterministicNodeId(fieldType.node),
                targetId: generateDeterministicNodeId(structName.node),
                semanticType: 'configures',
                pattern: 'struct_field',
                metadata: {
                  relationshipType: 'struct_field'
                },
                location: {
                  filePath,
                  lineNumber: fieldType.node.startPosition.row + 1,
                  columnNumber: fieldType.node.startPosition.column + 1
                }
              });
            }
          }
        }

        // 处理类型别名关系
        const originalTypes = captures.filter((capture: any) =>
          capture.name.startsWith('source') && capture.name.includes('original')
        );
        const aliasTypes = captures.filter((capture: any) =>
          capture.name.startsWith('target') && capture.name.includes('alias')
        );

        for (const originalType of originalTypes) {
          for (const aliasType of aliasTypes) {
            const originalTypeName = originalType.node.text;
            const aliasTypeName = aliasType.node.text;

            if (originalTypeName && aliasTypeName) {
              relationships.push({
                sourceId: generateDeterministicNodeId(originalType.node),
                targetId: generateDeterministicNodeId(aliasType.node),
                semanticType: 'overrides',
                pattern: 'type_alias',
                metadata: {
                  relationshipType: 'type_alias'
                },
                location: {
                  filePath,
                  lineNumber: originalType.node.startPosition.row + 1,
                  columnNumber: originalType.node.startPosition.column + 1
                }
              });
            }
          }
        }
      }
    } catch (error) {
      this.logger.error('C语言语义关系提取失败:', error);
    }

    return relationships;
  }
}