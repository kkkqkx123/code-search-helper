import {
  InheritanceRelationship,
  SymbolResolver,
  BaseRustRelationshipExtractor,
  TreeSitterService,
  LoggerService,
  inject,
  injectable,
  TYPES,
  Parser,
  LANGUAGE_NODE_MAPPINGS
} from '../types';

@injectable()
export class InheritanceExtractor extends BaseRustRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    super(treeSitterService, logger);
  }

  async extractInheritanceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<InheritanceRelationship[]> {
    const relationships: InheritanceRelationship[] = [];

    // 在 Rust 中，trait 实现提供类似继承的关系
    // 查找 trait 实现表达式
    const traitImpls = this.treeSitterService.findNodeByType(ast, 'impl_item');

    for (const impl of traitImpls) {
      const selfTypeNode = this.treeSitterService.findNodeByType(impl, 'type_identifier');
      const traitTypeNode = this.treeSitterService.findNodeByType(impl, 'trait');

      if (selfTypeNode[0] && traitTypeNode[0]) {
        const selfTypeName = selfTypeNode[0].text;
        const traitName = traitTypeNode[0].text || null;

        if (selfTypeName && traitName) {
          // 解析符号
          const selfSymbol = symbolResolver.resolveSymbol(selfTypeName, filePath, selfTypeNode[0]);
          const traitSymbol = symbolResolver.resolveSymbol(traitName, filePath, traitTypeNode[0]);

          relationships.push({
            parentId: traitSymbol ? this.generateSymbolId(traitSymbol) : this.generateNodeId(traitName, 'type', filePath),
            childId: selfSymbol ? this.generateSymbolId(selfSymbol) : this.generateNodeId(selfTypeName, 'type', filePath),
            inheritanceType: 'implements',
            location: {
              filePath,
              lineNumber: impl.startPosition.row + 1
            },
            resolvedParentSymbol: traitSymbol || undefined,
            resolvedChildSymbol: selfSymbol || undefined
          });
        }
      }
    }

    // 查找 Rust 结构体、枚举、单元结构体和元组结构体 (classDeclaration in Rust)
    const structDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].classDeclaration
    );

    for (const structDecl of structDeclarations) {
      const structName = this.extractStructName(structDecl);
      if (structName) {
        // Rust 中的结构体/枚举没有传统继承，但可能包含字段，可以建模为包含关系
        const fieldDeclarations = this.findStructFields(structDecl);

        for (const field of fieldDeclarations) {
          const fieldName = this.extractFieldName(field);
          if (fieldName) {
            const fieldSymbol = symbolResolver.resolveSymbol(fieldName, filePath, field);

            relationships.push({
              parentId: this.generateNodeId(structName, 'struct', filePath),
              childId: fieldSymbol ? this.generateSymbolId(fieldSymbol) : this.generateNodeId(fieldName, 'field', filePath),
              inheritanceType: 'contains',
              location: {
                filePath,
                lineNumber: field.startPosition.row + 1
              },
              resolvedParentSymbol: undefined,
              resolvedChildSymbol: fieldSymbol || undefined
            });
          }
        }
      }
    }

    return relationships;
  }

  protected findStructFields(structDecl: Parser.SyntaxNode): Parser.SyntaxNode[] {
    // 查找结构体字段
    const fields: Parser.SyntaxNode[] = [];

    for (const child of structDecl.children) {
      if (child.type === 'field_declaration_list') {
        for (const fieldChild of child.children) {
          if (fieldChild.type === 'field_declaration') {
            fields.push(fieldChild);
          }
        }
      }
    }

    return fields;
  }

  protected extractFieldName(field: Parser.SyntaxNode): string | null {
    // 提取字段名
    for (const child of field.children) {
      if (child.type === 'field_identifier') {
        return child.text || null;
      }
    }
    return null;
  }
}
