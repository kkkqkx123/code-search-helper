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
export class CRelationshipExtractor implements ILanguageRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) protected treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) protected logger: LoggerService
  ) { }

  getSupportedLanguage(): string {
    return 'c';
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
      LANGUAGE_NODE_MAPPINGS['c'].callExpression
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

  async extractDependencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DependencyRelationship[]> {
    const relationships: DependencyRelationship[] = [];

    // 查找预处理器包含指令
    const includeStatements = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].importDeclaration
    );

    for (const includeStmt of includeStatements) {
      const includeInfo = this.extractIncludeInfo(includeStmt);

      if (includeInfo) {
        // 使用符号解析器解析包含的头文件
        const resolvedTargetSymbol = symbolResolver.resolveSymbol(includeInfo.source, filePath, includeStmt);

        relationships.push({
          sourceId: this.generateNodeId(filePath, 'file', filePath),
          targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(includeInfo.source, 'header', includeInfo.source),
          dependencyType: 'include',
          target: includeInfo.source,
          importedSymbols: includeInfo.importedSymbols,
          location: {
            filePath,
            lineNumber: includeStmt.startPosition.row + 1
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

    // 查找所有标识符引用和字段标识符
    const identifiers = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].propertyIdentifier
    );

    for (const identifier of identifiers) {
      const identifierName = identifier.text;

      // 使用符号解析器解析引用的符号
      const resolvedSymbol = symbolResolver.resolveSymbol(identifierName, filePath, identifier);

      if (resolvedSymbol) {
        // 确定引用类型
        const referenceType = this.determineReferenceType(identifier, resolvedSymbol) as 'variable' | 'constant' | 'parameter' | 'field' | 'type' | 'enum';

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

    // 查找字段表达式引用
    const fieldExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].memberExpression
    );

    for (const fieldExpr of fieldExpressions) {
      const fieldName = this.extractFieldNameFromFieldExpression(fieldExpr);

      if (fieldName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(fieldName, filePath, fieldExpr);

        if (resolvedSymbol) {
          // 确定引用类型
          const referenceType = this.determineReferenceType(fieldExpr, resolvedSymbol) as 'variable' | 'constant' | 'parameter' | 'field';

          relationships.push({
            sourceId: this.generateNodeId(fieldName, 'reference', filePath),
            targetId: this.generateSymbolId(resolvedSymbol),
            referenceType,
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

    // 查找函数声明的引用
    const functionDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].functionDeclaration
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

    // 查找变量声明的引用
    const variableDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].variableDeclaration
    );

    for (const varDecl of variableDeclarations) {
      const varName = this.extractVariableName(varDecl);
      if (varName) {
        const resolvedSymbol = symbolResolver.resolveSymbol(varName, filePath, varDecl);

        if (resolvedSymbol) {
          relationships.push({
            sourceId: this.generateNodeId(varName, 'variable_ref', filePath),
            targetId: this.generateSymbolId(resolvedSymbol),
            referenceType: 'variable',
            referenceName: varName,
            location: {
              filePath,
              lineNumber: varDecl.startPosition.row + 1,
              columnNumber: varDecl.startPosition.column + 1
            },
            resolvedSymbol
          });
        }
      }
    }

    // 查找类型引用
    const typeIdentifiers = this.treeSitterService.findNodeByType(ast, 'type_identifier');
    for (const typeIdentifier of typeIdentifiers) {
      const typeName = typeIdentifier.text;

      // 使用符号解析器解析类型符号
      const resolvedSymbol = symbolResolver.resolveSymbol(typeName, filePath, typeIdentifier);

      if (resolvedSymbol) {
        relationships.push({
          sourceId: this.generateNodeId(typeName, 'typeref', filePath),
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

    // 查找原生类型引用
    const primitiveTypes = this.treeSitterService.findNodeByType(ast, 'primitive_type');
    for (const primitiveType of primitiveTypes) {
      const typeName = primitiveType.text;

      // 使用符号解析器解析类型符号
      const resolvedSymbol = symbolResolver.resolveSymbol(typeName, filePath, primitiveType);

      if (resolvedSymbol) {
        relationships.push({
          sourceId: this.generateNodeId(typeName, 'primitive_typeref', filePath),
          targetId: this.generateSymbolId(resolvedSymbol),
          referenceType: 'type',
          referenceName: typeName,
          location: {
            filePath,
            lineNumber: primitiveType.startPosition.row + 1,
            columnNumber: primitiveType.startPosition.column + 1
          },
          resolvedSymbol
        });
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

    // 在C语言中，主要的创建关系是结构体实例化和变量声明
    const variableDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].variableDeclaration
    );

    for (const varDecl of variableDeclarations) {
      // 查找结构体变量声明
      const structInstances = this.findStructInstances(varDecl, filePath, symbolResolver);
      for (const instance of structInstances) {
        relationships.push({
          sourceId: this.generateNodeId(`struct_creation_${varDecl.startPosition.row}`, 'creation', filePath),
          targetId: instance.structId,
          creationType: 'instantiation',
          targetName: instance.structName,
          location: {
            filePath,
            lineNumber: varDecl.startPosition.row + 1,
            columnNumber: varDecl.startPosition.column + 1
          },
          resolvedTargetSymbol: instance.resolvedSymbol
        });
      }

      // 查找枚举变量声明
      const enumInstances = this.findEnumInstances(varDecl, filePath, symbolResolver);
      for (const instance of enumInstances) {
        relationships.push({
          sourceId: this.generateNodeId(`enum_creation_${varDecl.startPosition.row}`, 'creation', filePath),
          targetId: instance.enumId,
          creationType: 'instantiation',
          targetName: instance.enumName,
          location: {
            filePath,
            lineNumber: varDecl.startPosition.row + 1,
            columnNumber: varDecl.startPosition.column + 1
          },
          resolvedTargetSymbol: instance.resolvedSymbol
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

    // 查找属性说明符（C11 attributes）
    const attributes = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].decorator
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

    // 查找类型注解（如类型别名等）
    const typeAnnotations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['c'].typeAnnotation
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

    return relationships;
  }

  // 辅助方法实现
  protected findCallerSymbol(callExpr: Parser.SyntaxNode, symbolResolver: SymbolResolver, filePath: string): Symbol | null {
    // 实现查找调用者符号的逻辑
    // 需要向上遍历AST找到包含当前调用的函数
    let currentNode: Parser.SyntaxNode | null = callExpr.parent;
    while (currentNode) {
      if (currentNode.type === 'function_definition') {
        // 查找函数名
        for (const child of currentNode.children) {
          if (child.type === 'function_declarator') {
            const innerChild = child.children.find(c => c.type === 'identifier');
            if (innerChild) {
              const funcName = innerChild.text;
              if (funcName) {
                return symbolResolver.resolveSymbol(funcName, filePath, innerChild);
              }
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
      } else if (funcNode.type === 'field_expression') {
        // 处理 obj.method() 的情况
        return this.extractFieldNameFromFieldExpression(funcNode);
      }
    }
    return null;
  }

  protected extractFieldNameFromFieldExpression(fieldExpr: Parser.SyntaxNode): string | null {
    // 从字段表达式中提取字段名
    if (fieldExpr.children && fieldExpr.children.length > 0) {
      const lastChild = fieldExpr.children[fieldExpr.children.length - 1];
      if (lastChild.type === 'field_identifier' || lastChild.type === 'identifier') {
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
    const isChained = callExpr.parent?.type === 'call_expression' || callExpr.parent?.type === 'field_expression';
    
    return {
      isChained,
      isAsync: false, // C语言没有异步调用
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
    // C语言中的调用主要是函数调用
    return 'function';
  }

  protected extractStructName(structDecl: Parser.SyntaxNode): string | null {
    // 实现提取结构体名逻辑
    for (const child of structDecl.children) {
      if (child.type === 'type_identifier' || child.type === 'identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  protected findEmbeddedStructs(structDecl: Parser.SyntaxNode): Parser.SyntaxNode[] {
    // 在C中，结构体嵌入是通过字段声明包含其他结构体来实现的
    const embeddedStructs: Parser.SyntaxNode[] = [];
    
    // 查找结构体体内的字段声明
    for (const child of structDecl.children) {
      if (child.type === 'field_declaration') {
        // 在字段声明中查找类型标识符
        const typeIdentifiers = this.treeSitterService.findNodeByType(child, 'type_identifier');
        for (const typeIdent of typeIdentifiers) {
          // 检查这个类型是否是一个已定义的结构体
          embeddedStructs.push(typeIdent);
        }
      }
    }
    
    return embeddedStructs;
  }

  protected extractEnumName(enumDecl: Parser.SyntaxNode): string | null {
    // 提取枚举名
    for (const child of enumDecl.children) {
      if (child.type === 'type_identifier' || child.type === 'identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  protected findEnumMembers(enumDecl: Parser.SyntaxNode): string[] {
    // 查找枚举成员
    const members: string[] = [];

    for (const child of enumDecl.children) {
      if (child.type === 'enumerator_list') {
        for (const listChild of child.children) {
          if (listChild.type === 'enumerator') {
            for (const enumChild of listChild.children) {
              if (enumChild.type === 'identifier') {
                members.push(enumChild.text || '');
              }
            }
          }
        }
      }
    }

    return members;
  }

  protected extractIncludeInfo(includeStmt: Parser.SyntaxNode): {
    source: string;
    importedSymbols: string[];
  } | null {
    // 实现提取包含信息逻辑
    let source = '';
    const importedSymbols: string[] = [];

    for (const child of includeStmt.children) {
      // Find the source (usually a string literal)
      if (child.type === 'string_literal' || child.type === 'system_lib_string') {
        source = child.text.replace(/['"<>/]/g, ''); // Remove quotes and angle brackets
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

  protected determineReferenceType(identifier: Parser.SyntaxNode, resolvedSymbol: Symbol): 'variable' | 'constant' | 'parameter' | 'field' | 'type' | 'enum' {
    // 实现确定引用类型逻辑
    if (resolvedSymbol.type === 'type' || resolvedSymbol.type === 'struct') {
      return 'type';
    } else if (resolvedSymbol.type === 'enum') {
      return 'enum';
    } else if (identifier.parent?.type === 'parameter_declaration') {
      return 'parameter';
    } else if (identifier.parent?.type === 'field_identifier' ||
      identifier.parent?.parent?.type === 'field_expression') {
      return 'field';
    }

    return 'variable';
  }

  protected extractFunctionName(funcDecl: Parser.SyntaxNode): string | null {
    // 提取函数名
    if (funcDecl.type === 'function_definition') {
      for (const child of funcDecl.children) {
        if (child.type === 'function_declarator') {
          // 在函数声明符中查找标识符
          for (const grandchild of child.children) {
            if (grandchild.type === 'identifier') {
              return grandchild.text || null;
            } else if (grandchild.type === 'field_identifier') {
              return grandchild.text || null;
            }
          }
        }
      }
    } else if (funcDecl.type === 'function_declarator') {
      // 直接处理函数声明符
      for (const child of funcDecl.children) {
        if (child.type === 'identifier') {
          return child.text || null;
        }
      }
    }
    return null;
  }

  protected extractVariableName(varDecl: Parser.SyntaxNode): string | null {
    // 提取变量名
    for (const child of varDecl.children) {
      if (child.type === 'init_declarator') {
        for (const grandChild of child.children) {
          if (grandChild.type === 'identifier') {
            return grandChild.text || null;
          }
        }
      } else if (child.type === 'identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  protected findStructInstances(varDecl: Parser.SyntaxNode, filePath: string, symbolResolver: SymbolResolver): Array<{
    structName: string;
    structId: string;
    resolvedSymbol: Symbol | undefined;
  }> {
    // 查找结构体实例
    const instances: Array<{
      structName: string;
      structId: string;
      resolvedSymbol: Symbol | undefined;
    }> = [];

    // 检查变量声明中的类型是否是结构体
    const typeIdentifiers = this.treeSitterService.findNodeByType(varDecl, 'type_identifier');
    for (const typeIdent of typeIdentifiers) {
      // 检查类型是否是已定义的结构体
      const resolvedSymbol = symbolResolver.resolveSymbol(typeIdent.text, filePath, typeIdent);
      if (resolvedSymbol && resolvedSymbol.type === 'struct') {
        instances.push({
          structName: typeIdent.text,
          structId: this.generateSymbolId(resolvedSymbol),
          resolvedSymbol
        });
      }
    }

    return instances;
  }

  protected findEnumInstances(varDecl: Parser.SyntaxNode, filePath: string, symbolResolver: SymbolResolver): Array<{
    enumName: string;
    enumId: string;
    resolvedSymbol: Symbol | undefined;
  }> {
    // 查找枚举实例
    const instances: Array<{
      enumName: string;
      enumId: string;
      resolvedSymbol: Symbol | undefined;
    }> = [];

    // 检查变量声明中的类型是否是枚举
    const typeIdentifiers = this.treeSitterService.findNodeByType(varDecl, 'type_identifier');
    for (const typeIdent of typeIdentifiers) {
      // 检查类型是否是已定义的枚举
      const resolvedSymbol = symbolResolver.resolveSymbol(typeIdent.text, filePath, typeIdent);
      if (resolvedSymbol && resolvedSymbol.type === 'enum') {
        instances.push({
          enumName: typeIdent.text,
          enumId: this.generateSymbolId(resolvedSymbol),
          resolvedSymbol
        });
      }
    }

    return instances;
  }

  protected extractAttributeName(attribute: Parser.SyntaxNode): string | null {
    // 实现提取属性名逻辑
    if (attribute.children && attribute.children.length > 0) {
      for (const child of attribute.children) {
        if (child.type === 'identifier') {
          return child.text || null;
        } else if (child.type === 'attribute_declaration') {
          // 在属性声明中查找属性名
          for (const attrChild of child.children) {
            if (attrChild.type === 'identifier') {
              return attrChild.text || null;
            }
          }
        }
      }
    }
    return null;
  }

  protected extractAttributeParameters(attribute: Parser.SyntaxNode): Record<string, any> {
    // 实现提取属性参数逻辑
    const parameters: Record<string, any> = {};

    for (const child of attribute.children) {
      if (child.type === 'argument_list') {
        // 处理属性参数
        const args = this.extractCallArguments(child);
        parameters.args = args;
        break;
      }
    }

    return parameters;
  }

  protected extractCallArguments(argList: Parser.SyntaxNode): any[] {
    // 提取参数
    const args: any[] = [];

    for (const child of argList.children) {
      if (child.type !== 'comment') { // 排除注释
        // 简化的参数提取
        args.push({
          type: child.type,
          text: child.text
        });
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

  protected generateSymbolId(symbol: Symbol): string {
    return `${symbol.type}_${Buffer.from(`${symbol.filePath}_${symbol.name}`).toString('hex')}`;
  }

  protected generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }
}