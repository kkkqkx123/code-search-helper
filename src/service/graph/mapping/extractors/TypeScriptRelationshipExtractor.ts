import {
  InheritanceRelationship,
  DependencyRelationship,
  ReferenceRelationship,
  CreationRelationship,
  AnnotationRelationship,
  CallRelationship
} from '../interfaces/IRelationshipExtractor';
import { JavaScriptRelationshipExtractor } from './JavaScriptRelationshipExtractor';
import { SymbolResolver, Symbol } from '../../symbol/SymbolResolver';
import { injectable } from 'inversify';
import Parser = require('tree-sitter');
import { LANGUAGE_NODE_MAPPINGS } from '../LanguageNodeTypes';

@injectable()
export class TypeScriptRelationshipExtractor extends JavaScriptRelationshipExtractor {
  getSupportedLanguage(): string {
    return 'typescript';
  }

  async extractCallRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<CallRelationship[]> {
    const relationships = await super.extractCallRelationships(ast, filePath, symbolResolver);

    // 查找所有调用表达式及新表达式
    const callExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].callExpression
    );

    for (const callExpr of callExpressions) {
      // 使用符号解析器查找调用者函数
      const callerSymbol = this.findCallerSymbol(callExpr, symbolResolver, filePath);
      const calleeName = this.extractCalleeName(callExpr);

      if (callerSymbol && calleeName) {
        // 使用符号解析器解析被调用函数
        const resolvedSymbol = symbolResolver.resolveSymbol(calleeName, filePath, callExpr);

        // 分析调用上下文
        const callContext = this.analyzeCallContext(callExpr);

        relationships.push({
          callerId: this.generateSymbolId(callerSymbol),
          calleeId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(calleeName, 'function', filePath),
          callName: calleeName,
          location: {
            filePath,
            lineNumber: callExpr.startPosition.row + 1,
            columnNumber: callExpr.startPosition.column + 1
          },
          callType: this.determineCallType(callExpr, resolvedSymbol),
          callContext,
          resolvedSymbol: resolvedSymbol || undefined
        });
      }
    }

    return relationships;
  }

  async extractInheritanceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<InheritanceRelationship[]> {
    const relationships = await super.extractInheritanceRelationships(ast, filePath, symbolResolver);

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

  async extractDependencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DependencyRelationship[]> {
    const relationships = await super.extractDependencyRelationships(ast, filePath, symbolResolver);

    // 查找导入和导出语句
    const importDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].importDeclaration
    );

    for (const importStmt of importDeclarations) {
      const importInfo = this.extractImportInfo(importStmt);

      if (importInfo) {
        // 使用符号解析器解析导入的模块
        const resolvedTargetSymbol = symbolResolver.resolveSymbol(importInfo.source, filePath, importStmt);

        relationships.push({
          sourceId: this.generateNodeId(filePath, 'file', filePath),
          targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(importInfo.source, 'module', importInfo.source),
          dependencyType: 'import',
          target: importInfo.source,
          importedSymbols: importInfo.importedSymbols,
          location: {
            filePath,
            lineNumber: importStmt.startPosition.row + 1
          },
          resolvedTargetSymbol: resolvedTargetSymbol || undefined
        });
      }
    }

    // 查找导出语句 (TypeScript specific)
    const exportDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].exportDeclaration
    );

    for (const exportStmt of exportDeclarations) {
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
        const source = sourceNode.text.replace(/['"]/g, '');

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
    symbolResolver: SymbolResolver
  ): Promise<ReferenceRelationship[]> {
    const relationships = await super.extractReferenceRelationships(ast, filePath, symbolResolver);

    // 查找所有属性标识符和命名导入
    const propertyIdentifiers = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].propertyIdentifier
    );

    for (const identifier of propertyIdentifiers) {
      const identifierName = identifier.text;

      // 使用符号解析器解析引用的符号
      const resolvedSymbol = symbolResolver.resolveSymbol(identifierName, filePath, identifier);

      if (resolvedSymbol) {
        // 确定引用类型
        const referenceType = this.determineReferenceType(identifier, resolvedSymbol) as 'variable' | 'constant' | 'parameter' | 'field' | 'interface' | 'type' | 'enum';

        relationships.push({
          sourceId: this.generateNodeId(identifierName, 'reference', filePath),
          targetId: this.generateSymbolId(resolvedSymbol),
          referenceType,
          referenceName: identifierName,
          location: {
            filePath,
            lineNumber: identifier.startPosition.row + 1,
            columnNumber: identifier.startPosition.column + 1
          },
          resolvedSymbol
        });
      }
    }

    // 查找函数声明和方法声明的引用
    const functionDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].functionDeclaration
    );

    for (const funcDecl of functionDeclarations) {
      const funcName = this.extractFunctionName(funcDecl);
      if (funcName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(funcName, filePath, funcDecl);

        if (resolvedSymbol) {
          relationships.push({
            sourceId: this.generateNodeId(funcName, 'function_ref', filePath),
            targetId: this.generateSymbolId(resolvedSymbol),
            referenceType: 'function',
            referenceName: funcName,
            location: {
              filePath,
              lineNumber: funcDecl.startPosition.row + 1,
              columnNumber: funcDecl.startPosition.column + 1
            },
            resolvedSymbol
          });
        }
      }
    }

    // 查找方法声明的引用
    const methodDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].methodDeclaration
    );

    for (const methodDecl of methodDeclarations) {
      const methodName = this.extractMethodName(methodDecl);
      if (methodName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(methodName, filePath, methodDecl);

        if (resolvedSymbol) {
          relationships.push({
            sourceId: this.generateNodeId(methodName, 'method_ref', filePath),
            targetId: this.generateSymbolId(resolvedSymbol),
            referenceType: 'method',
            referenceName: methodName,
            location: {
              filePath,
              lineNumber: methodDecl.startPosition.row + 1,
              columnNumber: methodDecl.startPosition.column + 1
            },
            resolvedSymbol
          });
        }
      }
    }

    // 查找类型引用 (TypeScript specific)
    const typeReferences = this.treeSitterService.findNodesByTypes(ast, ['type_identifier', 'predefined_type']);

    for (const typeRef of typeReferences) {
      const typeName = typeRef.text;

      // 使用符号解析器解析类型符号
      const resolvedSymbol = symbolResolver.resolveSymbol(typeName, filePath, typeRef);

      if (resolvedSymbol) {
        relationships.push({
          sourceId: this.generateNodeId(typeName, 'typeref', filePath),
          targetId: this.generateSymbolId(resolvedSymbol),
          referenceType: 'type',
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
        const typeName = typeIdentifier.text;
        const resolvedSymbol = symbolResolver.resolveSymbol(typeName, filePath, typeIdentifier);

        if (resolvedSymbol) {
          relationships.push({
            sourceId: this.generateNodeId(typeName, 'annotation', filePath),
            targetId: this.generateSymbolId(resolvedSymbol),
            referenceType: 'type',
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
    symbolResolver: SymbolResolver
  ): Promise<CreationRelationship[]> {
    const relationships = await super.extractCreationRelationships(ast, filePath, symbolResolver);

    // 查找new表达式
    const newExpressions = this.treeSitterService.findNodeByType(ast, 'new_expression');

    for (const newExpr of newExpressions) {
      const className = this.extractClassNameFromNewExpression(newExpr);

      if (className) {
        // 使用符号解析器解析类符号
        const resolvedSymbol = symbolResolver.resolveSymbol(className, filePath, newExpr);

        relationships.push({
          sourceId: this.generateNodeId(`creation_${newExpr.startPosition.row}`, 'creation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(className, 'class', filePath),
          creationType: 'instantiation',
          targetName: className,
          location: {
            filePath,
            lineNumber: newExpr.startPosition.row + 1,
            columnNumber: newExpr.startPosition.column + 1
          },
          resolvedTargetSymbol: resolvedSymbol || undefined
        });
      }
    }

    // 查找箭头函数、Lambda表达式
    const lambdaExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].lambdaExpression
    );

    for (const lambdaExpr of lambdaExpressions) {
      relationships.push({
        sourceId: this.generateNodeId(`lambda_creation_${lambdaExpr.startPosition.row}`, 'creation', filePath),
        targetId: this.generateNodeId('Function', 'builtin', filePath),
        creationType: 'instantiation',
        targetName: 'Function',
        location: {
          filePath,
          lineNumber: lambdaExpr.startPosition.row + 1,
          columnNumber: lambdaExpr.startPosition.column + 1
        },
        resolvedTargetSymbol: undefined
      });
    }

    // 查找对象字面量创建（对象创建）
    const objectLiterals = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].variableDeclaration
        .filter(type => type === 'object' || type === 'pair') // Only include object-related types
    );

    if (objectLiterals.length === 0) {
      // If no specific object literals found, look for generic object patterns
      const genericObjectLiterals = this.treeSitterService.findNodeByType(ast, 'object');
      for (const objectLiteral of genericObjectLiterals) {
        // Extract properties that indicate creation type
        const objectType = this.inferObjectType(objectLiteral);
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

    // 查找装饰器
    const decorators = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].decorator
    );

    for (const decorator of decorators) {
      const annotationName = this.extractAnnotationName(decorator);
      const parameters = this.extractAnnotationParameters(decorator);

      if (annotationName) {
        // 使用符号解析器解析注解符号
        const resolvedSymbol = symbolResolver.resolveSymbol(annotationName, filePath, decorator);

        relationships.push({
          sourceId: this.generateNodeId(`annotation_${decorator.startPosition.row}`, 'annotation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(annotationName, 'decorator', filePath),
          annotationType: 'decorator',
          annotationName,
          parameters,
          location: {
            filePath,
            lineNumber: decorator.startPosition.row + 1,
            columnNumber: decorator.startPosition.column + 1
          },
          resolvedAnnotationSymbol: resolvedSymbol || undefined
        });
      }
    }

    // 查找类型注解、类型别名和命名空间声明
    const typeAnnotations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].typeAnnotation
    );

    for (const typeAnnotation of typeAnnotations) {
      const annotationName = this.extractTypeName(typeAnnotation);
      if (annotationName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(annotationName, filePath, typeAnnotation);

        relationships.push({
          sourceId: this.generateNodeId(`type_annotation_${typeAnnotation.startPosition.row}`, 'annotation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(annotationName, 'type', filePath),
          annotationType: 'type_annotation',
          annotationName,
          parameters: {},
          location: {
            filePath,
            lineNumber: typeAnnotation.startPosition.row + 1,
            columnNumber: typeAnnotation.startPosition.column + 1
          },
          resolvedAnnotationSymbol: resolvedSymbol || undefined
        });
      }
    }

    // 查找类型注解中的泛型参数 (TypeScript specific)
    const genericTypes = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['typescript'].genericTypes
    );

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

  // Enhanced helper methods
  protected extractTypeName(typeNode: Parser.SyntaxNode): string | null {
    // 从类型注解节点提取类型名
    if (typeNode.children && typeNode.children.length > 0) {
      for (const child of typeNode.children) {
        if (child.type === 'type_identifier' || child.type === 'identifier') {
          return child.text || null;
        }
      }
    }
    return null;
  }

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

  protected inferObjectType(objectLiteral: Parser.SyntaxNode): string | null {
    // 从对象字面量推断类型
    // This is a simplified implementation - in a real system you might look at properties
    // or assign a generic "Object" type
    return 'Object';
  }

  protected extractFunctionName(funcDecl: Parser.SyntaxNode): string | null {
    // 提取函数名
    for (const child of funcDecl.children) {
      if (child.type === 'identifier' || child.type === 'property_identifier') {
        return child.text || null;
      } else if (child.type === 'function_name') {
        return child.text || null;
      }
    }
    return null;
  }

  protected extractMethodName(methodDecl: Parser.SyntaxNode): string | null {
    // 提取方法名
    for (const child of methodDecl.children) {
      if (child.type === 'property_identifier' || child.type === 'identifier') {
        return child.text || null;
      }
    }
    return null;
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
      if (child.type === 'type_arguments' || child.type === 'type_parameters') {
        for (const arg of child.children) {
          if (arg.type === 'type_identifier' || arg.type === 'identifier' || arg.type === 'generic_type') {
            args.push(arg.text);
          }
        }
        break;
      }
    }

    return args;
  }
}