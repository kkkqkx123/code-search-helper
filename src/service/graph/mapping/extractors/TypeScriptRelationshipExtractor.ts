import {
  InheritanceRelationship,
  DependencyRelationship,
  ReferenceRelationship,
  CreationRelationship,
  AnnotationRelationship
} from '../interfaces/IRelationshipExtractor';
import { JavaScriptRelationshipExtractor } from './JavaScriptRelationshipExtractor';
import { SymbolResolver, Symbol } from '../../symbol/SymbolResolver';
import { injectable } from 'inversify';
import Parser = require('tree-sitter');

@injectable()
export class TypeScriptRelationshipExtractor extends JavaScriptRelationshipExtractor {
  getSupportedLanguage(): string {
    return 'typescript';
  }

  async extractInheritanceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<InheritanceRelationship[]> {
    const relationships = await super.extractInheritanceRelationships(ast, filePath, symbolResolver);

    // 查找接口声明 (TypeScript specific)
    const interfaceDeclarations = this.treeSitterService.findNodeByType(ast, 'interface_declaration');
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

    return relationships;
  }

  async extractDependencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DependencyRelationship[]> {
    const relationships = await super.extractDependencyRelationships(ast, filePath, symbolResolver);

    // 查找导出语句 (TypeScript specific)
    const exportStatements = this.treeSitterService.findNodesByTypes(ast, ['export_statement', 'export_declaration']);
    for (const exportStmt of exportStatements) {
      const exportInfo = this.extractExportInfo(exportStmt);

      if (exportInfo) {
        const resolvedTargetSymbol = symbolResolver.resolveSymbol(exportInfo.target, filePath, exportStmt);

        relationships.push({
          sourceId: this.generateNodeId(filePath, 'file', filePath),
          targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(exportInfo.target, 'symbol', filePath),
          dependencyType: 'export',
          target: exportInfo.target,
          importedSymbols: exportInfo.exportedSymbols,
          location: {
            filePath,
            lineNumber: exportStmt.startPosition.row + 1
          },
          resolvedTargetSymbol: resolvedTargetSymbol || undefined
        });
      }
    }

    // 查找类型导入 (TypeScript specific)
    const typeImports = this.treeSitterService.findNodeByType(ast, 'import_type');
    for (const typeImport of typeImports) {
      const sourceNode = this.treeSitterService.findNodeByType(typeImport, 'literal')[0];
      if (sourceNode) {
        const source = this.treeSitterService.getNodeText(sourceNode, '').replace(/['"]/g, '');

        relationships.push({
          sourceId: this.generateNodeId(filePath, 'file', filePath),
          targetId: this.generateNodeId(source, 'module', source),
          dependencyType: 'type_dependency',
          target: source,
          importedSymbols: [],
          location: {
            filePath,
            lineNumber: typeImport.startPosition.row + 1
          }
        });
      }
    }

    return relationships;
  }

  async extractReferenceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    fileContent: string,
    symbolResolver: SymbolResolver
  ): Promise<ReferenceRelationship[]> {
    const relationships = await super.extractReferenceRelationships(ast, filePath, fileContent, symbolResolver);

    // 查找类型引用 (TypeScript specific)
    const typeReferences = this.treeSitterService.findNodesByTypes(ast, ['type_identifier', 'predefined_type']);

    for (const typeRef of typeReferences) {
      const typeName = this.treeSitterService.getNodeText(typeRef, fileContent);

      // 使用符号解析器解析类型符号
      const resolvedSymbol = symbolResolver.resolveSymbol(typeName, filePath, typeRef);

      if (resolvedSymbol) {
        relationships.push({
          sourceId: this.generateNodeId(typeName, 'typeref', filePath),
          targetId: this.generateSymbolId(resolvedSymbol),
          referenceType: 'variable',
          referenceName: typeName,
          location: {
            filePath,
            lineNumber: typeRef.startPosition.row + 1,
            columnNumber: typeRef.startPosition.column + 1
          },
          resolvedSymbol
        });
      }
    }

    // 查找类型注解
    const typeAnnotations = this.treeSitterService.findNodeByType(ast, 'type_annotation');
    for (const typeAnnotation of typeAnnotations) {
      const typeIdentifier = this.treeSitterService.findNodeByType(typeAnnotation, 'type_identifier')[0];
      if (typeIdentifier) {
        const typeName = this.treeSitterService.getNodeText(typeIdentifier, fileContent);
        const resolvedSymbol = symbolResolver.resolveSymbol(typeName, filePath, typeIdentifier);

        if (resolvedSymbol) {
          relationships.push({
            sourceId: this.generateNodeId(typeName, 'annotation', filePath),
            targetId: this.generateSymbolId(resolvedSymbol),
            referenceType: 'variable',
            referenceName: typeName,
            location: {
              filePath,
              lineNumber: typeIdentifier.startPosition.row + 1,
              columnNumber: typeIdentifier.startPosition.column + 1
            },
            resolvedSymbol
          });
        }
      }
    }

    return relationships;
  }

  async extractCreationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    fileContent: string,
    symbolResolver: SymbolResolver
  ): Promise<CreationRelationship[]> {
    const relationships = await super.extractCreationRelationships(ast, filePath, fileContent, symbolResolver);

    // 查找对象字面量创建（对象创建）
    const objectLiterals = this.treeSitterService.findNodeByType(ast, 'object');
    for (const objectLiteral of objectLiterals) {
      // Extract properties that indicate creation type
      const objectType = this.inferObjectType(objectLiteral, fileContent);
      if (objectType) {
        const resolvedSymbol = symbolResolver.resolveSymbol(objectType, filePath, objectLiteral);

        relationships.push({
          sourceId: this.generateNodeId(`object_creation_${objectLiteral.startPosition.row}`, 'creation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(objectType, 'object', filePath),
          creationType: 'instantiation',
          targetName: objectType,
          location: {
            filePath,
            lineNumber: objectLiteral.startPosition.row + 1,
            columnNumber: objectLiteral.startPosition.column + 1
          },
          resolvedTargetSymbol: resolvedSymbol || undefined
        });
      }
    }

    // 查找数组字面量创建
    const arrayLiterals = this.treeSitterService.findNodeByType(ast, 'array');
    for (const arrayLiteral of arrayLiterals) {
      relationships.push({
        sourceId: this.generateNodeId(`array_creation_${arrayLiteral.startPosition.row}`, 'creation', filePath),
        targetId: this.generateNodeId('Array', 'builtin', filePath),
        creationType: 'instantiation',
        targetName: 'Array',
        location: {
          filePath,
          lineNumber: arrayLiteral.startPosition.row + 1,
          columnNumber: arrayLiteral.startPosition.column + 1
        },
        resolvedTargetSymbol: undefined
      });
    }

    return relationships;
  }

  async extractAnnotationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<AnnotationRelationship[]> {
    const relationships = await super.extractAnnotationRelationships(ast, filePath, symbolResolver);

    // 查找类型注解中的泛型参数 (TypeScript specific)
    const genericTypes = this.treeSitterService.findNodeByType(ast, 'generic_type');
    for (const genericType of genericTypes) {
      const typeName = this.extractGenericTypeName(genericType);
      const typeArguments = this.extractTypeArguments(genericType);

      if (typeName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(typeName, filePath, genericType);

        relationships.push({
          sourceId: this.generateNodeId(`generic_${genericType.startPosition.row}`, 'annotation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(typeName, 'type', filePath),
          annotationType: 'annotation',
          annotationName: typeName,
          parameters: { typeArguments },
          location: {
            filePath,
            lineNumber: genericType.startPosition.row + 1,
            columnNumber: genericType.startPosition.column + 1
          },
          resolvedAnnotationSymbol: resolvedSymbol || undefined
        });

        // Also add relationships for type arguments
        for (const typeArg of typeArguments) {
          const argResolvedSymbol = symbolResolver.resolveSymbol(typeArg, filePath, genericType);
          if (argResolvedSymbol) {
            relationships.push({
              sourceId: this.generateNodeId(`generic_arg_${genericType.startPosition.row}`, 'annotation', filePath),
              targetId: this.generateSymbolId(argResolvedSymbol),
              annotationType: 'annotation',
              annotationName: typeArg,
              parameters: { genericType: typeName },
              location: {
                filePath,
                lineNumber: genericType.startPosition.row + 1,
                columnNumber: genericType.startPosition.column + 1
              },
              resolvedAnnotationSymbol: argResolvedSymbol
            });
          }
        }
      }
    }

    return relationships;
  }

  // TypeScript-specific helper methods
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

  protected extractExportInfo(exportStmt: Parser.SyntaxNode): {
    target: string;
    exportedSymbols: string[];
  } | null {
    // 实现提取导出信息逻辑
    let target = '';
    const exportedSymbols: string[] = [];

    for (const child of exportStmt.children) {
      // Find the source (usually a string literal in export from statements)
      if (child.type === 'string' || child.type === 'template_string') {
        target = child.text.replace(/['"`]/g, ''); // Remove quotes
      }
      // Find the export specifiers
      else if (child.type === 'export_clause' || child.type === 'export_specifier') {
        exportedSymbols.push(...this.extractExportSpecifiers(child));
      }
    }

    if (target || exportedSymbols.length > 0) {
      return {
        target: target || 'local',
        exportedSymbols
      };
    }
    return null;
  }

  protected extractExportSpecifiers(node: Parser.SyntaxNode): string[] {
    // 提取导出符号
    const specifiers: string[] = [];

    if (node.type === 'export_specifier') {
      for (const child of node.children) {
        if (child.type === 'identifier' || child.type === 'property_identifier') {
          specifiers.push(child.text || '');
          break;
        }
      }
    } else if (node.type === 'export_clause') {
      for (const child of node.children) {
        if (child.type === 'export_specifier') {
          specifiers.push(...this.extractExportSpecifiers(child));
        }
      }
    }

    return specifiers;
  }

  protected determineReferenceType(identifier: Parser.SyntaxNode, resolvedSymbol: Symbol): 'variable' | 'constant' | 'parameter' | 'field' | 'type' | 'interface' | 'enum' {
    // 实现确定引用类型逻辑 with TypeScript-specific types
    if (resolvedSymbol.type === 'interface') {
      return 'interface';
    } else if (resolvedSymbol.type === 'type') {
      return 'type';
    } else if (resolvedSymbol.type === 'enum') {
      return 'enum';
    }

    // Check parent context to determine reference type
    if (identifier.parent?.type === 'parameter') {
      return 'parameter';
    } else if (identifier.parent?.type === 'property_identifier' &&
      identifier.parent.parent?.type === 'member_expression') {
      return 'field';
    }

    return 'variable';
  }

  protected inferObjectType(objectLiteral: Parser.SyntaxNode, fileContent: string): string | null {
    // 从对象字面量推断类型
    // This is a simplified implementation - in a real system you might look at properties
    // or assign a generic "Object" type
    return 'Object';
  }

  protected extractGenericTypeName(genericType: Parser.SyntaxNode): string | null {
    // 提取泛型类型名
    if (genericType.children && genericType.children.length > 0) {
      const typeNode = genericType.children[0];
      if (typeNode.type === 'type_identifier' || typeNode.type === 'identifier') {
        return typeNode.text || null;
      }
    }
    return null;
  }

  protected extractTypeArguments(genericType: Parser.SyntaxNode): string[] {
    // 提取泛型参数
    const args: string[] = [];

    for (const child of genericType.children) {
      if (child.type === 'type_arguments') {
        for (const arg of child.children) {
          if (arg.type === 'type_identifier' || arg.type === 'identifier') {
            args.push(this.treeSitterService.getNodeText(arg, ''));
          }
        }
        break;
      }
    }

    return args;
  }
}