import {
  CreationRelationship,
  Parser,
  LANGUAGE_NODE_MAPPINGS,
  BaseCRelationshipExtractor,
  injectable,
  generateDeterministicNodeId
} from '../types';

@injectable()
export class CreationExtractor extends BaseCRelationshipExtractor {
  async extractCreationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<CreationRelationship[]> {
    const relationships: CreationRelationship[] = [];

    // 在C语言中，主要的创建关系是结构体实例化和变量声明
    const variableDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].variableDeclaration
    );

    for (const varDecl of variableDeclarations) {
      // 查找结构体变量声明
      const structInstances = this.findStructInstances(varDecl, filePath);
      for (const instance of structInstances) {
        relationships.push({
          sourceId: generateDeterministicNodeId(varDecl),
          targetId: instance.structId,
          creationType: 'instantiation',
          targetName: instance.structName,
          location: {
            filePath,
            lineNumber: varDecl.startPosition.row + 1,
            columnNumber: varDecl.startPosition.column + 1
          }
        });
      }

      // 查找枚举变量声明
      const enumInstances = this.findEnumInstances(varDecl, filePath);
      for (const instance of enumInstances) {
        relationships.push({
          sourceId: generateDeterministicNodeId(varDecl),
          targetId: instance.enumId,
          creationType: 'instantiation',
          targetName: instance.enumName,
          location: {
            filePath,
            lineNumber: varDecl.startPosition.row + 1,
            columnNumber: varDecl.startPosition.column + 1
          }
        });
      }
    }

    return relationships;
  }
}