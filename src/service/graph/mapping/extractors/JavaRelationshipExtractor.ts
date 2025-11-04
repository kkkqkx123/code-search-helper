import {
  ILanguageRelationshipExtractor,
  CallRelationship,
  InheritanceRelationship,
  DependencyRelationship,
  ReferenceRelationship,
  CreationRelationship,
  AnnotationRelationship
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
      'reference', 'creation', 'annotation'
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

  protected generateSymbolId(symbol: Symbol): string {
    return `${symbol.type}_${Buffer.from(`${symbol.filePath}_${symbol.name}`).toString('hex')}`;
  }

  protected generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }
}