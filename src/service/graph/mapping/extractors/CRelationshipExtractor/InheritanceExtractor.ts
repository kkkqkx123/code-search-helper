import {
  InheritanceRelationship,
  SymbolResolver,
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
    filePath: string,
    symbolResolver: SymbolResolver
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
          const resolvedParentSymbol = symbolResolver.resolveSymbol(embeddedStructName, filePath, embeddedStruct);
          const childSymbol = symbolResolver.resolveSymbol(structName, filePath, structDecl);

          relationships.push({
            parentId: resolvedParentSymbol ? this.generateSymbolId(resolvedParentSymbol) : this.generateNodeId(embeddedStructName, 'struct', filePath),
            childId: childSymbol ? this.generateSymbolId(childSymbol) : this.generateNodeId(structName, 'struct', filePath),
            inheritanceType: 'embedded_struct',
            location: {
              filePath,
              lineNumber: structDecl.startPosition.row + 1
            },
            resolvedParentSymbol: resolvedParentSymbol || undefined,
            resolvedChildSymbol: childSymbol || undefined
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
        const resolvedSymbol = symbolResolver.resolveSymbol(enumName, filePath, enumDecl);

        // Find references to enum members in the same file
        const enumMembers = this.findEnumMembers(enumDecl);
        for (const member of enumMembers) {
          relationships.push({
            parentId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(enumName, 'enum', filePath),
            childId: this.generateNodeId(member, 'enum_member', filePath),
            inheritanceType: 'enum_member',
            location: {
              filePath,
              lineNumber: enumDecl.startPosition.row + 1
            },
            resolvedParentSymbol: resolvedSymbol || undefined,
            resolvedChildSymbol: undefined
          });
        }
      }
    }

    return relationships;
  }
}