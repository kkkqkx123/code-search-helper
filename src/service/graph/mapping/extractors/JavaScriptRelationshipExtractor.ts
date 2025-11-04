import {
  ILanguageRelationshipExtractor,
  CallRelationship,
  InheritanceRelationship,
  DependencyRelationship,
  ReferenceRelationship,
  CreationRelationship,
  AnnotationRelationship
} from '../interfaces/IRelationshipExtractor';
import { SymbolResolver, Symbol } from '../../symbol/SymbolResolver';
import { TreeSitterService } from '../../../parser/core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../../../types';
import Parser = require('tree-sitter');
import { LANGUAGE_NODE_MAPPINGS } from '../LanguageNodeTypes';

@injectable()
export class JavaScriptRelationshipExtractor implements ILanguageRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) protected treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) protected logger: LoggerService
  ) { }

  getSupportedLanguage(): string {
    return 'javascript';
  }

  getSupportedRelationshipTypes(): string[] {
    return [
      'call', 'inheritance', 'dependency',
      'reference', 'creation', 'annotation'
    ];
  }

  async extractCallRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<CallRelationship[]> {
    const relationships: CallRelationship[] = [];

    // 查找所有调用表达式和新表达式
    const callExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].callExpression
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
    const relationships: InheritanceRelationship[] = [];

    // 查找类声明
    const classDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].classDeclaration
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

    return relationships;
  }

  async extractDependencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DependencyRelationship[]> {
    const relationships: DependencyRelationship[] = [];

    // 查找导入语句
    const importStatements = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].importDeclaration
    );

    for (const importStmt of importStatements) {
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

    // 查找导出语句 (JavaScript also has export statements)
    const exportStatements = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].exportDeclaration
    );

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

    return relationships;
  }

  async extractReferenceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ReferenceRelationship[]> {
    const relationships: ReferenceRelationship[] = [];

    // 查找所有标识符引用和属性标识符
    const identifiers = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].propertyIdentifier
    );

    for (const identifier of identifiers) {
      const identifierName = identifier.text;

      // 使用符号解析器解析引用的符号
      const resolvedSymbol = symbolResolver.resolveSymbol(identifierName, filePath, identifier);

      if (resolvedSymbol) {
        // 确定引用类型
        const referenceType = this.determineReferenceType(identifier, resolvedSymbol) as 'variable' | 'constant' | 'parameter' | 'field';

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

    // 查找成员表达式引用
    const memberExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].memberExpression
    );

    for (const memberExpr of memberExpressions) {
      const memberName = this.extractMemberExpressionName(memberExpr);

      if (memberName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(memberName, filePath, memberExpr);

        if (resolvedSymbol) {
          // 确定引用类型
          const referenceType = this.determineReferenceType(memberExpr, resolvedSymbol) as 'variable' | 'constant' | 'parameter' | 'field';

          relationships.push({
            sourceId: this.generateNodeId(memberName, 'reference', filePath),
            targetId: this.generateSymbolId(resolvedSymbol),
            referenceType,
            referenceName: memberName,
            location: {
              filePath,
              lineNumber: memberExpr.startPosition.row + 1,
              columnNumber: memberExpr.startPosition.column + 1
            },
            resolvedSymbol
          });
        }
      }
    }

    // 查找函数声明和方法声明的引用
    const functionDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].functionDeclaration
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
      LANGUAGE_NODE_MAPPINGS['javascript'].methodDeclaration
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

    // 查找类型注解
    const typeAnnotations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].typeAnnotation
    );

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
    const relationships: CreationRelationship[] = [];

    // 查找new表达式
    const newExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].callExpression.filter(type => type === 'new_expression')
    );

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
      LANGUAGE_NODE_MAPPINGS['javascript'].lambdaExpression
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

    // 查找变量声明、对象和数组字面量
    const variableDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].variableDeclaration
    );

    for (const varDecl of variableDeclarations) {
      // 查找对象字面量
      const objectLiterals = this.treeSitterService.findNodeByType(varDecl, 'object');
      for (const objectLiteral of objectLiterals) {
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

      // 查找数组字面量
      const arrayLiterals = this.treeSitterService.findNodeByType(varDecl, 'array');
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
    }

    return relationships;
  }

  async extractAnnotationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<AnnotationRelationship[]> {
    const relationships: AnnotationRelationship[] = [];

    // 查找装饰器
    const decorators = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].decorator
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

    // 查找类型注解
    const typeAnnotations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].typeAnnotation
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

    // 查找泛型类型
    const genericTypes = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['javascript'].genericTypes
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

  // 辅助方法实现
  protected findCallerSymbol(callExpr: Parser.SyntaxNode, symbolResolver: SymbolResolver, filePath: string): Symbol | null {
    // 实现查找调用者符号的逻辑
    // 需要向上遍历AST找到包含当前调用的函数
    let currentNode: Parser.SyntaxNode | null = callExpr.parent;
    while (currentNode) {
      if (currentNode.type === 'function_declaration' ||
        currentNode.type === 'method_definition' ||
        currentNode.type === 'arrow_function' ||
        currentNode.type === 'function') {
        // 查找函数名
        for (const child of currentNode.children) {
          if (child.type === 'identifier' || child.type === 'property_identifier') {
            const funcName = child.text;
            if (funcName) {
              return symbolResolver.resolveSymbol(funcName, filePath, child);
            }
          }
        }
      }
      currentNode = currentNode.parent;
    }
    return null; // 如果没找到父函数
  }

  protected extractCalleeName(callExpr: Parser.SyntaxNode): string | null {
    // 实现提取被调用函数名逻辑
    if (callExpr.children && callExpr.children.length > 0) {
      const funcNode = callExpr.children[0];
      if (funcNode.type === 'identifier') {
        return funcNode.text;
      } else if (funcNode.type === 'member_expression') {
        // 处理 obj.method() 的情况
        return this.extractMethodNameFromMemberExpression(funcNode);
      } else if (funcNode.type === 'call_expression') {
        // 处理嵌套调用
        return this.extractCalleeName(funcNode);
      }
    }
    return null;
  }

  protected extractMethodNameFromMemberExpression(memberExpr: Parser.SyntaxNode): string | null {
    // 从成员表达式中提取方法名
    if (memberExpr.children && memberExpr.children.length > 0) {
      const lastChild = memberExpr.children[memberExpr.children.length - 1];
      if (lastChild.type === 'property_identifier' || lastChild.type === 'identifier') {
        return lastChild.text;
      }
    }
    return null;
  }

  protected analyzeCallContext(callExpr: Parser.SyntaxNode): {
    isChained: boolean;
    chainDepth?: number;
    isAsync: boolean;
  } {
    // 实现分析调用上下文的逻辑
    const isChained = callExpr.parent?.type === 'call_expression' || callExpr.parent?.type === 'member_expression';
    const isAsync = callExpr.text.includes('await');
    const hasGenerics = callExpr.text.includes('<') && callExpr.text.includes('>');

    return {
      isChained,
      isAsync,
      chainDepth: isChained ? this.calculateChainDepth(callExpr) : 0
    };
  }

  protected calculateChainDepth(node: Parser.SyntaxNode): number {
    let depth = 0;
    let current = node;
    while (current.parent && (current.parent.type === 'call_expression' || current.parent.type === 'member_expression')) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  protected determineCallType(callExpr: Parser.SyntaxNode, resolvedSymbol: Symbol | null): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' {
    // 实现确定调用类型逻辑
    if (callExpr.children[0]?.type === 'new_expression') {
      return 'constructor';
    }

    if (callExpr.parent?.type === 'decorator') {
      return 'decorator';
    }

    // If we have resolved the symbol, check its type
    if (resolvedSymbol) {
      if (resolvedSymbol.type === 'method') {
        return 'method';
      } else if (resolvedSymbol.type === 'function') {
        return 'function';
      }
    }

    return 'function';
  }

  protected extractClassName(classDecl: Parser.SyntaxNode): string | null {
    // 实现提取类名逻辑
    for (const child of classDecl.children) {
      if (child.type === 'identifier' || child.type === 'type_identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  protected findHeritageClauses(node: Parser.SyntaxNode): Parser.SyntaxNode[] {
    // 实现查找继承子句逻辑
    const heritageClauses: Parser.SyntaxNode[] = [];

    for (const child of node.children) {
      if (child.type === 'class_heritage' || child.type === 'extends_clause' || child.type === 'implements_clause') {
        heritageClauses.push(child);
      }
    }
    return heritageClauses;
  }

  protected extractParentClassName(heritageClause: Parser.SyntaxNode): string | null {
    // 实现提取父类名逻辑
    if (heritageClause.children && heritageClause.children.length > 0) {
      const parentClassNode = heritageClause.children[0];
      if (parentClassNode.type === 'identifier' || parentClassNode.type === 'type_identifier') {
        return parentClassNode.text || null;
      } else if (parentClassNode.type === 'member_expression') {
        // Handle namespace.ClassName
        return parentClassNode.text || null;
      }
    }
    return null;
  }

  protected getInheritanceType(heritageClause: Parser.SyntaxNode): 'extends' | 'implements' | 'mixin' {
    // 实现确定继承类型逻辑
    if (heritageClause.type === 'extends_clause') {
      return 'extends';
    } else if (heritageClause.type === 'implements_clause') {
      return 'implements';
    }
    return 'extends'; // 默认返回extends
  }

  protected extractImportInfo(importStmt: Parser.SyntaxNode): {
    source: string;
    importedSymbols: string[];
  } | null {
    // 实现提取导入信息逻辑
    let source = '';
    const importedSymbols: string[] = [];

    for (const child of importStmt.children) {
      // Find the source (usually a string literal)
      if (child.type === 'string' || child.type === 'template_string') {
        source = child.text.replace(/['"`]/g, ''); // Remove quotes
      }
      // Find the import specifiers
      else if (child.type === 'import_clause' || child.type === 'import_specifier' ||
        child.type === 'named_imports' || child.type === 'namespace_import') {
        importedSymbols.push(...this.extractImportSpecifiers(child));
      }
    }

    if (source) {
      return {
        source,
        importedSymbols
      };
    }
    return null;
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

  protected extractImportSpecifiers(node: Parser.SyntaxNode): string[] {
    // 提取导入符号
    const specifiers: string[] = [];

    if (node.type === 'import_specifier') {
      for (const child of node.children) {
        if (child.type === 'identifier' || child.type === 'property_identifier') {
          specifiers.push(child.text || '');
          break;
        }
      }
    } else if (node.type === 'named_imports') {
      for (const child of node.children) {
        if (child.type === 'import_specifier') {
          specifiers.push(...this.extractImportSpecifiers(child));
        }
      }
    } else if (node.type === 'namespace_import') {
      // For import * as name
      for (const child of node.children) {
        if (child.type === 'identifier') {
          specifiers.push(child.text || '');
          break;
        }
      }
    }

    return specifiers;
  }

  protected determineReferenceType(identifier: Parser.SyntaxNode, resolvedSymbol: Symbol): 'variable' | 'constant' | 'parameter' | 'field' | 'interface' | 'type' | 'enum' {
    // 实现确定引用类型逻辑
    // Check parent context to determine reference type
    if (identifier.parent?.type === 'parameter') {
      return 'parameter';
    } else if (identifier.parent?.type === 'property_identifier' &&
      identifier.parent.parent?.type === 'member_expression') {
      return 'field';
    }

    return 'variable';
  }

  protected extractClassNameFromNewExpression(newExpr: Parser.SyntaxNode): string | null {
    // 实现从new表达式中提取类名逻辑
    if (newExpr.children && newExpr.children.length > 0) {
      const classNode = newExpr.children[0];
      if (classNode.type === 'identifier' || classNode.type === 'type_identifier') {
        return classNode.text;
      } else if (classNode.type === 'member_expression') {
        // Handle namespace.ClassName
        return this.extractMemberExpressionName(classNode);
      }
    }
    return null;
  }

  protected extractMemberExpressionName(memberExpr: Parser.SyntaxNode): string | null {
    // Extract name from member expression like namespace.ClassName
    const parts: string[] = [];
    this.collectMemberExpressionParts(memberExpr, parts);
    return parts.join('.');
  }

  protected collectMemberExpressionParts(memberExpr: Parser.SyntaxNode, parts: string[]): void {
    // Recursively collect parts of a member expression
    for (const child of memberExpr.children) {
      if (child.type === 'identifier' || child.type === 'property_identifier' || child.type === 'type_identifier') {
        parts.unshift(child.text);
      } else if (child.type === 'member_expression') {
        this.collectMemberExpressionParts(child, parts);
      }
    }
  }

  protected extractAnnotationName(decorator: Parser.SyntaxNode): string | null {
    // 实现提取注解名逻辑
    if (decorator.children && decorator.children.length > 0) {
      const annotationNode = decorator.children[0];
      if (annotationNode.type === 'identifier') {
        return annotationNode.text || null;
      } else if (annotationNode.type === 'member_expression') {
        // Handle namespace.decorator
        return annotationNode.text || null;
      }
    }
    return null;
  }

  protected extractAnnotationParameters(decorator: Parser.SyntaxNode): Record<string, any> {
    // 实现提取注解参数逻辑
    const parameters: Record<string, any> = {};

    for (const child of decorator.children) {
      if (child.type === 'call_expression') {
        // Decorator with parameters like @decorator(param1, param2)
        const args = this.extractCallArguments(child);
        parameters.args = args;
        break;
      }
    }

    return parameters;
  }

  protected extractCallArguments(callExpr: Parser.SyntaxNode): any[] {
    // 提取调用参数
    const args: any[] = [];

    for (const child of callExpr.children) {
      if (child.type === 'arguments') {
        for (const arg of child.children) {
          // Simplified argument extraction
          args.push({
            type: arg.type,
            text: arg.text
          });
        }
        break;
      }
    }

    return args;
  }

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

  protected inferObjectType(objectLiteral: Parser.SyntaxNode): string | null {
    // 从对象字面量推断类型
    // This is a simplified implementation - in a real system you might look at properties
    // or assign a generic "Object" type
    return 'Object';
  }

  protected generateSymbolId(symbol: Symbol): string {
    return `${symbol.type}_${Buffer.from(`${symbol.filePath}_${symbol.name}`).toString('hex')}`;
  }

  protected generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }
}