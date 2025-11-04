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
export class RustRelationshipExtractor implements ILanguageRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) protected treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) protected logger: LoggerService
  ) { }

  getSupportedLanguage(): string {
    return 'rust';
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

    // 查找所有调用表达式
    const callExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].callExpression
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

    // 查找闭包表达式 (lambdaExpression in Rust)
    const closureExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].lambdaExpression
    );

    for (const closureExpr of closureExpressions) {
      // 查找闭包内的函数调用
      const innerCalls = this.treeSitterService.findNodesByTypes(closureExpr,
        LANGUAGE_NODE_MAPPINGS['rust'].callExpression
      );

      for (const callExpr of innerCalls) {
        const callerSymbol = this.findCallerSymbol(closureExpr, symbolResolver, filePath);
        const calleeName = this.extractCalleeName(callExpr);

        if (callerSymbol && calleeName) {
          const resolvedSymbol = symbolResolver.resolveSymbol(calleeName, filePath, callExpr);
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
    }

    return relationships;
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

  async extractDependencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DependencyRelationship[]> {
    const relationships: DependencyRelationship[] = [];

    // 查找 use 声明 (importDeclaration in Rust)
    const useDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].importDeclaration
    );

    for (const useStmt of useDeclarations) {
      const importInfo = this.extractUseInfo(useStmt);

      if (importInfo) {
        // 使用符号解析器解析导入的模块
        const resolvedTargetSymbol = symbolResolver.resolveSymbol(importInfo.source, filePath, useStmt);

        relationships.push({
          sourceId: this.generateNodeId(filePath, 'file', filePath),
          targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(importInfo.source, 'module', importInfo.source),
          dependencyType: 'import',
          target: importInfo.source,
          importedSymbols: importInfo.importedSymbols,
          location: {
            filePath,
            lineNumber: useStmt.startPosition.row + 1
          },
          resolvedTargetSymbol: resolvedTargetSymbol || undefined
        });
      }
    }

    // Rust 没有显式的导出声明，但有 pub 关键字
    // 这里可以处理外部 crate 的依赖
    const externCrateDeclarations = this.treeSitterService.findNodeByType(ast, 'extern_crate_declaration');

    for (const externCrate of externCrateDeclarations) {
      const crateName = this.extractCrateName(externCrate, filePath);
      if (crateName) {
        const resolvedTargetSymbol = symbolResolver.resolveSymbol(crateName, filePath, externCrate);

        relationships.push({
          sourceId: this.generateNodeId(filePath, 'file', filePath),
          targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(crateName, 'module', filePath),
          dependencyType: 'import',
          target: crateName,
          importedSymbols: [],
          location: {
            filePath,
            lineNumber: externCrate.startPosition.row + 1
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
      LANGUAGE_NODE_MAPPINGS['rust'].propertyIdentifier
    );

    for (const identifier of identifiers) {
      const identifierName = identifier.text || null;

      if (identifierName) {
        // 使用符号解析器解析引用的符号
        const resolvedSymbol = symbolResolver.resolveSymbol(identifierName, filePath, identifier);

        if (resolvedSymbol) {
          // 确定引用类型
          const referenceType = this.determineReferenceType(identifier, resolvedSymbol);

          relationships.push({
            sourceId: this.generateNodeId(identifierName, 'reference', filePath),
            targetId: this.generateSymbolId(resolvedSymbol),
            referenceType: referenceType as 'variable' | 'constant' | 'parameter' | 'field' | 'function' | 'method' | 'type' | 'enum' | 'class' | 'interface' | 'namespace',
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
    }

    // 查找成员表达式引用 (field_expression in Rust)
    const fieldExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].memberExpression
    );

    for (const fieldExpr of fieldExpressions) {
      const fieldName = this.extractFieldNameFromFieldExpression(fieldExpr);

      if (fieldName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(fieldName, filePath, fieldExpr);

        if (resolvedSymbol) {
          // 确定引用类型
          const referenceType = this.determineReferenceType(fieldExpr, resolvedSymbol);

          relationships.push({
            sourceId: this.generateNodeId(fieldName, 'reference', filePath),
            targetId: this.generateSymbolId(resolvedSymbol),
            referenceType: referenceType as 'variable' | 'constant' | 'parameter' | 'field' | 'function' | 'method' | 'type' | 'enum' | 'class' | 'interface' | 'namespace',
            referenceName: fieldName,
            location: {
              filePath,
              lineNumber: fieldExpr.startPosition.row + 1,
              columnNumber: fieldExpr.startPosition.column + 1
            },
            resolvedSymbol
          });
        }
      }
    }

    // 查找函数声明和方法声明的引用
    const functionDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].functionDeclaration
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
      LANGUAGE_NODE_MAPPINGS['rust'].methodDeclaration
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

    // 查找类型引用
    const typeAnnotations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].typeAnnotation
    );

    for (const typeAnnotation of typeAnnotations) {
      const typeIdentifier = typeAnnotation;
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

    // 查找泛型类型引用
    const genericTypes = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].genericTypes
    );

    for (const genericType of genericTypes) {
      const typeIdentifier = this.treeSitterService.findNodeByType(genericType, 'type_identifier')[0];
      if (typeIdentifier) {
        const typeName = typeIdentifier.text;
        const resolvedSymbol = symbolResolver.resolveSymbol(typeName, filePath, typeIdentifier);

        if (resolvedSymbol) {
          relationships.push({
            sourceId: this.generateNodeId(typeName, 'generic_type', filePath),
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

    // 查找结构体实例化（类似类创建）
    const structLiterals = this.treeSitterService.findNodeByType(ast, 'struct_expression');

    for (const structLiteral of structLiterals) {
      const structName = this.extractStructNameFromLiteral(structLiteral);
      if (structName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(structName, filePath, structLiteral);

        relationships.push({
          sourceId: this.generateNodeId(`struct_creation_${structLiteral.startPosition.row}`, 'creation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(structName, 'struct', filePath),
          creationType: 'instantiation',
          targetName: structName,
          location: {
            filePath,
            lineNumber: structLiteral.startPosition.row + 1,
            columnNumber: structLiteral.startPosition.column + 1
          },
          resolvedTargetSymbol: resolvedSymbol || undefined
        });
      }
    }

    // 查找数组字面量创建
    const arrayLiterals = this.treeSitterService.findNodeByType(ast, 'array_expression');
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

    // 查找闭包表达式创建
    const closureExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].lambdaExpression
    );

    for (const closureExpr of closureExpressions) {
      relationships.push({
        sourceId: this.generateNodeId(`closure_creation_${closureExpr.startPosition.row}`, 'creation', filePath),
        targetId: this.generateNodeId('Function', 'builtin', filePath),
        creationType: 'instantiation',
        targetName: 'Function',
        location: {
          filePath,
          lineNumber: closureExpr.startPosition.row + 1,
          columnNumber: closureExpr.startPosition.column + 1
        },
        resolvedTargetSymbol: undefined
      });
    }

    // 查找变量声明创建（let 声明）
    const variableDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].variableDeclaration
    );

    for (const varDecl of variableDeclarations) {
      const varName = this.extractVariableName(varDecl);
      if (varName) {
        // 创建变量引用关系
        relationships.push({
          sourceId: this.generateNodeId(`var_creation_${varDecl.startPosition.row}`, 'creation', filePath),
          targetId: this.generateNodeId(varName, 'variable', filePath),
          creationType: 'instantiation',
          targetName: varName,
          location: {
            filePath,
            lineNumber: varDecl.startPosition.row + 1,
            columnNumber: varDecl.startPosition.column + 1
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

    // 查找 Rust 属性 (decorator in Rust) 
    const attributes = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].decorator
    );

    for (const attribute of attributes) {
      const attributeName = this.extractAttributeName(attribute);
      const parameters = this.extractAttributeParameters(attribute);

      if (attributeName) {
        // 使用符号解析器解析属性符号
        const resolvedSymbol = symbolResolver.resolveSymbol(attributeName, filePath, attribute);

        relationships.push({
          sourceId: this.generateNodeId(`attribute_${attribute.startPosition.row}`, 'annotation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(attributeName, 'attribute', filePath),
          annotationType: 'attribute',
          annotationName: attributeName,
          parameters,
          location: {
            filePath,
            lineNumber: attribute.startPosition.row + 1,
            columnNumber: attribute.startPosition.column + 1
          },
          resolvedAnnotationSymbol: resolvedSymbol || undefined
        });
      }
    }

    // 查找类型注解
    const typeAnnotations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['rust'].typeAnnotation
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
      LANGUAGE_NODE_MAPPINGS['rust'].genericTypes
    );

    for (const genericType of genericTypes) {
      const typeName = this.extractGenericTypeName(genericType);
      const typeParameters = this.extractTypeParameters(genericType);

      if (typeName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(typeName, filePath, genericType);

        relationships.push({
          sourceId: this.generateNodeId(`generic_${genericType.startPosition.row}`, 'annotation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(typeName, 'type', filePath),
          annotationType: 'annotation',
          annotationName: typeName,
          parameters: { typeParameters },
          location: {
            filePath,
            lineNumber: genericType.startPosition.row + 1,
            columnNumber: genericType.startPosition.column + 1
          },
          resolvedAnnotationSymbol: resolvedSymbol || undefined
        });

        // Also add relationships for type parameters
        for (const typeParam of typeParameters) {
          const paramResolvedSymbol = symbolResolver.resolveSymbol(typeParam, filePath, genericType);
          if (paramResolvedSymbol) {
            relationships.push({
              sourceId: this.generateNodeId(`generic_param_${genericType.startPosition.row}`, 'annotation', filePath),
              targetId: this.generateSymbolId(paramResolvedSymbol),
              annotationType: 'annotation',
              annotationName: typeParam,
              parameters: { genericType: typeName },
              location: {
                filePath,
                lineNumber: genericType.startPosition.row + 1,
                columnNumber: genericType.startPosition.column + 1
              },
              resolvedAnnotationSymbol: paramResolvedSymbol
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
      if (currentNode.type === 'function_item' ||
        currentNode.type === 'function_signature_item' ||
        currentNode.type === 'async_function' ||
        currentNode.type === 'closure_expression') {
        // 查找函数名
        for (const child of currentNode.children) {
          if (child.type === 'identifier' || child.type === 'function_name') {
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
      if (funcNode.type === 'identifier' || funcNode.type === 'field_identifier') {
        return funcNode.text || null;
      } else if (funcNode.type === 'field_expression') {
        // 处理 obj.method() 的情况
        return this.extractMethodNameFromFieldExpression(funcNode);
      } else if (funcNode.type === 'call_expression') {
        // 处理嵌套调用
        return this.extractCalleeName(funcNode);
      }
    }
    return null;
  }

  protected extractMethodNameFromFieldExpression(fieldExpr: Parser.SyntaxNode): string | null {
    // 从字段表达式中提取方法名
    if (fieldExpr.children && fieldExpr.children.length > 0) {
      const lastChild = fieldExpr.children[fieldExpr.children.length - 1];
      if (lastChild.type === 'field_identifier' || lastChild.type === 'identifier') {
        return lastChild.text || null;
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
    const isChained = callExpr.parent?.type === 'call_expression' || callExpr.parent?.type === 'field_expression';
    const isAsync = callExpr.text.includes('async') || callExpr.text.includes('await');
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
    while (current.parent && (current.parent.type === 'call_expression' || current.parent.type === 'field_expression')) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  protected determineCallType(callExpr: Parser.SyntaxNode, resolvedSymbol: Symbol | null): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' {
    // 实现确定调用类型逻辑
    if (callExpr.parent?.type === 'attribute_item') {
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

  protected extractStructName(structDecl: Parser.SyntaxNode): string | null {
    // 实现提取结构体名逻辑
    for (const child of structDecl.children) {
      if (child.type === 'type_identifier' || child.type === 'identifier') {
        return child.text;
      }
    }
    return null;
  }

  protected extractStructNameFromLiteral(structLiteral: Parser.SyntaxNode): string | null {
    // 从结构体字面量中提取结构体名
    if (structLiteral.children && structLiteral.children.length > 0) {
      const firstChild = structLiteral.children[0];
      if (firstChild.type === 'type_identifier' || firstChild.type === 'identifier') {
        return firstChild.text || null;
      }
    }
    return null;
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

  protected extractFieldName(fieldNode: Parser.SyntaxNode): string | null {
    // 提取字段名
    for (const child of fieldNode.children) {
      if (child.type === 'field_identifier' || child.type === 'identifier') {
        return child.text;
      }
    }
    return null;
  }

  protected extractFieldNameFromFieldExpression(fieldExpr: Parser.SyntaxNode): string | null {
    // 从字段表达式中提取字段名
    if (fieldExpr.children && fieldExpr.children.length > 0) {
      const lastChild = fieldExpr.children[fieldExpr.children.length - 1];
      if (lastChild.type === 'field_identifier' || lastChild.type === 'identifier') {
        return lastChild.text || null;
      }
    }
    return null;
  }

  protected extractUseInfo(useStmt: Parser.SyntaxNode): {
    source: string;
    importedSymbols: string[];
  } | null {
    // 实现提取 use 信息逻辑
    let source = '';
    const importedSymbols: string[] = [];

    for (const child of useStmt.children) {
      // Find the source (usually a path or identifier)
      if (child.type === 'identifier' || child.type === 'scoped_identifier' || child.type === 'path') {
        source = child.text || '';
      }
      // Find the use path or specific imports
      else if (child.type === 'use_path' || child.type === 'use_as_clause' ||
        child.type === 'use_list' || child.type === 'use_grouping') {
        importedSymbols.push(...this.extractUseSpecifiers(child));
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

  protected extractUseSpecifiers(node: Parser.SyntaxNode): string[] {
    // 提取 use 符号
    const specifiers: string[] = [];

    if (node.type === 'use_list' || node.type === 'use_grouping') {
      for (const child of node.children) {
        if (child.type === 'identifier' || child.type === 'use_as_clause' || child.type === 'use_path') {
          if (child.type === 'identifier') {
            specifiers.push(child.text || '');
          } else {
            specifiers.push(...this.extractUseSpecifiers(child));
          }
        }
      }
    } else if (node.type === 'use_as_clause') {
      // Handle "use module as alias" 
      for (const child of node.children) {
        if (child.type === 'identifier') {
          specifiers.push(child.text || '');
          break;
        }
      }
    } else if (node.type === 'use_path') {
      // For complex paths like module::submodule::item
      for (const child of node.children) {
        if (child.type === 'identifier') {
          specifiers.push(child.text || '');
        }
      }
    }

    return specifiers;
  }

  protected extractCrateName(externCrate: Parser.SyntaxNode, filePath: string): string | null {
    // 提取 extern crate 名
    for (const child of externCrate.children) {
      if (child.type === 'identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  protected determineReferenceType(identifier: Parser.SyntaxNode, resolvedSymbol: Symbol): 'variable' | 'constant' | 'parameter' | 'field' | 'function' | 'method' | 'type' | 'enum' | 'class' | 'interface' | 'namespace' {
    // 实现确定引用类型逻辑
    // Check parent context to determine reference type
    if (identifier.parent?.type === 'parameter' || identifier.parent?.type === 'parameter_list') {
      return 'parameter';
    } else if (identifier.parent?.type === 'field_identifier' &&
      identifier.parent.parent?.type === 'field_expression') {
      return 'field';
    }

    // If we have a resolved symbol, use its type
    // Map Rust-specific types to the supported types in the interface
    if (resolvedSymbol.type === SymbolType.TYPE || resolvedSymbol.type === SymbolType.CLASS) {
      return 'type';
    } else if (resolvedSymbol.type === SymbolType.ENUM) {
      return 'enum';
    } else if (resolvedSymbol.type === SymbolType.FUNCTION) {
      return 'function';
    } else if (resolvedSymbol.type === SymbolType.METHOD) {
      return 'method';
    } else if (resolvedSymbol.type === SymbolType.INTERFACE) {
      return 'interface';
    } else if (resolvedSymbol.type === SymbolType.VARIABLE) {
      return 'variable';
    } else if (resolvedSymbol.type === SymbolType.PARAMETER) {
      return 'parameter';
    }

    return 'variable';
  }

  protected extractAttributeName(attribute: Parser.SyntaxNode): string | null {
    // 实现提取属性名逻辑
    if (attribute.children && attribute.children.length > 0) {
      const attrNode = attribute.children[0];
      if (attrNode.type === 'identifier') {
        return attrNode.text || null;
      } else if (attrNode.type === 'attribute_shorthand' || attrNode.type === 'attribute') {
        // For complex attributes
        return attrNode.text?.replace(/#|\[|\]/g, '') || null;
      }
    }
    return null;
  }

  protected extractAttributeParameters(attribute: Parser.SyntaxNode): Record<string, any> {
    // 实现提取属性参数逻辑
    const parameters: Record<string, any> = {};

    for (const child of attribute.children) {
      if (child.type === 'token_tree') {
        // Attribute with parameters like #[attribute(param1, param2)]
        const args = this.extractAttributeArguments(child);
        parameters.args = args;
        break;
      } else if (child.type === 'attribute_shorthand') {
        parameters.isShorthand = true;
      }
    }

    return parameters;
  }

  protected extractAttributeArguments(tokenTree: Parser.SyntaxNode): any[] {
    // 提取属性参数
    const args: any[] = [];

    for (const child of tokenTree.children) {
      args.push({
        type: child.type,
        text: child.text
      });
    }

    return args;
  }

  protected extractTypeName(typeNode: Parser.SyntaxNode): string | null {
    // 从类型注解节点提取类型名
    return typeNode.text || null;
  }

  protected extractFunctionName(funcDecl: Parser.SyntaxNode): string | null {
    // 提取函数名
    for (const child of funcDecl.children) {
      if (child.type === 'identifier' || child.type === 'function_name') {
        return child.text || null;
      }
    }
    return null;
  }

  protected extractMethodName(methodDecl: Parser.SyntaxNode): string | null {
    // 提取方法名
    for (const child of methodDecl.children) {
      if (child.type === 'identifier' || child.type === 'function_name') {
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

  protected extractTypeParameters(genericType: Parser.SyntaxNode): string[] {
    // 提取泛型参数
    const args: string[] = [];

    for (const child of genericType.children) {
      if (child.type === 'type_arguments' || child.type === 'type_parameters') {
        for (const arg of child.children) {
          if (arg.type === 'type_identifier' || arg.type === 'identifier' || arg.type === 'lifetime') {
            args.push(arg.text || '');
          }
        }
        break;
      }
    }

    return args;
  }

  protected extractVariableName(varDecl: Parser.SyntaxNode): string | null {
    // 提取变量名
    for (const child of varDecl.children) {
      if (child.type === 'pattern') {
        for (const patternChild of child.children) {
          if (patternChild.type === 'identifier') {
            return patternChild.text || null;
          }
        }
      } else if (child.type === 'identifier') {
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