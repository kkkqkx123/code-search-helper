import {
  ILanguageRelationshipExtractor,
  CallRelationship,
  InheritanceRelationship,
  DependencyRelationship,
  ReferenceRelationship,
  CreationRelationship,
  AnnotationRelationship,
  DataFlowRelationship,
  ControlFlowRelationship,
  SemanticRelationship,
  LifecycleRelationship,
  ConcurrencyRelationship
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
      'reference', 'creation', 'annotation',
      'data_flow', 'control_flow', 'semantic', 
      'lifecycle', 'concurrency'
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

  // 新增：数据流关系提取
  async extractDataFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DataFlowRelationship[]> {
    const relationships: DataFlowRelationship[] = [];
    
    // 使用Tree-Sitter查询提取数据流关系
    const queryResult = this.treeSitterService.queryTree(ast, `
      ; 变量赋值数据流
      (assignment_expression
        left: (identifier) @source.variable
        right: (identifier) @target.variable) @data.flow.assignment
      
      ; 对象属性赋值数据流
      (assignment_expression
        left: (member_expression
          object: (identifier) @source.object
          property: (property_identifier) @source.property)
        right: (identifier) @target.variable) @data.flow.property.assignment
      
      ; 数组元素赋值数据流
      (assignment_expression
        left: (subscript_expression
          object: (identifier) @source.array
          index: (identifier) @source.index)
        right: (identifier) @target.variable) @data.flow.array.assignment
      
      ; 函数参数传递数据流
      (call_expression
        function: (identifier) @target.function
        arguments: (argument_list
          (identifier) @source.parameter)) @data.flow.parameter
      
      ; 方法调用参数传递数据流
      (call_expression
        function: (member_expression
          object: (identifier) @target.object
          property: (property_identifier) @target.method)
        arguments: (argument_list
          (identifier) @source.parameter)) @data.flow.method.parameter
      
      ; 返回值数据流
      (return_statement
        (identifier) @source.variable) @data.flow.return
      
      ; 对象属性返回数据流
      (return_statement
        (member_expression
          object: (identifier) @source.object
          property: (property_identifier) @source.property)) @data.flow.property.return
      
      ; 函数表达式赋值数据流
      (assignment_expression
        left: (identifier) @source.variable
        right: (function_expression) @target.function) @data.flow.function.assignment
      
      ; 箭头函数赋值数据流
      (assignment_expression
        left: (identifier) @source.variable
        right: (arrow_function) @target.function) @data.flow.arrow.assignment
      
      ; 对象解构赋值数据流
      (assignment_expression
        left: (object_pattern
          (pair
            key: (property_identifier) @source.property
            value: (identifier) @target.variable))) @data.flow.destructuring.object
      
      ; 数组解构赋值数据流
      (assignment_expression
        left: (array_pattern
          (identifier) @target.variable)) @data.flow.destructuring.array
      
      ; 链式调用数据流
      (call_expression
        function: (member_expression
          object: (call_expression) @source.call
          property: (property_identifier) @target.method)) @data.flow.chained.call
    `);
    
    if (queryResult && Array.isArray(queryResult)) {
      for (const result of queryResult) {
        const captures = result.captures || [];
        let sourceId = '';
        let targetId = '';
        let flowType: 'variable_assignment' | 'parameter_passing' | 'return_value' | 'field_access' = 'variable_assignment';
        
        // 解析捕获的节点
        for (const capture of captures) {
          const captureName = capture.name;
          const node = capture.node;
          
          if (captureName === 'source.variable' || captureName === 'source.parameter') {
            const sourceName = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(sourceName, filePath, node);
            sourceId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(sourceName, 'variable', filePath);
          } else if (captureName === 'target.variable' || captureName === 'target.function') {
            const targetName = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(targetName, filePath, node);
            targetId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(targetName, 'variable', filePath);
          } else if (captureName === 'source.object' || captureName === 'source.property') {
            const name = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(name, filePath, node);
            if (!sourceId) {
              sourceId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(name, 'field', filePath);
            } else if (!targetId) {
              targetId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(name, 'field', filePath);
            }
          }
          
          // 确定数据流类型
          if (captureName.includes('assignment')) {
            flowType = 'variable_assignment';
          } else if (captureName.includes('parameter')) {
            flowType = 'parameter_passing';
          } else if (captureName.includes('return')) {
            flowType = 'return_value';
          } else if (captureName.includes('property') || captureName.includes('field')) {
            flowType = 'field_access';
          }
        }
        
        if (sourceId && targetId) {
          relationships.push({
            sourceId,
            targetId,
            flowType,
            flowPath: [sourceId, targetId],
            location: {
              filePath,
              lineNumber: captures[0]?.node?.startPosition.row + 1 || 0,
              columnNumber: captures[0]?.node?.startPosition.column + 1 || 0
            }
          });
        }
      }
    }
    
    return relationships;
  }

  // 新增：控制流关系提取
  async extractControlFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ControlFlowRelationship[]> {
    const relationships: ControlFlowRelationship[] = [];
    
    // 使用Tree-Sitter查询提取控制流关系
    const queryResult = this.treeSitterService.queryTree(ast, `
      ; If语句控制流
      (if_statement
        condition: (parenthesized_expression) @condition) @control.flow.conditional
      
      ; For循环控制流
      (for_statement
        condition: (parenthesized_expression) @condition) @control.flow.loop
      
      ; While循环控制流
      (while_statement
        condition: (parenthesized_expression) @condition) @control.flow.loop
      
      ; Do-while循环控制流
      (do_statement
        condition: (parenthesized_expression) @condition) @control.flow.loop
      
      ; Switch语句控制流
      (switch_statement
        value: (identifier) @condition) @control.flow.switch
      
      ; Try-catch异常控制流
      (try_statement) @control.flow.exception
      
      ; Catch子句
      (catch_clause) @control.flow.exception
      
      ; Throw语句
      (throw_statement) @control.flow.exception
      
      ; Return语句
      (return_statement) @control.flow.return
      
      ; Break语句
      (break_statement) @control.flow.break
      
      ; Continue语句
      (continue_statement) @control.flow.continue
      
      ; Await表达式控制流
      (await_expression) @control.flow.async_await
      
      ; Yield表达式控制流
      (yield_expression) @control.flow.yield
    `);
    
    if (queryResult && Array.isArray(queryResult)) {
      for (const result of queryResult) {
        const captures = result.captures || [];
        let sourceId = '';
        let targetId = '';
        let flowType: 'conditional' | 'loop' | 'exception' | 'callback' | 'async_await' = 'conditional';
        let condition = '';
        let isExceptional = false;
        
        // 解析捕获的节点
        for (const capture of captures) {
          const captureName = capture.name;
          const node = capture.node;
          
          if (captureName === 'condition') {
            condition = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(condition, filePath, node);
            sourceId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(condition, 'condition', filePath);
          }
          
          // 确定控制流类型
          if (captureName.includes('conditional')) {
            flowType = 'conditional';
          } else if (captureName.includes('loop')) {
            flowType = 'loop';
          } else if (captureName.includes('exception')) {
            flowType = 'exception';
            isExceptional = true;
          } else if (captureName.includes('async_await') || captureName.includes('await')) {
            flowType = 'async_await';
          } else if (captureName.includes('yield')) {
            flowType = 'callback';
          }
        }
        
        if (sourceId) {
          targetId = this.generateNodeId(`control_flow_target_${result.captures[0]?.node?.startPosition.row}`, 'control_flow_target', filePath);
          relationships.push({
            sourceId,
            targetId,
            flowType,
            condition,
            isExceptional,
            location: {
              filePath,
              lineNumber: captures[0]?.node?.startPosition.row + 1 || 0,
              columnNumber: captures[0]?.node?.startPosition.column + 1 || 0
            }
          });
        } else {
          // 如果没有条件，仍然创建控制流关系
          sourceId = this.generateNodeId(`control_flow_source_${result.captures[0]?.node?.startPosition.row}`, 'control_flow_source', filePath);
          targetId = this.generateNodeId(`control_flow_target_${result.captures[0]?.node?.startPosition.row}`, 'control_flow_target', filePath);
          
          // 确定控制流类型
          const captureName = captures[0]?.name || '';
          if (captureName.includes('conditional')) {
            flowType = 'conditional';
          } else if (captureName.includes('loop')) {
            flowType = 'loop';
          } else if (captureName.includes('exception')) {
            flowType = 'exception';
            isExceptional = true;
          } else if (captureName.includes('async_await') || captureName.includes('await')) {
            flowType = 'async_await';
          } else if (captureName.includes('yield')) {
            flowType = 'callback';
          }
          
          relationships.push({
            sourceId,
            targetId,
            flowType,
            condition,
            isExceptional,
            location: {
              filePath,
              lineNumber: captures[0]?.node?.startPosition.row + 1 || 0,
              columnNumber: captures[0]?.node?.startPosition.column + 1 || 0
            }
          });
        }
      }
    }
    
    return relationships;
  }

  // 新增：语义关系提取
  async extractSemanticRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<SemanticRelationship[]> {
    const relationships: SemanticRelationship[] = [];
    
    // 使用Tree-Sitter查询提取语义关系
    const queryResult = this.treeSitterService.queryTree(ast, `
      ; 原型链继承关系（方法重写）
      (assignment_expression
        left: (member_expression
          object: (identifier) @subclass.object
          property: (property_identifier) @overridden.method)
        right: (function_expression)) @semantic.relationship.prototype.override
      
      ; 类继承关系（方法重写）
      (class_declaration
        name: (identifier) @subclass.class
        heritage: (class_heritage
          (identifier) @superclass.class)
        body: (class_body
          (method_definition
            name: (property_identifier) @overridden.method))) @semantic.relationship.class.override
      
      ; 混入模式（委托关系）
      (call_expression
        function: (member_expression
          object: (identifier) @mixin.object
          property: (property_identifier) @mixin.method)
        arguments: (argument_list
          (identifier) @target.object)) @semantic.relationship.mixin.delegation
      
      ; 观察者模式（事件监听）
      (call_expression
        function: (member_expression
          object: (identifier) @observer.target
          property: (property_identifier) @observer.method
          (#match? @observer.method "^(addEventListener|on|watch|subscribe)$"))
        arguments: (argument_list
          (string) @event.name
          (function_expression) @handler.function)) @semantic.relationship.observer.pattern
      
      ; 发布订阅模式
      (call_expression
        function: (member_expression
          object: (identifier) @publisher.object
          property: (property_identifier) @publisher.method
          (#match? @publisher.method "^(emit|publish|notify)$"))
        arguments: (argument_list
          (string) @event.name
          (identifier) @event.data)) @semantic.relationship.publisher.pattern
      
      ; 配置对象模式
      (call_expression
        function: (identifier) @configurable.function
        arguments: (argument_list
          (object
            (pair
              key: (property_identifier) @config.key
              value: (identifier) @config.value)))) @semantic.relationship.configuration
      
      ; 工厂模式
      (call_expression
        function: (identifier) @factory.function
        arguments: (argument_list
          (identifier) @factory.parameter)) @semantic.relationship.factory.pattern
      
      ; 单例模式
      (assignment_expression
        left: (member_expression
          object: (identifier) @singleton.object
          property: (property_identifier) @singleton.instance)
        right: (call_expression
          function: (identifier) @constructor.function)) @semantic.relationship.singleton.pattern
      
      ; 装饰器模式（高阶函数）
      (call_expression
        function: (identifier) @decorator.function
        arguments: (argument_list
          (function_expression) @decorated.function)) @semantic.relationship.decorator.pattern
      
      ; 策略模式
      (call_expression
        function: (member_expression
          object: (identifier) @context.object
          property: (property_identifier) @strategy.setter
          (#match? @strategy.setter "^(setStrategy|setAlgorithm)$"))
        arguments: (argument_list
          (identifier) @strategy.object)) @semantic.relationship.strategy.pattern
      
      ; 命令模式
      (call_expression
        function: (member_expression
          object: (identifier) @invoker.object
          property: (property_identifier) @invoker.method
          (#match? @invoker.method "^(execute|invoke|run)$"))
        arguments: (argument_list
          (identifier) @command.object)) @semantic.relationship.command.pattern
    `);
    
    if (queryResult && Array.isArray(queryResult)) {
      for (const result of queryResult) {
        const captures = result.captures || [];
        let sourceId = '';
        let targetId = '';
        let semanticType: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures' = 'overrides';
        let pattern = '';
        const metadata: Record<string, any> = {};
        
        // 解析捕获的节点
        for (const capture of captures) {
          const captureName = capture.name;
          const node = capture.node;
          
          if (captureName === 'subclass.object' || captureName === 'subclass.class' ||
              captureName === 'mixin.object' || captureName === 'observer.target' ||
              captureName === 'publisher.object' || captureName === 'configurable.function' ||
              captureName === 'factory.function' || captureName === 'singleton.object' ||
              captureName === 'decorator.function' || captureName === 'context.object' ||
              captureName === 'invoker.object') {
            const name = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(name, filePath, node);
            sourceId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(name, 'semantic_source', filePath);
          } else if (captureName === 'overridden.method' || captureName === 'superclass.class' ||
                     captureName === 'mixin.method' || captureName === 'observer.method' ||
                     captureName === 'publisher.method' || captureName === 'config.key' ||
                     captureName === 'factory.parameter' || captureName === 'singleton.instance' ||
                     captureName === 'decorated.function' || captureName === 'strategy.object' ||
                     captureName === 'strategy.setter' || captureName === 'invoker.method' ||
                     captureName === 'command.object') {
            const name = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(name, filePath, node);
            targetId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(name, 'semantic_target', filePath);
          }
          
          // 确定语义关系类型和模式
          if (captureName.includes('override')) {
            semanticType = 'overrides';
            pattern = 'Override';
          } else if (captureName.includes('overload')) {
            semanticType = 'overloads';
            pattern = 'Overload';
          } else if (captureName.includes('delegation') || captureName.includes('mixin')) {
            semanticType = 'delegates';
            pattern = 'Mixin';
          } else if (captureName.includes('observer') || captureName.includes('publisher')) {
            semanticType = 'observes';
            pattern = 'Observer';
          } else if (captureName.includes('configuration') || captureName.includes('config')) {
            semanticType = 'configures';
            pattern = 'Configuration';
          } else if (captureName.includes('factory')) {
            pattern = 'Factory';
          } else if (captureName.includes('singleton')) {
            pattern = 'Singleton';
          } else if (captureName.includes('decorator')) {
            pattern = 'Decorator';
          } else if (captureName.includes('strategy')) {
            pattern = 'Strategy';
          } else if (captureName.includes('command')) {
            pattern = 'Command';
          }
          
          // 收集元数据
          if (captureName.includes('event.name')) {
            metadata.eventName = node.text;
          } else if (captureName.includes('event.data')) {
            metadata.eventData = node.text;
          }
        }
        
        if (sourceId && targetId) {
          relationships.push({
            sourceId,
            targetId,
            semanticType,
            pattern,
            metadata,
            location: {
              filePath,
              lineNumber: captures[0]?.node?.startPosition.row + 1 || 0,
              columnNumber: captures[0]?.node?.startPosition.column + 1 || 0
            }
          });
        }
      }
    }
    
    return relationships;
  }

  // 新增：生命周期关系提取
  async extractLifecycleRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<LifecycleRelationship[]> {
    const relationships: LifecycleRelationship[] = [];
    
    // 使用Tree-Sitter查询提取生命周期关系
    const queryResult = this.treeSitterService.queryTree(ast, `
      ; 对象实例化关系
      (new_expression
        constructor: (identifier) @instantiated.class
        arguments: (argument_list
          (identifier) @constructor.parameter)) @lifecycle.relationship.instantiation
      
      ; 类实例化关系
      (new_expression
        constructor: (member_expression
          object: (identifier) @module.object
          property: (identifier) @instantiated.class)
        arguments: (argument_list
          (identifier) @constructor.parameter)) @lifecycle.relationship.class.instantiation
      
      ; 构造函数调用关系
      (call_expression
        function: (member_expression
          object: (this) @constructor.this
          property: (property_identifier) @constructor.method
          (#match? @constructor.method "constructor$"))) @lifecycle.relationship.constructor.call
      
      ; 原型方法初始化
      (assignment_expression
        left: (member_expression
          object: (member_expression
            object: (identifier) @class.object
            property: (property_identifier) @prototype.property)
          property: (property_identifier) @init.method)
        right: (function_expression)) @lifecycle.relationship.prototype.initialization
      
      ; 对象初始化方法
      (call_expression
        function: (member_expression
          object: (identifier) @initialized.object
          property: (property_identifier) @init.method
          (#match? @init.method "^(init|initialize|setup|configure)$"))
        arguments: (argument_list
          (identifier) @init.parameter)) @lifecycle.relationship.object.initialization
      
      ; React组件生命周期
      (method_definition
        name: (property_identifier) @lifecycle.method
        (#match? @lifecycle.method "^(componentDidMount|componentDidUpdate|componentWillUnmount|useEffect|useLayoutEffect)$")) @lifecycle.relationship.react.lifecycle
      
      ; 销毁关系
      (call_expression
        function: (member_expression
          object: (identifier) @destroyed.object
          property: (property_identifier) @destroy.method
          (#match? @destroy.method "^(destroy|dispose|cleanup|teardown|close)$"))) @lifecycle.relationship.destruction
      
      ; 事件监听器添加（生命周期管理）
      (call_expression
        function: (member_expression
          object: (identifier) @event.target
          property: (property_identifier) @add.listener.method
          (#match? @add.listener.method "^(addEventListener|addListener|on)$"))
        arguments: (argument_list
          (string) @event.name
          (identifier) @handler.function)) @lifecycle.relationship.listener.addition
      
      ; 事件监听器移除（生命周期管理）
      (call_expression
        function: (member_expression
          object: (identifier) @event.target
          property: (property_identifier) @remove.listener.method
          (#match? @remove.listener.method "^(removeEventListener|removeListener|off)$"))
        arguments: (argument_list
          (string) @event.name
          (identifier) @handler.function)) @lifecycle.relationship.listener.removal
      
      ; 定时器创建（生命周期管理）
      (call_expression
        function: (identifier) @timer.function
        (#match? @timer.function "^(setTimeout|setInterval)$")
        arguments: (argument_list
          (function_expression) @timer.handler
          (identifier) @timer.delay)) @lifecycle.relationship.timer.creation
      
      ; 定时器清除（生命周期管理）
      (call_expression
        function: (identifier) @clear.timer.function
        (#match? @clear.timer.function "^(clearTimeout|clearInterval)$")
        arguments: (argument_list
          (identifier) @timer.id)) @lifecycle.relationship.timer.clearance
      
      ; Promise创建（异步生命周期）
      (call_expression
        function: (identifier) @promise.constructor
        (#match? @promise.constructor "Promise$")
        arguments: (argument_list
          (function_expression) @promise.executor)) @lifecycle.relationship.promise.creation
      
      ; 异步资源管理
      (call_expression
        function: (member_expression
          object: (identifier) @async.resource
          property: (property_identifier) @async.method
          (#match? @async.method "^(acquire|release|open|close|start|stop)$"))) @lifecycle.relationship.async.resource.management
    `);
    
    if (queryResult && Array.isArray(queryResult)) {
      for (const result of queryResult) {
        const captures = result.captures || [];
        let sourceId = '';
        let targetId = '';
        let lifecycleType: 'instantiates' | 'initializes' | 'destroys' | 'manages' = 'instantiates';
        let lifecyclePhase: 'creation' | 'setup' | 'teardown' | 'maintenance' = 'creation';
        
        // 解析捕获的节点
        for (const capture of captures) {
          const captureName = capture.name;
          const node = capture.node;
          
          if (captureName === 'instantiated.class' || captureName === 'module.object' ||
              captureName === 'constructor.this' || captureName === 'class.object' ||
              captureName === 'initialized.object' || captureName === 'lifecycle.method' ||
              captureName === 'destroyed.object' || captureName === 'event.target' ||
              captureName === 'timer.function' || captureName === 'promise.constructor' ||
              captureName === 'async.resource') {
            const name = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(name, filePath, node);
            sourceId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(name, 'lifecycle_source', filePath);
          } else if (captureName === 'constructor.parameter' || captureName === 'prototype.property' ||
                     captureName === 'init.method' || captureName === 'init.parameter' ||
                     captureName === 'destroy.method' || captureName === 'event.name' ||
                     captureName === 'handler.function' || captureName === 'timer.handler' ||
                     captureName === 'timer.delay' || captureName === 'timer.id' ||
                     captureName === 'promise.executor' || captureName === 'async.method') {
            const name = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(name, filePath, node);
            targetId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(name, 'lifecycle_target', filePath);
          }
          
          // 确定生命周期类型和阶段
          if (captureName.includes('instantiation') || captureName.includes('constructor')) {
            lifecycleType = 'instantiates';
            lifecyclePhase = 'creation';
          } else if (captureName.includes('initialization') || captureName.includes('init')) {
            lifecycleType = 'initializes';
            lifecyclePhase = 'setup';
          } else if (captureName.includes('destruction') || captureName.includes('destroy')) {
            lifecycleType = 'destroys';
            lifecyclePhase = 'teardown';
          } else if (captureName.includes('management') || captureName.includes('listener') ||
                     captureName.includes('timer') || captureName.includes('promise')) {
            lifecycleType = 'manages';
            lifecyclePhase = 'maintenance';
          }
        }
        
        if (sourceId && targetId) {
          relationships.push({
            sourceId,
            targetId,
            lifecycleType,
            lifecyclePhase,
            location: {
              filePath,
              lineNumber: captures[0]?.node?.startPosition.row + 1 || 0,
              columnNumber: captures[0]?.node?.startPosition.column + 1 || 0
            }
          });
        }
      }
    }
    
    return relationships;
  }

  // 新增：并发关系提取
  async extractConcurrencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ConcurrencyRelationship[]> {
    const relationships: ConcurrencyRelationship[] = [];
    
    // 使用Tree-Sitter查询提取并发关系
    const queryResult = this.treeSitterService.queryTree(ast, `
      ; Promise创建（异步并发）
      (call_expression
        function: (identifier) @promise.constructor
        (#match? @promise.constructor "Promise$")
        arguments: (argument_list
          (function_expression) @promise.executor)) @concurrency.relationship.promise.creation
      
      ; Promise链式调用（异步并发）
      (call_expression
        function: (member_expression
          object: (call_expression) @source.promise
          property: (property_identifier) @promise.method
          (#match? @promise.method "^(then|catch|finally)$"))
        arguments: (argument_list
          (function_expression) @handler.function)) @concurrency.relationship.promise.chain
      
      ; Async函数定义
      (async_function_declaration
        name: (identifier) @async.function) @concurrency.relationship.async.function
      
      ; Async函数调用
      (call_expression
        function: (identifier) @async.function
        arguments: (argument_list
          (identifier) @async.parameter)) @concurrency.relationship.async.call
      
      ; Await表达式
      (await_expression
        (call_expression) @awaited.call) @concurrency.relationship.await.expression
      
      ; 并行Promise执行
      (call_expression
        function: (member_expression
          object: (identifier) @promise.object
          property: (property_identifier) @parallel.method
          (#match? @parallel.method "^(all|allSettled|race)$"))
        arguments: (argument_list
          (array
            (identifier) @parallel.promise))) @concurrency.relationship.parallel.execution
      
      ; Worker创建
      (new_expression
        constructor: (identifier) @worker.constructor
        (#match? @worker.constructor "Worker$")
        arguments: (argument_list
          (string) @worker.script)) @concurrency.relationship.worker.creation
      
      ; Worker消息发送
      (call_expression
        function: (member_expression
          object: (identifier) @worker.object
          property: (property_identifier) @worker.method
          (#match? @worker.method "^(postMessage|send)$"))
        arguments: (argument_list
          (identifier) @worker.message)) @concurrency.relationship.worker.communication
      
      ; Worker消息接收
      (assignment_expression
        left: (identifier) @message.handler
        right: (member_expression
          object: (identifier) @worker.object
          property: (property_identifier) @worker.event
          (#match? @worker.event "onmessage$"))) @concurrency.relationship.worker.message.reception
      
      ; 共享数组缓冲区
      (new_expression
        constructor: (identifier) @shared.array.constructor
        (#match? @shared.array.constructor "SharedArrayBuffer$")
        arguments: (argument_list
          (identifier) @buffer.size)) @concurrency.relationship.shared.array
      
      ; Atomics操作
      (call_expression
        function: (member_expression
          object: (identifier) @atomics.object
          property: (property_identifier) @atomics.method
          (#match? @atomics.method "^(add|sub|and|or|xor|load|store|compareExchange)$"))
        arguments: (argument_list
          (identifier) @atomics.target
          (identifier) @atomics.value)) @concurrency.relationship.atomics.operation
      
      ; 锁机制模拟
      (call_expression
        function: (member_expression
          object: (identifier) @lock.object
          property: (property_identifier) @lock.method
          (#match? @lock.method "^(acquire|release|tryAcquire)$"))) @concurrency.relationship.lock.operation
      
      ; 条件变量模拟
      (call_expression
        function: (member_expression
          object: (identifier) @condition.variable
          property: (property_identifier) @condition.method
          (#match? @condition.method "^(wait|signal|signalAll)$"))) @concurrency.relationship.condition.variable
      
      ; 信号量模拟
      (call_expression
        function: (member_expression
          object: (identifier) @semaphore.object
          property: (property_identifier) @semaphore.method
          (#match? @semaphore.method "^(acquire|release|availablePermits)$"))) @concurrency.relationship.semaphore.operation
      
      ; 竞态条件检测 - 简化版本
      (assignment_expression
        left: (identifier) @shared.variable
        right: (identifier) @source.variable) @concurrency.relationship.race.condition
    `);
    
    if (queryResult && Array.isArray(queryResult)) {
      for (const result of queryResult) {
        const captures = result.captures || [];
        let sourceId = '';
        let targetId = '';
        let concurrencyType: 'synchronizes' | 'locks' | 'communicates' | 'races' | 'awaits' = 'synchronizes';
        let synchronizationMechanism = '';
        
        // 解析捕获的节点
        for (const capture of captures) {
          const captureName = capture.name;
          const node = capture.node;
          
          if (captureName === 'promise.constructor' || captureName === 'async.function' ||
              captureName === 'worker.constructor' || captureName === 'shared.array.constructor' ||
              captureName === 'atomics.object' || captureName === 'lock.object' ||
              captureName === 'condition.variable' || captureName === 'semaphore.object' ||
              captureName === 'shared.variable') {
            const name = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(name, filePath, node);
            sourceId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(name, 'concurrency_source', filePath);
          } else if (captureName === 'promise.executor' || captureName === 'promise.method' ||
                     captureName === 'handler.function' || captureName === 'worker.script' ||
                     captureName === 'worker.method' || captureName === 'worker.message' ||
                     captureName === 'message.handler' || captureName === 'worker.event' ||
                     captureName === 'buffer.size' || captureName === 'atomics.method' ||
                     captureName === 'atomics.target' || captureName === 'atomics.value' ||
                     captureName === 'lock.method' || captureName === 'condition.method' ||
                     captureName === 'semaphore.method' || captureName === 'source.variable') {
            const name = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(name, filePath, node);
            targetId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(name, 'concurrency_target', filePath);
          }
          
          // 确定并发关系类型和同步机制
          if (captureName.includes('promise') || captureName.includes('async') || captureName.includes('await')) {
            concurrencyType = 'awaits';
            synchronizationMechanism = 'promise';
          } else if (captureName.includes('worker')) {
            concurrencyType = 'communicates';
            synchronizationMechanism = 'worker';
          } else if (captureName.includes('atomics') || captureName.includes('lock') ||
                     captureName.includes('condition') || captureName.includes('semaphore')) {
            concurrencyType = 'locks';
            synchronizationMechanism = 'synchronization';
          } else if (captureName.includes('race')) {
            concurrencyType = 'races';
            synchronizationMechanism = 'race_condition';
          } else if (captureName.includes('parallel')) {
            concurrencyType = 'synchronizes';
            synchronizationMechanism = 'parallel_execution';
          }
        }
        
        if (sourceId && targetId) {
          relationships.push({
            sourceId,
            targetId,
            concurrencyType,
            synchronizationMechanism,
            location: {
              filePath,
              lineNumber: captures[0]?.node?.startPosition.row + 1 || 0,
              columnNumber: captures[0]?.node?.startPosition.column + 1 || 0
            }
          });
        }
      }
    }
    
    return relationships;
  }

  protected generateSymbolId(symbol: Symbol): string {
    return `${symbol.type}_${Buffer.from(`${symbol.filePath}_${symbol.name}`).toString('hex')}`;
  }

  protected generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }
}