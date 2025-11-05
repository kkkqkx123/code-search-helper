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
import { SymbolResolver, Symbol, SymbolType } from '../../symbol/SymbolResolver';
import { TreeSitterService } from '../../../parser/core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../../../types';
import Parser = require('tree-sitter');
import { LANGUAGE_NODE_MAPPINGS } from '../LanguageNodeTypes';

@injectable()
export class JavaRelationshipExtractor implements ILanguageRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) protected treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) protected logger: LoggerService
  ) { }

  getSupportedLanguage(): string {
    return 'java';
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

    // 查找所有方法调用表达式
    const methodInvocations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['java'].callExpression
    );

    for (const methodInvocation of methodInvocations) {
      // 使用符号解析器查找调用者方法
      const callerSymbol = this.findCallerSymbol(methodInvocation, symbolResolver, filePath);
      const calleeName = this.extractCalleeName(methodInvocation);

      if (callerSymbol && calleeName) {
        // 使用符号解析器解析被调用方法
        const resolvedSymbol = symbolResolver.resolveSymbol(calleeName, filePath, methodInvocation);

        // 分析调用上下文
        const callContext = this.analyzeCallContext(methodInvocation);

        relationships.push({
          callerId: this.generateSymbolId(callerSymbol),
          calleeId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(calleeName, 'method', filePath),
          callName: calleeName,
          location: {
            filePath,
            lineNumber: methodInvocation.startPosition.row + 1,
            columnNumber: methodInvocation.startPosition.column + 1
          },
          callType: this.determineCallType(methodInvocation, resolvedSymbol),
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
      LANGUAGE_NODE_MAPPINGS['java'].classDeclaration
    );

    for (const classDecl of classDeclarations) {
      const className = this.extractClassName(classDecl);
      const superClass = this.findSuperClass(classDecl);
      const implementedInterfaces = this.findImplementedInterfaces(classDecl);

      if (className) {
        // 处理继承关系
        if (superClass) {
          const parentClassName = this.extractSuperClassName(superClass);

          if (parentClassName) {
            // 使用符号解析器解析父类符号
            const resolvedParentSymbol = symbolResolver.resolveSymbol(parentClassName, filePath, superClass);
            const childSymbol = symbolResolver.resolveSymbol(className, filePath, classDecl);

            relationships.push({
              parentId: resolvedParentSymbol ? this.generateSymbolId(resolvedParentSymbol) : this.generateNodeId(parentClassName, 'class', filePath),
              childId: childSymbol ? this.generateSymbolId(childSymbol) : this.generateNodeId(className, 'class', filePath),
              inheritanceType: 'extends',
              location: {
                filePath,
                lineNumber: classDecl.startPosition.row + 1
              },
              resolvedParentSymbol: resolvedParentSymbol || undefined,
              resolvedChildSymbol: childSymbol || undefined
            });
          }
        }

        // 处理接口实现关系
        for (const interfaceNode of implementedInterfaces) {
          const interfaceName = this.extractInterfaceName(interfaceNode);

          if (interfaceName) {
            // 使用符号解析器解析接口符号
            const resolvedInterfaceSymbol = symbolResolver.resolveSymbol(interfaceName, filePath, interfaceNode);
            const childSymbol = symbolResolver.resolveSymbol(className, filePath, classDecl);

            relationships.push({
              parentId: resolvedInterfaceSymbol ? this.generateSymbolId(resolvedInterfaceSymbol) : this.generateNodeId(interfaceName, 'interface', filePath),
              childId: childSymbol ? this.generateSymbolId(childSymbol) : this.generateNodeId(className, 'class', filePath),
              inheritanceType: 'implements',
              location: {
                filePath,
                lineNumber: classDecl.startPosition.row + 1
              },
              resolvedParentSymbol: resolvedInterfaceSymbol || undefined,
              resolvedChildSymbol: childSymbol || undefined
            });
          }
        }
      }
    }

    // 查找接口声明
    const interfaceDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['java'].interfaceDeclaration
    );

    for (const interfaceDecl of interfaceDeclarations) {
      const interfaceName = this.extractInterfaceName(interfaceDecl);
      const extendedInterfaces = this.findExtendedInterfaces(interfaceDecl);

      if (interfaceName) {
        // 处理接口继承关系
        for (const extendedInterface of extendedInterfaces) {
          const parentInterfaceName = this.extractInterfaceName(extendedInterface);

          if (parentInterfaceName) {
            // 使用符号解析器解析父接口符号
            const resolvedParentSymbol = symbolResolver.resolveSymbol(parentInterfaceName, filePath, extendedInterface);
            const childSymbol = symbolResolver.resolveSymbol(interfaceName, filePath, interfaceDecl);

            relationships.push({
              parentId: resolvedParentSymbol ? this.generateSymbolId(resolvedParentSymbol) : this.generateNodeId(parentInterfaceName, 'interface', filePath),
              childId: childSymbol ? this.generateSymbolId(childSymbol) : this.generateNodeId(interfaceName, 'interface', filePath),
              inheritanceType: 'extends',
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
    const relationships: DependencyRelationship[] = [];

    // 查找导入语句
    const importDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['java'].importDeclaration
    );

    for (const importDecl of importDeclarations) {
      const importInfo = this.extractImportInfo(importDecl);

      if (importInfo) {
        // 使用符号解析器解析导入的模块
        const resolvedTargetSymbol = symbolResolver.resolveSymbol(importInfo.source, filePath, importDecl);

        relationships.push({
          sourceId: this.generateNodeId(filePath, 'file', filePath),
          targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(importInfo.source, 'module', importInfo.source),
          dependencyType: 'import',
          target: importInfo.source,
          importedSymbols: importInfo.importedSymbols,
          location: {
            filePath,
            lineNumber: importDecl.startPosition.row + 1
          },
          resolvedTargetSymbol: resolvedTargetSymbol || undefined
        });
      }
    }

    // 查找包声明
    const packageDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['java'].importDeclaration.filter(type => type === 'package_declaration')
    );

    for (const packageDecl of packageDeclarations) {
      const packageName = this.extractPackageName(packageDecl);

      if (packageName) {
        relationships.push({
          sourceId: this.generateNodeId(filePath, 'file', filePath),
          targetId: this.generateNodeId(packageName, 'package', packageName),
          dependencyType: 'namespace',
          target: packageName,
          location: {
            filePath,
            lineNumber: packageDecl.startPosition.row + 1
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
    const relationships: ReferenceRelationship[] = [];

    // 查找所有标识符引用和枚举常量
    const identifiers = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['java'].propertyIdentifier
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

    // 查找字段访问表达式
    const fieldAccesses = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['java'].memberExpression
    );

    for (const fieldAccess of fieldAccesses) {
      const fieldName = this.extractFieldName(fieldAccess);

      if (fieldName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(fieldName, filePath, fieldAccess);

        if (resolvedSymbol) {
          // 确定引用类型
          const referenceType = this.determineReferenceType(fieldAccess, resolvedSymbol) as 'variable' | 'constant' | 'parameter' | 'field';

          relationships.push({
            sourceId: this.generateNodeId(fieldName, 'reference', filePath),
            targetId: this.generateSymbolId(resolvedSymbol),
            referenceType,
            referenceName: fieldName,
            location: {
              filePath,
              lineNumber: fieldAccess.startPosition.row + 1,
              columnNumber: fieldAccess.startPosition.column + 1
            },
            resolvedSymbol
          });
        }
      }
    }

    // 查找方法声明的引用
    const methodDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['java'].methodDeclaration
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

    return relationships;
  }

  async extractCreationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<CreationRelationship[]> {
    const relationships: CreationRelationship[] = [];

    // 查找类实例化调用
    const classInstanceCreations = this.treeSitterService.findNodesByTypes(ast,
      ['class_creator', 'object_creation_expression']
    );

    for (const classCreation of classInstanceCreations) {
      const className = this.extractClassNameFromCreation(classCreation);

      if (className) {
        // 使用符号解析器解析类符号
        const resolvedSymbol = symbolResolver.resolveSymbol(className, filePath, classCreation);

        relationships.push({
          sourceId: this.generateNodeId(`creation_${classCreation.startPosition.row}`, 'creation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(className, 'class', filePath),
          creationType: 'instantiation',
          targetName: className,
          location: {
            filePath,
            lineNumber: classCreation.startPosition.row + 1,
            columnNumber: classCreation.startPosition.column + 1
          },
          resolvedTargetSymbol: resolvedSymbol || undefined
        });
      }
    }

    // 查找Lambda表达式
    const lambdaExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['java'].lambdaExpression
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

    // 查找数组创建
    const arrayCreations = this.treeSitterService.findNodesByTypes(ast,
      ['array_creation_expression']
    );

    for (const arrayCreation of arrayCreations) {
      relationships.push({
        sourceId: this.generateNodeId(`array_creation_${arrayCreation.startPosition.row}`, 'creation', filePath),
        targetId: this.generateNodeId('Array', 'builtin', filePath),
        creationType: 'instantiation',
        targetName: 'Array',
        location: {
          filePath,
          lineNumber: arrayCreation.startPosition.row + 1,
          columnNumber: arrayCreation.startPosition.column + 1
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
    const relationships: AnnotationRelationship[] = [];

    // 查找注解
    const annotations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['java'].decorator
    );

    for (const annotation of annotations) {
      const annotationName = this.extractAnnotationName(annotation);
      const parameters = this.extractAnnotationParameters(annotation);

      if (annotationName) {
        // 使用符号解析器解析注解符号
        const resolvedSymbol = symbolResolver.resolveSymbol(annotationName, filePath, annotation);

        relationships.push({
          sourceId: this.generateNodeId(`annotation_${annotation.startPosition.row}`, 'annotation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(annotationName, 'annotation', filePath),
          annotationType: 'annotation',
          annotationName,
          parameters,
          location: {
            filePath,
            lineNumber: annotation.startPosition.row + 1,
            columnNumber: annotation.startPosition.column + 1
          },
          resolvedAnnotationSymbol: resolvedSymbol || undefined
        });
      }
    }

    return relationships;
  }

  // Java特定的辅助方法实现
  protected findCallerSymbol(methodInvocation: Parser.SyntaxNode, symbolResolver: SymbolResolver, filePath: string): Symbol | null {
    // 实现查找调用者方法符号的逻辑
    // 需要向上遍历AST找到包含当前调用的方法
    let currentNode: Parser.SyntaxNode | null = methodInvocation.parent;
    while (currentNode) {
      if (currentNode.type === 'method_declaration' ||
        currentNode.type === 'constructor_declaration') {
        // 查找方法名
        for (const child of currentNode.children) {
          if (child.type === 'identifier') {
            const methodName = child.text;
            if (methodName) {
              return symbolResolver.resolveSymbol(methodName, filePath, child);
            }
          }
        }
      }
      currentNode = currentNode.parent;
    }
    return null; // 如果没找到父方法
  }

  protected extractCalleeName(methodInvocation: Parser.SyntaxNode): string | null {
    // 实现提取被调用方法名逻辑
    if (methodInvocation.children && methodInvocation.children.length > 0) {
      const methodNode = methodInvocation.children[0];
      if (methodNode.type === 'identifier') {
        return methodNode.text;
      } else if (methodNode.type === 'field_access') {
        // 处理 obj.method() 的情况
        return this.extractMethodNameFromFieldAccess(methodNode);
      }
    }
    return null;
  }

  protected extractMethodNameFromFieldAccess(fieldAccess: Parser.SyntaxNode): string | null {
    // 从字段访问表达式中提取方法名
    if (fieldAccess.children && fieldAccess.children.length > 0) {
      const lastChild = fieldAccess.children[fieldAccess.children.length - 1];
      if (lastChild.type === 'identifier') {
        return lastChild.text;
      }
    }
    return null;
  }

  protected analyzeCallContext(methodInvocation: Parser.SyntaxNode): {
    isChained: boolean;
    chainDepth?: number;
    isAsync: boolean;
  } {
    // 实现分析调用上下文的逻辑
    const isChained = methodInvocation.parent?.type === 'method_invocation' || methodInvocation.parent?.type === 'field_access';
    const isAsync = false; // Java doesn't have async/await like JavaScript

    return {
      isChained,
      isAsync,
      chainDepth: isChained ? this.calculateChainDepth(methodInvocation) : 0
    };
  }

  protected calculateChainDepth(node: Parser.SyntaxNode): number {
    let depth = 0;
    let current = node;
    while (current.parent && (current.parent.type === 'method_invocation' || current.parent.type === 'field_access')) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  protected determineCallType(methodInvocation: Parser.SyntaxNode, resolvedSymbol: Symbol | null): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' {
    // 实现确定调用类型逻辑
    if (methodInvocation.parent?.type === 'annotation') {
      return 'decorator';
    }

    // If we have resolved the symbol, check its type
    if (resolvedSymbol) {
      if (resolvedSymbol.type === 'method') {
        return 'method';
      } else if (resolvedSymbol.type === SymbolType.CLASS) {
        return 'constructor';
      }
    }

    // Check if it's a constructor call
    if (methodInvocation.parent?.type === 'class_creator' ||
      methodInvocation.parent?.type === 'object_creation_expression') {
      return 'constructor';
    }

    return 'method';
  }

  protected extractClassName(classDecl: Parser.SyntaxNode): string | null {
    // 实现提取类名逻辑
    for (const child of classDecl.children) {
      if (child.type === 'identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  protected findSuperClass(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    // 实现查找父类逻辑
    for (const child of node.children) {
      if (child.type === 'superclass') {
        return child;
      }
    }
    return null;
  }

  protected findImplementedInterfaces(node: Parser.SyntaxNode): Parser.SyntaxNode[] {
    // 实现查找实现的接口逻辑
    const interfaces: Parser.SyntaxNode[] = [];

    for (const child of node.children) {
      if (child.type === 'interfaces') {
        for (const interfaceChild of child.children) {
          if (interfaceChild.type === 'type_identifier') {
            interfaces.push(interfaceChild);
          }
        }
      }
    }
    return interfaces;
  }

  protected findExtendedInterfaces(node: Parser.SyntaxNode): Parser.SyntaxNode[] {
    // 实现查找扩展的接口逻辑
    const interfaces: Parser.SyntaxNode[] = [];

    for (const child of node.children) {
      if (child.type === 'extends_interfaces') {
        for (const interfaceChild of child.children) {
          if (interfaceChild.type === 'type_identifier') {
            interfaces.push(interfaceChild);
          }
        }
      }
    }
    return interfaces;
  }

  protected extractSuperClassName(superClass: Parser.SyntaxNode): string | null {
    // 实现提取父类名逻辑
    if (superClass.children && superClass.children.length > 0) {
      const typeNode = superClass.children[0];
      if (typeNode.type === 'type_identifier') {
        // We don't need fileContent for this operation since we're getting the text directly from the node
        return typeNode.text || null;
      }
    }
    return null;
  }

  protected extractInterfaceName(interfaceNode: Parser.SyntaxNode): string | null {
    // 实现提取接口名逻辑
    if (interfaceNode.type === 'type_identifier') {
      // We don't need fileContent for this operation since we're getting the text directly from the node
      return interfaceNode.text || null;
    }

    // For interface declarations
    for (const child of interfaceNode.children) {
      if (child.type === 'identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  protected extractImportInfo(importDecl: Parser.SyntaxNode): {
    source: string;
    importedSymbols: string[];
  } | null {
    // 实现提取导入信息逻辑
    let source = '';
    const importedSymbols: string[] = [];

    if (importDecl.type === 'import_declaration') {
      for (const child of importDecl.children) {
        if (child.type === 'scoped_identifier') {
          source = child.text;
          importedSymbols.push(source);
        } else if (child.type === 'identifier') {
          // Handle import with alias
          importedSymbols.push(child.text || '');
        }
      }
    } else if (importDecl.type === 'package_declaration') {
      for (const child of importDecl.children) {
        if (child.type === 'scoped_identifier') {
          source = child.text;
          break;
        }
      }
    }

    if (source || importedSymbols.length > 0) {
      return {
        source: source || 'local',
        importedSymbols
      };
    }
    return null;
  }

  protected extractPackageName(packageDecl: Parser.SyntaxNode): string | null {
    // 实现提取包名逻辑
    for (const child of packageDecl.children) {
      if (child.type === 'scoped_identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  protected determineReferenceType(identifier: Parser.SyntaxNode, resolvedSymbol: Symbol): 'variable' | 'constant' | 'parameter' | 'field' {
    // 实现确定引用类型逻辑
    // Check parent context to determine reference type
    if (identifier.parent?.type === 'formal_parameter') {
      return 'parameter';
    } else if (identifier.parent?.type === 'field_access') {
      return 'field';
    } else if (identifier.parent?.type === 'enum_constant') {
      return 'constant';
    }

    // Check if it's a constant (all uppercase with underscores)
    if (identifier.text && identifier.text === identifier.text.toUpperCase() && identifier.text.includes('_')) {
      return 'constant';
    }

    return 'variable';
  }

  protected extractFieldName(fieldAccess: Parser.SyntaxNode): string | null {
    // Extract name from field access expression like obj.field
    if (fieldAccess.children && fieldAccess.children.length > 0) {
      const lastChild = fieldAccess.children[fieldAccess.children.length - 1];
      if (lastChild.type === 'identifier') {
        return lastChild.text;
      }
    }
    return null;
  }

  protected extractMethodName(methodDecl: Parser.SyntaxNode): string | null {
    // 提取方法名
    for (const child of methodDecl.children) {
      if (child.type === 'identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  protected extractClassNameFromCreation(classCreation: Parser.SyntaxNode): string | null {
    // 实现从类创建表达式中提取类名逻辑
    for (const child of classCreation.children) {
      if (child.type === 'type_identifier') {
        return child.text;
      }
    }
    return null;
  }

  protected extractAnnotationName(annotation: Parser.SyntaxNode): string | null {
    // 实现提取注解名逻辑
    if (annotation.children && annotation.children.length > 0) {
      const annotationNode = annotation.children[0];
      if (annotationNode.type === 'identifier') {
        return annotationNode.text || null;
      } else if (annotationNode.type === 'marker_annotation' || annotationNode.type === 'annotation') {
        // Handle @Annotation or @package.Annotation
        for (const child of annotationNode.children) {
          if (child.type === 'identifier') {
            return child.text || null;
          } else if (child.type === 'scoped_identifier') {
            return child.text || null;
          }
        }
      }
    }
    return null;
  }

  protected extractAnnotationParameters(annotation: Parser.SyntaxNode): Record<string, any> {
    // 实现提取注解参数逻辑
    const parameters: Record<string, any> = {};

    for (const child of annotation.children) {
      if (child.type === 'annotation' || child.type === 'marker_annotation') {
        for (const annotationChild of child.children) {
          if (annotationChild.type === 'annotation_argument_list') {
            // Annotation with parameters like @Annotation(param1=value1, param2=value2)
            const args = this.extractAnnotationArguments(annotationChild);
            parameters.args = args;
            break;
          }
        }
      }
    }

    return parameters;
  }

  protected extractAnnotationArguments(annotationArgList: Parser.SyntaxNode): any[] {
    // 提取注解参数
    const args: any[] = [];

    for (const child of annotationArgList.children) {
      if (child.type === 'element_value_pair') {
        // Handle key=value pairs
        const key = this.extractAnnotationArgumentKey(child);
        const value = this.extractAnnotationArgumentValue(child);
        if (key && value) {
          args.push({ key, value });
        }
      } else if (child.type === 'element_value') {
        // Handle single values
        args.push({
          type: child.type,
          text: child.text
        });
      }
    }

    return args;
  }

  protected extractAnnotationArgumentKey(elementValuePair: Parser.SyntaxNode): string | null {
    // 提取注解参数键
    for (const child of elementValuePair.children) {
      if (child.type === 'identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  protected extractAnnotationArgumentValue(elementValuePair: Parser.SyntaxNode): string | null {
    // 提取注解参数值
    for (const child of elementValuePair.children) {
      if (child.type === 'element_value') {
        return child.text || null;
      }
    }
    return null;
  }

  // 新增：数据流关系提取
    async extractDataFlowRelationships(
      ast: Parser.SyntaxNode,
      filePath: string
    ): Promise<DataFlowRelationship[]> {
      const relationships: DataFlowRelationship[] = [];
      
      // 使用Tree-Sitter查询提取数据流关系
      const queryResult = this.treeSitterService.queryTree(ast, `
        ; 变量赋值数据流
        (assignment_expression
          left: (identifier) @source.variable
          right: (identifier) @target.variable) @data.flow.assignment
        
        ; 字段赋值数据流
        (assignment_expression
          left: (field_access
            object: (identifier) @source.object
            field: (identifier) @source.field)
          right: (identifier) @target.variable) @data.flow.field.assignment
        
        ; 方法调用参数传递数据流
        (method_invocation
          name: (identifier) @target.method
          arguments: (argument_list
            (identifier) @source.parameter)) @data.flow.parameter
        
        ; 对象方法调用参数传递数据流
        (method_invocation
          function: (field_access
            object: (identifier) @target.object
            field: (identifier) @target.method)
          arguments: (argument_list
            (identifier) @source.parameter)) @data.flow.method.parameter
        
        ; 返回值数据流
        (return_statement
          (identifier) @source.variable) @data.flow.return
        
        ; 字段返回数据流
        (return_statement
          (field_access
            object: (identifier) @source.object
            field: (identifier) @source.field)) @data.flow.field.return
        
        ; 构造函数调用数据流
        (object_creation_expression
          type: (type_identifier) @target.class
          arguments: (argument_list
            (identifier) @source.parameter)) @data.flow.constructor.parameter
        
        ; Lambda表达式赋值数据流
        (assignment_expression
          left: (identifier) @source.variable
          right: (lambda_expression) @target.lambda) @data.flow.lambda.assignment
        
        ; 泛型方法调用数据流
        (method_invocation
          name: (identifier) @target.method
          type_arguments: (type_arguments
            (type_identifier) @type.argument)
          arguments: (argument_list
            (identifier) @source.parameter)) @data.flow.generic.parameter
        
        ; 静态方法调用数据流
        (method_invocation
          function: (scoped_identifier
            scope: (identifier) @target.class
            name: (identifier) @target.method)
          arguments: (argument_list
            (identifier) @source.parameter)) @data.flow.static.parameter
        
        ; 数组访问数据流
        (array_access
          array: (identifier) @source.array
          index: (identifier) @source.index) @data.flow.array.access
        
        ; 类型转换数据流
        (cast_expression
          value: (identifier) @source.variable
          type: (type_identifier) @target.type) @data.flow.cast.flow
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
            } else if (captureName === 'target.variable' || captureName === 'target.method') {
              const targetName = node.text;
              const resolvedSymbol = symbolResolver.resolveSymbol(targetName, filePath, node);
              targetId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(targetName, 'variable', filePath);
            } else if (captureName === 'target.class') {
              const targetName = node.text;
              const resolvedSymbol = symbolResolver.resolveSymbol(targetName, filePath, node);
              targetId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(targetName, 'class', filePath);
            } else if (captureName === 'source.object' || captureName === 'source.field') {
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
            } else if (captureName.includes('field')) {
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
      
      ; Switch语句控制流
      (switch_expression
        value: (identifier) @condition) @control.flow.switch
      
      ; For循环控制流
      (for_statement
        condition: (parenthesized_expression) @condition) @control.flow.loop
      
      ; For-each循环控制流
      (enhanced_for_statement
        value: (expression) @condition) @control.flow.loop
      
      ; While循环控制流
      (while_statement
        condition: (parenthesized_expression) @condition) @control.flow.loop
      
      ; Do-while循环控制流
      (do_statement
        condition: (parenthesized_expression) @condition) @control.flow.loop
      
      ; Try-catch异常控制流
      (try_statement) @control.flow.exception
      
      ; Catch子句
      (catch_clause) @control.flow.exception
      
      ; Throw语句
      (throw_statement) @control.flow.exception
      
      ; Synchronized语句
      (synchronized_statement) @control.flow.synchronized
      
      ; Lambda表达式控制流
      (lambda_expression) @control.flow.lambda
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
          } else if (captureName.includes('lambda')) {
            flowType = 'callback';
          } else if (captureName.includes('async')) {
            flowType = 'async_await';
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
          } else if (captureName.includes('lambda')) {
            flowType = 'callback';
          } else if (captureName.includes('async')) {
            flowType = 'async_await';
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
      ; 方法重写关系（@Override注解）
      (method_declaration
        name: (identifier) @overridden.method
        (annotation
          name: (identifier) @override.annotation
          (#match? @override.annotation "Override$"))) @semantic.relationship.method.override
      
      ; 类继承关系
      (class_declaration
        name: (identifier) @subclass.class
        superclass: (superclass
          (type_identifier) @superclass.class)) @semantic.relationship.class.inheritance
      
      ; 接口实现关系
      (class_declaration
        name: (identifier) @implementing.class
        super_interfaces: (super_interfaces
          (type_list
            (type_identifier) @implemented.interface))) @semantic.relationship.interface.implementation
      
      ; 接口继承关系
      (interface_declaration
        name: (identifier) @subinterface.interface
        super_interfaces: (super_interfaces
          (type_list
            (type_identifier) @superinterface.interface))) @semantic.relationship.interface.inheritance
      
      ; 泛型类型参数关系
      (class_declaration
        name: (identifier) @generic.class
        type_parameters: (type_parameters
          (type_parameter
            name: (identifier) @type.parameter))) @semantic.relationship.generic.parameter
      
      ; 观察者模式（@Observer注解）
      (method_declaration
        name: (identifier) @observer.method
        (annotation
          name: (identifier) @observer.annotation
          (#match? @observer.annotation "Observer$"))) @semantic.relationship.observer.pattern
      
      ; 可观察对象（@Observable注解）
      (class_declaration
        name: (identifier) @observable.class
        (annotation
          name: (identifier) @observable.annotation
          (#match? @observable.annotation "Observable$"))) @semantic.relationship.observable.pattern
      
      ; 事件处理器模式
      (method_declaration
        name: (identifier) @event.handler
        (annotation
          name: (identifier) @event.annotation
          (#match? @event.annotation "^(EventHandler|Subscribe|Listen)$"))) @semantic.relationship.event.handler
      
      ; 依赖注入模式
      (method_declaration
        parameters: (formal_parameters
          (formal_parameter
            name: (identifier) @injected.parameter
            (annotation
              name: (identifier) @inject.annotation
              (#match? @inject.annotation "^(Inject|Autowired)$"))))) @semantic.relationship.dependency.injection
      
      ; 配置属性模式
      (field_declaration
        declarator: (variable_declarator
          name: (identifier) @config.property)
        (annotation
          name: (identifier) @config.annotation
          (#match? @config.annotation "^(Value|Property|Configuration)$"))) @semantic.relationship.configuration.property
      
      ; 组件扫描模式
      (class_declaration
        name: (identifier) @component.class
        (annotation
          name: (identifier) @component.annotation
          (#match? @component.annotation "^(Component|Service|Repository|Controller)$"))) @semantic.relationship.component.pattern
      
      ; 单例模式
      (class_declaration
        name: (identifier) @singleton.class
        (annotation
          name: (identifier) @singleton.annotation
          (#match? @singleton.annotation "Singleton$"))) @semantic.relationship.singleton.pattern
      
      ; 工厂方法模式
      (method_declaration
        name: (identifier) @factory.method
        (annotation
          name: (identifier) @factory.annotation
          (#match? @factory.annotation "^(Bean|Factory|Producer)$"))) @semantic.relationship.factory.method
      
      ; 建造者模式
      (class_declaration
        name: (identifier) @builder.class
        (annotation
          name: (identifier) @builder.annotation
          (#match? @builder.annotation "Builder$"))) @semantic.relationship.builder.pattern
      
      ; 策略模式
      (interface_declaration
        name: (identifier) @strategy.interface
        (annotation
          name: (identifier) @strategy.annotation
          (#match? @strategy.annotation "Strategy$"))) @semantic.relationship.strategy.interface
      
      ; 模板方法模式
      (class_declaration
        name: (identifier) @template.class
        (annotation
          name: (identifier) @template.annotation
          (#match? @template.annotation "Template$"))) @semantic.relationship.template.pattern
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
          
          if (captureName === 'overridden.method' || captureName === 'subclass.class' ||
              captureName === 'implementing.class' || captureName === 'subinterface.interface' ||
              captureName === 'generic.class' || captureName === 'observer.method' ||
              captureName === 'observable.class' || captureName === 'event.handler' ||
              captureName === 'component.class' || captureName === 'singleton.class' ||
              captureName === 'factory.method' || captureName === 'builder.class' ||
              captureName === 'strategy.interface' || captureName === 'template.class') {
            const name = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(name, filePath, node);
            sourceId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(name, 'semantic_source', filePath);
          } else if (captureName === 'superclass.class' || captureName === 'implemented.interface' ||
                     captureName === 'superinterface.interface' || captureName === 'type.parameter' ||
                     captureName === 'observer.annotation' || captureName === 'observable.annotation' ||
                     captureName === 'event.annotation' || captureName === 'inject.annotation' ||
                     captureName === 'config.annotation' || captureName === 'component.annotation' ||
                     captureName === 'singleton.annotation' || captureName === 'factory.annotation' ||
                     captureName === 'builder.annotation' || captureName === 'strategy.annotation' ||
                     captureName === 'template.annotation') {
            const name = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(name, filePath, node);
            targetId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(name, 'semantic_target', filePath);
          }
          
          // 确定语义关系类型和模式
          if (captureName.includes('override')) {
            semanticType = 'overrides';
            pattern = 'Override';
          } else if (captureName.includes('inheritance')) {
            semanticType = 'overloads';
            pattern = 'Inheritance';
          } else if (captureName.includes('implementation')) {
            semanticType = 'delegates';
            pattern = 'Implementation';
          } else if (captureName.includes('observer') || captureName.includes('observable')) {
            semanticType = 'observes';
            pattern = 'Observer';
          } else if (captureName.includes('configuration') || captureName.includes('property')) {
            semanticType = 'configures';
            pattern = 'Configuration';
          } else if (captureName.includes('component')) {
            pattern = 'Component';
          } else if (captureName.includes('singleton')) {
            pattern = 'Singleton';
          } else if (captureName.includes('factory')) {
            pattern = 'Factory';
          } else if (captureName.includes('builder')) {
            pattern = 'Builder';
          } else if (captureName.includes('strategy')) {
            pattern = 'Strategy';
          } else if (captureName.includes('template')) {
            pattern = 'Template';
          }
          
          // 收集元数据
          if (captureName.includes('annotation')) {
            metadata.annotation = node.text;
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
      (object_creation_expression
        type: (type_identifier) @instantiated.class
        arguments: (argument_list
          (identifier) @constructor.parameter)) @lifecycle.relationship.instantiation
      
      ; 构造函数定义
      (constructor_declaration
        name: (identifier) @constructor.method
        parameters: (formal_parameters
          (formal_parameter
            name: (identifier) @constructor.parameter))) @lifecycle.relationship.constructor.definition
      
      ; 初始化块
      (class_declaration
        name: (identifier) @initialized.class
        body: (class_body
          (instance_initializer
            (block) @init.block))) @lifecycle.relationship.initialization.block
      
      ; 静态初始化块
      (class_declaration
        name: (identifier) @static.initialized.class
        body: (class_body
          (static_initializer
            (block) @static.init.block))) @lifecycle.relationship.static.initialization
      
      ; 析构方法（finalize）
      (method_declaration
        name: (identifier) @destructor.method
        (#match? @destructor.method "finalize$")
        parameters: (formal_parameters)) @lifecycle.relationship.destructor.definition
      
      ; AutoCloseable接口实现
      (class_declaration
        name: (identifier) @closeable.class
        super_interfaces: (super_interfaces
          (type_list
            (type_identifier) @auto.closeable.interface
            (#match? @auto.closeable.interface "AutoCloseable$")))) @lifecycle.relationship.auto.closeable
      
      ; Close方法实现
      (method_declaration
        name: (identifier) @close.method
        (#match? @close.method "close$")
        parameters: (formal_parameters)) @lifecycle.relationship.close.method
      
      ; 生命周期注解方法
      (method_declaration
        name: (identifier) @lifecycle.method
        (annotation
          name: (identifier) @lifecycle.annotation
          (#match? @lifecycle.annotation "^(PostConstruct|PreDestroy|Initialized|Destroyed)$"))) @lifecycle.relationship.annotated.method
      
      ; Spring生命周期注解
      (method_declaration
        name: (identifier) @spring.lifecycle.method
        (annotation
          name: (identifier) @spring.annotation
          (#match? @spring.annotation "^(PostConstruct|PreDestroy|Bean|Component)$"))) @lifecycle.relationship.spring.lifecycle
      
      ; 事件监听器方法
      (method_declaration
        name: (identifier) @event.listener.method
        (annotation
          name: (identifier) @event.annotation
          (#match? @event.annotation "^(EventListener|Subscribe|Handle)$"))) @lifecycle.relationship.event.listener
      
      ; 资源获取方法
      (method_declaration
        name: (identifier) @acquire.method
        (#match? @acquire.method "^(acquire|open|start|connect|init)$")
        return_type: (type_identifier) @resource.type) @lifecycle.relationship.resource.acquisition
      
      ; 资源释放方法
      (method_declaration
        name: (identifier) @release.method
        (#match? @release.method "^(release|close|stop|disconnect|cleanup|destroy)$")) @lifecycle.relationship.resource.release
      
      ; 线程生命周期
      (method_declaration
        name: (identifier) @thread.lifecycle.method
        (#match? @thread.lifecycle.method "^(start|run|stop|interrupt|join)$")) @lifecycle.relationship.thread.lifecycle
      
      ; 事务生命周期
      (method_declaration
        name: (identifier) @transaction.method
        (annotation
          name: (identifier) @transaction.annotation
          (#match? @transaction.annotation "^(Transactional|Begin|Commit|Rollback)$"))) @lifecycle.relationship.transaction.lifecycle
      
      ; 缓存生命周期
      (method_declaration
        name: (identifier) @cache.method
        (annotation
          name: (identifier) @cache.annotation
          (#match? @cache.annotation "^(CacheEvict|CachePut|Cacheable)$"))) @lifecycle.relationship.cache.lifecycle
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
          
          if (captureName === 'instantiated.class' || captureName === 'constructor.method' ||
              captureName === 'initialized.class' || captureName === 'static.initialized.class' ||
              captureName === 'destructor.method' || captureName === 'closeable.class' ||
              captureName === 'lifecycle.method' || captureName === 'spring.lifecycle.method' ||
              captureName === 'event.listener.method' || captureName === 'acquire.method' ||
              captureName === 'thread.lifecycle.method' || captureName === 'transaction.method' ||
              captureName === 'cache.method') {
            const name = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(name, filePath, node);
            sourceId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(name, 'lifecycle_source', filePath);
          } else if (captureName === 'constructor.parameter' || captureName === 'init.block' ||
                     captureName === 'static.init.block' || captureName === 'auto.closeable.interface' ||
                     captureName === 'close.method' || captureName === 'lifecycle.annotation' ||
                     captureName === 'spring.annotation' || captureName === 'event.annotation' ||
                     captureName === 'resource.type' || captureName === 'release.method' ||
                     captureName === 'transaction.annotation' || captureName === 'cache.annotation') {
            const name = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(name, filePath, node);
            targetId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(name, 'lifecycle_target', filePath);
          }
          
          // 确定生命周期类型和阶段
          if (captureName.includes('instantiation') || captureName.includes('constructor')) {
            lifecycleType = 'instantiates';
            lifecyclePhase = 'creation';
          } else if (captureName.includes('initialization') || captureName.includes('init.block')) {
            lifecycleType = 'initializes';
            lifecyclePhase = 'setup';
          } else if (captureName.includes('destructor') || captureName.includes('destroy')) {
            lifecycleType = 'destroys';
            lifecyclePhase = 'teardown';
          } else if (captureName.includes('manage') || captureName.includes('lifecycle')) {
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
      ; Synchronized语句
      (synchronized_statement
        object: (parenthesized_expression
          (identifier) @lock.object)) @concurrency.relationship.synchronizes
      
      ; Synchronized方法
      (method_declaration
        (modifiers
          (synchronized)) @modifier.synchronized
        name: (identifier) @synchronized.method) @concurrency.relationship.synchronizes
      
      ; Volatile字段
      (field_declaration
        (modifiers
          (volatile)) @modifier.volatile
        declarator: (variable_declarator
          name: (identifier) @volatile.field)) @concurrency.relationship.synchronizes
      
      ; Thread创建
      (object_creation_expression
        type: (type_identifier) @thread.class
        (#match? @thread.class "Thread$")
        arguments: (argument_list)) @concurrency.relationship.thread.creation
      
      ; Runnable实现
      (class_declaration
        name: (identifier) @runnable.class
        super_interfaces: (super_interfaces
          (type_list
            (type_identifier) @runnable.interface
            (#match? @runnable.interface "Runnable$")))) @concurrency.relationship.runnable.implementation
      
      ; ExecutorService使用
      (method_invocation
        object: (identifier) @executor.object
        (#match? @executor.object "executor|service|pool")
        name: (identifier) @executor.method
        (#match? @executor.method "^(execute|submit|invokeAll|invokeAny)$")
        arguments: (argument_list)) @concurrency.relationship.executor.usage
      
      ; Lock接口使用
      (method_invocation
        object: (identifier) @lock.object
        (#match? @lock.object "lock|mutex|semaphore")
        name: (identifier) @lock.method
        (#match? @lock.method "^(lock|unlock|tryLock|acquire|release)$")
        arguments: (argument_list)) @concurrency.relationship.lock.usage
      
      ; Atomic变量使用
      (method_invocation
        object: (identifier) @atomic.object
        (#match? @atomic.object "atomic|counter")
        name: (identifier) @atomic.method
        (#match? @atomic.method "^(get|set|increment|decrement|compareAndSet|getAndSet)$")
        arguments: (argument_list)) @concurrency.relationship.atomic.usage
      
      ; CompletableFuture使用
      (method_invocation
        object: (identifier) @future.object
        (#match? @future.object "future|promise")
        name: (identifier) @future.method
        (#match? @future.method "^(thenApply|thenAccept|thenRun|exceptionally|handle|whenComplete)$")
        arguments: (argument_list)) @concurrency.relationship.future.usage
      
      ; 线程间通信
      (method_invocation
        object: (identifier) @thread.object
        name: (identifier) @thread.method
        (#match? @thread.method "^(wait|notify|notifyAll|sleep|join|interrupt)$")
        arguments: (argument_list)) @concurrency.relationship.thread.communication
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
          
          if (captureName === 'lock.object' || captureName === 'synchronized.method' ||
              captureName === 'volatile.field' || captureName === 'thread.class' ||
              captureName === 'runnable.class' || captureName === 'executor.object' ||
              captureName === 'lock.object' || captureName === 'atomic.object' ||
              captureName === 'future.object' || captureName === 'thread.object') {
            const name = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(name, filePath, node);
            sourceId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(name, 'concurrency_source', filePath);
          } else if (captureName === 'runnable.interface' || captureName === 'executor.method' ||
                     captureName === 'lock.method' || captureName === 'atomic.method' ||
                     captureName === 'future.method' || captureName === 'thread.method') {
            const name = node.text;
            const resolvedSymbol = symbolResolver.resolveSymbol(name, filePath, node);
            targetId = resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(name, 'concurrency_target', filePath);
          }
          
          // 确定并发关系类型和同步机制
          if (captureName.includes('synchronizes') || captureName.includes('synchronized')) {
            concurrencyType = 'synchronizes';
            synchronizationMechanism = 'synchronized';
          } else if (captureName.includes('lock')) {
            concurrencyType = 'locks';
            synchronizationMechanism = 'lock';
          } else if (captureName.includes('communicate') || captureName.includes('thread.method')) {
            concurrencyType = 'communicates';
            synchronizationMechanism = 'thread_communication';
          } else if (captureName.includes('race')) {
            concurrencyType = 'races';
            synchronizationMechanism = 'race_condition';
          } else if (captureName.includes('await') || captureName.includes('future')) {
            concurrencyType = 'awaits';
            synchronizationMechanism = 'future';
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