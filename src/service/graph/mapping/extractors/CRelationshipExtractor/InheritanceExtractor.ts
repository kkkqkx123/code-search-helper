import {
  InheritanceRelationship,
  Parser,
  LANGUAGE_NODE_MAPPINGS,
  BaseCRelationshipExtractor,
  injectable,
  generateDeterministicNodeId
} from '../types';

@injectable()
export class InheritanceExtractor extends BaseCRelationshipExtractor {
  async extractInheritanceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string
  ): Promise<InheritanceRelationship[]> {
    const relationships: InheritanceRelationship[] = [];

    // C语言中没有传统的继承，但结构体可能通过嵌入其他结构体来模拟继承
    // 查找结构体声明
    const structDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].structDeclaration
    );

    for (const structDecl of structDeclarations) {
      const structName = this.extractStructName(structDecl);

      if (structName) {
        // 查找结构体中嵌入的其他结构体（继承模拟）
        const embeddedStructs = this.findEmbeddedStructs(structDecl);

        for (const embeddedStruct of embeddedStructs) {
          const embeddedStructName = embeddedStruct.text;

          relationships.push({
            parentId: this.generateNodeId(embeddedStructName, 'struct', filePath),
            childId: this.generateNodeId(structName, 'struct', filePath),
            inheritanceType: 'embedded_struct',
            location: {
              filePath,
              lineNumber: structDecl.startPosition.row + 1
            }
          });
        }
      }
    }

    // 查找枚举声明 (C specific)
    const enumDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].enumDeclaration
    );

    for (const enumDecl of enumDeclarations) {
      const enumName = this.extractEnumName(enumDecl);
      if (enumName) {
        // Find references to enum members in the same file
        const enumMembers = this.findEnumMembers(enumDecl);
        for (const member of enumMembers) {
          relationships.push({
            parentId: this.generateNodeId(enumName, 'enum', filePath),
            childId: this.generateNodeId(member, 'enum_member', filePath),
            inheritanceType: 'enum_member',
            location: {
              filePath,
              lineNumber: enumDecl.startPosition.row + 1
            }
          });
        }
      }
    }

    return relationships;
  }
}