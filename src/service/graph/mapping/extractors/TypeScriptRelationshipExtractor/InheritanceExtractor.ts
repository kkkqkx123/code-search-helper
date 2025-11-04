import {
  InheritanceRelationship,
  SymbolResolver,
  Symbol,
  Parser,
  LANGUAGE_NODE_MAPPINGS,
  BaseJavaScriptRelationshipExtractor,
  injectable
} from '../types';

@injectable()
export class InheritanceExtractor extends BaseJavaScriptRelationshipExtractor {
  async extractInheritanceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<InheritanceRelationship[]> {
    const relationships: InheritanceRelationship[] = [];

    // 查找类声明，包括抽象类
    const classDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].classDeclaration
    );

    for (const classDecl of classDeclarations) {
      const className = this.extractClassName(classDecl);
      const heritageClauses = this.findHeritageClauses(classDecl);

      if (className && heritageClauses) {
        for (const heritageClause of heritageClauses) {
          const parentClassName = this.extractParentClassName(heritageClause);
          const inheritanceType = this.getInheritanceType(heritageClause);

          if (parentClassName) {
            // 使用符号解析器解析父类符号
            const resolvedParentSymbol = symbolResolver.resolveSymbol(parentClassName, filePath, heritageClause);
            const childSymbol = symbolResolver.resolveSymbol(className, filePath, classDecl);

            relationships.push({
              parentId: resolvedParentSymbol ? this.generateSymbolId(resolvedParentSymbol) : this.generateNodeId(parentClassName, 'class', filePath),
              childId: childSymbol ? this.generateSymbolId(childSymbol) : this.generateNodeId(className, 'class', filePath),
              inheritanceType,
              location: {
                filePath,
                lineNumber: classDecl.startPosition.row + 1
              },
              resolvedParentSymbol: resolvedParentSymbol || undefined,
              resolvedChildSymbol: childSymbol || undefined
            });
          }
        }
      }
    }

    // 查找接口声明 (TypeScript specific)
    const interfaceDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].interfaceDeclaration
    );

    for (const interfaceDecl of interfaceDeclarations) {
      const interfaceName = this.extractInterfaceName(interfaceDecl);
      const heritageClauses = this.findHeritageClauses(interfaceDecl);

      if (interfaceName && heritageClauses) {
        for (const heritageClause of heritageClauses) {
          const inheritanceType = 'extends'; // Interface inheritance is always extends
          const parentNames = this.extractParentNames(heritageClause);

          for (const parentName of parentNames) {
            const resolvedParentSymbol = symbolResolver.resolveSymbol(parentName, filePath, heritageClause);
            const childSymbol = symbolResolver.resolveSymbol(interfaceName, filePath, interfaceDecl);

            relationships.push({
              parentId: resolvedParentSymbol ? this.generateSymbolId(resolvedParentSymbol) : this.generateNodeId(parentName, 'interface', filePath),
              childId: childSymbol ? this.generateSymbolId(childSymbol) : this.generateNodeId(interfaceName, 'interface', filePath),
              inheritanceType,
              location: {
                filePath,
                lineNumber: interfaceDecl.startPosition.row + 1
              },
              resolvedParentSymbol: resolvedParentSymbol || undefined,
              resolvedChildSymbol: childSymbol || undefined
            });
          }
        }
      }
    }

    // 查找枚举声明 (TypeScript specific)
    const enumDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].enumDeclaration
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

  // TypeScript特定的辅助方法
  protected extractInterfaceName(interfaceDecl: Parser.SyntaxNode): string | null {
    // 实现提取接口名逻辑
    for (const child of interfaceDecl.children) {
      if (child.type === 'identifier' || child.type === 'type_identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  protected extractParentNames(heritageClause: Parser.SyntaxNode): string[] {
    // 提取所有父类/接口名
    const parentNames: string[] = [];

    for (const child of heritageClause.children) {
      if (child.type === 'identifier' || child.type === 'type_identifier') {
        parentNames.push(child.text || '');
      } else if (child.type === 'member_expression') {
        // 处理命名空间.类名的情况
        const memberText = child.text;
        if (memberText) {
          parentNames.push(memberText);
        }
      }
    }

    return parentNames;
  }

  protected extractEnumName(enumDecl: Parser.SyntaxNode): string | null {
    // 提取枚举名
    for (const child of enumDecl.children) {
      if (child.type === 'identifier' || child.type === 'type_identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  protected findEnumMembers(enumDecl: Parser.SyntaxNode): string[] {
    // 查找枚举成员
    const members: string[] = [];

    for (const child of enumDecl.children) {
      if (child.type === 'enum_body') {
        for (const bodyChild of child.children) {
          if (bodyChild.type === 'enum_assignment' || bodyChild.type === 'pair') {
            for (const pairChild of bodyChild.children) {
              if (pairChild.type === 'property_identifier' || pairChild.type === 'identifier') {
                members.push(pairChild.text || '');
              }
            }
          }
        }
      }
    }

    return members;
  }
}