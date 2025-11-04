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
export class PythonRelationshipExtractor implements ILanguageRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) protected treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) protected logger: LoggerService
  ) { }

  getSupportedLanguage(): string {
    return 'python';
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
    fileContent: string,
    symbolResolver: SymbolResolver
  ): Promise<CallRelationship[]> {
    const relationships: CallRelationship[] = [];

    // 查找所有调用表达式
    const callExpressions = this.treeSitterService.findNodesByTypes(ast, 
      LANGUAGE_NODE_MAPPINGS['python'].callExpression
    );

    for (const callExpr of callExpressions) {
      // 使用符号解析器查找调用者函数
      const callerSymbol = this.findCallerSymbol(callExpr, symbolResolver, filePath);
      const calleeName = this.extractCalleeName(callExpr, fileContent);

      if (callerSymbol && calleeName) {
        // 使用符号解析器解析被调用函数
        const resolvedSymbol = symbolResolver.resolveSymbol(calleeName, filePath, callExpr);

        // 分析调用上下文
        const callContext = this.analyzeCallContext(callExpr, fileContent);

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
      LANGUAGE_NODE_MAPPINGS['python'].classDeclaration
    );

    for (const classDecl of classDeclarations) {
      const className = this.extractClassName(classDecl);
      const parentClasses = this.findParentClasses(classDecl);

      if (className && parentClasses.length > 0) {
        for (const parentClass of parentClasses) {
          const parentClassName = this.extractParentClassName(parentClass);

          if (parentClassName) {
            // 使用符号解析器解析父类符号
            const resolvedParentSymbol = symbolResolver.resolveSymbol(parentClassName, filePath, parentClass);
            const childSymbol = symbolResolver.resolveSymbol(className, filePath, classDecl);

            relationships.push({
              parentId: resolvedParentSymbol ? this.generateSymbolId(resolvedParentSymbol) : this.generateNodeId(parentClassName, 'class', filePath),
              childId: childSymbol ? this.generateSymbolId(childSymbol) : this.generateNodeId(className, 'class', filePath),
              inheritanceType: 'extends', // Python只支持继承，没有接口实现
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
      LANGUAGE_NODE_MAPPINGS['python'].importDeclaration
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

    return relationships;
  }

  async extractReferenceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    fileContent: string,
    symbolResolver: SymbolResolver
  ): Promise<ReferenceRelationship[]> {
    const relationships: ReferenceRelationship[] = [];

    // 查找所有标识符引用和点分名称
    const identifiers = this.treeSitterService.findNodesByTypes(ast, 
      LANGUAGE_NODE_MAPPINGS['python'].propertyIdentifier
    );

    for (const identifier of identifiers) {
      const identifierName = this.treeSitterService.getNodeText(identifier, fileContent);

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
      LANGUAGE_NODE_MAPPINGS['python'].memberExpression
    );

    for (const memberExpr of memberExpressions) {
      const memberName = this.extractMemberExpressionName(memberExpr, fileContent);

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
      LANGUAGE_NODE_MAPPINGS['python'].functionDeclaration
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
      LANGUAGE_NODE_MAPPINGS['python'].methodDeclaration
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
    fileContent: string,
    symbolResolver: SymbolResolver
  ): Promise<CreationRelationship[]> {
    const relationships: CreationRelationship[] = [];

    // 查找类实例化调用
    const callExpressions = this.treeSitterService.findNodesByTypes(ast, 
      LANGUAGE_NODE_MAPPINGS['python'].callExpression
    );

    for (const callExpr of callExpressions) {
      const className = this.extractClassNameFromCallExpression(callExpr, fileContent);

      if (className) {
        // 使用符号解析器解析类符号
        const resolvedSymbol = symbolResolver.resolveSymbol(className, filePath, callExpr);

        relationships.push({
          sourceId: this.generateNodeId(`creation_${callExpr.startPosition.row}`, 'creation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(className, 'class', filePath),
          creationType: 'instantiation',
          targetName: className,
          location: {
            filePath,
            lineNumber: callExpr.startPosition.row + 1,
            columnNumber: callExpr.startPosition.column + 1
          },
          resolvedTargetSymbol: resolvedSymbol || undefined
        });
      }
    }

    // 查找Lambda表达式
    const lambdaExpressions = this.treeSitterService.findNodesByTypes(ast, 
      LANGUAGE_NODE_MAPPINGS['python'].lambdaExpression
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

    // 查找变量声明中的对象创建
    const variableDeclarations = this.treeSitterService.findNodesByTypes(ast, 
      LANGUAGE_NODE_MAPPINGS['python'].variableDeclaration
    );

    for (const varDecl of variableDeclarations) {
      // 查找字典字面量
      const dictLiterals = this.treeSitterService.findNodeByType(varDecl, 'dictionary');
      for (const dictLiteral of dictLiterals) {
        relationships.push({
          sourceId: this.generateNodeId(`dict_creation_${dictLiteral.startPosition.row}`, 'creation', filePath),
          targetId: this.generateNodeId('dict', 'builtin', filePath),
          creationType: 'instantiation',
          targetName: 'dict',
          location: {
            filePath,
            lineNumber: dictLiteral.startPosition.row + 1,
            columnNumber: dictLiteral.startPosition.column + 1
          },
          resolvedTargetSymbol: undefined
        });
      }

      // 查找列表字面量
      const listLiterals = this.treeSitterService.findNodeByType(varDecl, 'list');
      for (const listLiteral of listLiterals) {
        relationships.push({
          sourceId: this.generateNodeId(`list_creation_${listLiteral.startPosition.row}`, 'creation', filePath),
          targetId: this.generateNodeId('list', 'builtin', filePath),
          creationType: 'instantiation',
          targetName: 'list',
          location: {
            filePath,
            lineNumber: listLiteral.startPosition.row + 1,
            columnNumber: listLiteral.startPosition.column + 1
          },
          resolvedTargetSymbol: undefined
        });
      }

      // 查找集合字面量
      const setLiterals = this.treeSitterService.findNodeByType(varDecl, 'set');
      for (const setLiteral of setLiterals) {
        relationships.push({
          sourceId: this.generateNodeId(`set_creation_${setLiteral.startPosition.row}`, 'creation', filePath),
          targetId: this.generateNodeId('set', 'builtin', filePath),
          creationType: 'instantiation',
          targetName: 'set',
          location: {
            filePath,
            lineNumber: setLiteral.startPosition.row + 1,
            columnNumber: setLiteral.startPosition.column + 1
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
      LANGUAGE_NODE_MAPPINGS['python'].decorator
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
      LANGUAGE_NODE_MAPPINGS['python'].typeAnnotation
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

  // Python特定的辅助方法实现
  protected findCallerSymbol(callExpr: Parser.SyntaxNode, symbolResolver: SymbolResolver, filePath: string): Symbol | null {
    // 实现查找调用者符号的逻辑
    // 需要向上遍历AST找到包含当前调用的函数
    let currentNode: Parser.SyntaxNode | null = callExpr.parent;
    while (currentNode) {
      if (currentNode.type === 'function_definition' ||
        currentNode.type === 'async_function_definition' ||
        currentNode.type === 'decorated_definition') {
        // 查找函数名
        for (const child of currentNode.children) {
          if (child.type === 'identifier') {
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

  protected extractCalleeName(callExpr: Parser.SyntaxNode, fileContent: string): string | null {
    // 实现提取被调用函数名逻辑
    if (callExpr.children && callExpr.children.length > 0) {
      const funcNode = callExpr.children[0];
      if (funcNode.type === 'identifier') {
        return this.treeSitterService.getNodeText(funcNode, fileContent);
      } else if (funcNode.type === 'attribute') {
        // 处理 obj.method() 的情况
        return this.extractMethodNameFromAttribute(funcNode, fileContent);
      }
    }
    return null;
  }

  protected extractMethodNameFromAttribute(attribute: Parser.SyntaxNode, fileContent: string): string | null {
    // 从属性表达式中提取方法名
    if (attribute.children && attribute.children.length > 0) {
      const lastChild = attribute.children[attribute.children.length - 1];
      if (lastChild.type === 'identifier') {
        return this.treeSitterService.getNodeText(lastChild, fileContent);
      }
    }
    return null;
  }

  protected analyzeCallContext(callExpr: Parser.SyntaxNode, fileContent: string): {
    isChained: boolean;
    chainDepth?: number;
    isAsync: boolean;
  } {
    // 实现分析调用上下文的逻辑
    const isChained = callExpr.parent?.type === 'call' || callExpr.parent?.type === 'attribute';
    const isAsync = callExpr.text.includes('await');

    return {
      isChained,
      isAsync,
      chainDepth: isChained ? this.calculateChainDepth(callExpr) : 0
    };
  }

  protected calculateChainDepth(node: Parser.SyntaxNode): number {
    let depth = 0;
    let current = node;
    while (current.parent && (current.parent.type === 'call' || current.parent.type === 'attribute')) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  protected determineCallType(callExpr: Parser.SyntaxNode, resolvedSymbol: Symbol | null): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' {
    // 实现确定调用类型逻辑
    if (callExpr.parent?.type === 'decorator') {
      return 'decorator';
    }

    // If we have resolved the symbol, check its type
    if (resolvedSymbol) {
      if (resolvedSymbol.type === 'method') {
        return 'method';
      } else if (resolvedSymbol.type === 'function') {
        return 'function';
      } else if (resolvedSymbol.type === 'class') {
        return 'constructor';
      }
    }

    // Check if it's a constructor call (capitalized name)
    if (callExpr.children && callExpr.children.length > 0) {
      const funcNode = callExpr.children[0];
      if (funcNode.type === 'identifier' && funcNode.text) {
        const name = funcNode.text;
        if (name[0] === name[0].toUpperCase()) {
          return 'constructor';
        }
      }
    }

    return 'function';
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

  protected findParentClasses(node: Parser.SyntaxNode): Parser.SyntaxNode[] {
    // 实现查找父类逻辑
    const parentClasses: Parser.SyntaxNode[] = [];

    for (const child of node.children) {
      if (child.type === 'argument_list') {
        for (const arg of child.children) {
          if (arg.type === 'identifier' || arg.type === 'attribute') {
            parentClasses.push(arg);
          }
        }
      }
    }
    return parentClasses;
  }

  protected extractParentClassName(parentClass: Parser.SyntaxNode): string | null {
    // 实现提取父类名逻辑
    if (parentClass.type === 'identifier') {
      return parentClass.text || null;
    } else if (parentClass.type === 'attribute') {
      // Handle module.ClassName
      return parentClass.text || null;
    }
    return null;
  }

  protected extractImportInfo(importStmt: Parser.SyntaxNode): {
    source: string;
    importedSymbols: string[];
  } | null {
    // 实现提取导入信息逻辑
    let source = '';
    const importedSymbols: string[] = [];

    if (importStmt.type === 'import_statement') {
      // 处理 import module 或 import module as alias
      for (const child of importStmt.children) {
        if (child.type === 'dotted_name') {
          source = this.treeSitterService.getNodeText(child, '');
          importedSymbols.push(source);
        } else if (child.type === 'aliased_import') {
          // 处理 import module as alias
          for (const aliasChild of child.children) {
            if (aliasChild.type === 'dotted_name') {
              source = this.treeSitterService.getNodeText(aliasChild, '');
              importedSymbols.push(source);
            }
          }
        }
      }
    } else if (importStmt.type === 'import_from_statement') {
      // 处理 from module import name1, name2
      for (const child of importStmt.children) {
        if (child.type === 'dotted_name') {
          source = this.treeSitterService.getNodeText(child, '');
        } else if (child.type === 'dotted_name' || child.type === 'import_list') {
          if (child.type === 'import_list') {
            for (const importItem of child.children) {
              if (importItem.type === 'dotted_name' || importItem.type === 'aliased_import') {
                if (importItem.type === 'dotted_name') {
                  importedSymbols.push(this.treeSitterService.getNodeText(importItem, ''));
                } else if (importItem.type === 'aliased_import') {
                  // 处理 name as alias
                  for (const aliasChild of importItem.children) {
                    if (aliasChild.type === 'dotted_name') {
                      importedSymbols.push(this.treeSitterService.getNodeText(aliasChild, ''));
                    }
                  }
                }
              }
            }
          }
        }
      }
    } else if (importStmt.type === 'relative_import') {
      // 处理相对导入
      for (const child of importStmt.children) {
        if (child.type === 'import_list') {
          for (const importItem of child.children) {
            if (importItem.type === 'dotted_name' || importItem.type === 'aliased_import') {
              if (importItem.type === 'dotted_name') {
                importedSymbols.push(this.treeSitterService.getNodeText(importItem, ''));
              } else if (importItem.type === 'aliased_import') {
                for (const aliasChild of importItem.children) {
                  if (aliasChild.type === 'dotted_name') {
                    importedSymbols.push(this.treeSitterService.getNodeText(aliasChild, ''));
                  }
                }
              }
            }
          }
        }
      }
      source = '.'; // 相对导入
    }

    if (source || importedSymbols.length > 0) {
      return {
        source: source || 'local',
        importedSymbols
      };
    }
    return null;
  }

  protected determineReferenceType(identifier: Parser.SyntaxNode, resolvedSymbol: Symbol): 'variable' | 'constant' | 'parameter' | 'field' {
    // 实现确定引用类型逻辑
    // Check parent context to determine reference type
    if (identifier.parent?.type === 'parameters') {
      return 'parameter';
    } else if (identifier.parent?.type === 'attribute' &&
      identifier.parent.parent?.type === 'attribute') {
      return 'field';
    }

    // Check if it's a constant (all uppercase)
    if (identifier.text && identifier.text === identifier.text.toUpperCase()) {
      return 'constant';
    }

    return 'variable';
  }

  protected extractClassNameFromCallExpression(callExpr: Parser.SyntaxNode, fileContent: string): string | null {
    // 实现从调用表达式中提取类名逻辑
    if (callExpr.children && callExpr.children.length > 0) {
      const classNode = callExpr.children[0];
      if (classNode.type === 'identifier') {
        const name = this.treeSitterService.getNodeText(classNode, fileContent);
        // Check if it's likely a class name (starts with uppercase)
        if (name && name[0] === name[0].toUpperCase()) {
          return name;
        }
      } else if (classNode.type === 'attribute') {
        // Handle module.ClassName
        return this.extractAttributeName(classNode, fileContent);
      }
    }
    return null;
  }

  protected extractAttributeName(attribute: Parser.SyntaxNode, fileContent: string): string | null {
    // Extract name from attribute expression like module.ClassName
    const parts: string[] = [];
    this.collectAttributeParts(attribute, fileContent, parts);
    return parts.join('.');
  }

  protected collectAttributeParts(attribute: Parser.SyntaxNode, fileContent: string, parts: string[]): void {
    // Recursively collect parts of an attribute expression
    for (const child of attribute.children) {
      if (child.type === 'identifier') {
        parts.unshift(this.treeSitterService.getNodeText(child, fileContent));
      } else if (child.type === 'attribute') {
        this.collectAttributeParts(child, fileContent, parts);
      }
    }
  }

  protected extractMemberExpressionName(memberExpr: Parser.SyntaxNode, fileContent: string): string | null {
    // Extract name from member expression like obj.method
    if (memberExpr.type === 'attribute') {
      return this.extractAttributeName(memberExpr, fileContent);
    } else if (memberExpr.type === 'subscript') {
      // Handle array[index] or dict[key]
      return this.treeSitterService.getNodeText(memberExpr, fileContent);
    }
    return null;
  }

  protected extractAnnotationName(decorator: Parser.SyntaxNode): string | null {
    // 实现提取注解名逻辑
    if (decorator.children && decorator.children.length > 0) {
      const annotationNode = decorator.children[0];
      if (annotationNode.type === 'identifier') {
        return annotationNode.text || null;
      } else if (annotationNode.type === 'attribute') {
        // Handle module.decorator
        return annotationNode.text || null;
      }
    }
    return null;
  }

  protected extractAnnotationParameters(decorator: Parser.SyntaxNode): Record<string, any> {
    // 实现提取注解参数逻辑
    const parameters: Record<string, any> = {};

    for (const child of decorator.children) {
      if (child.type === 'argument_list') {
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
      if (child.type === 'argument_list') {
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
        if (child.type === 'type') {
          return this.extractTypeFromTypeNode(child);
        }
      }
    }
    return null;
  }

  protected extractTypeFromTypeNode(typeNode: Parser.SyntaxNode): string | null {
    // 从类型节点提取类型名
    if (typeNode.type === 'type') {
      for (const child of typeNode.children) {
        if (child.type === 'identifier') {
          return child.text || null;
        } else if (child.type === 'union_type') {
          // Handle Union[int, str] types
          return 'Union';
        }
      }
    }
    return null;
  }

  protected extractFunctionName(funcDecl: Parser.SyntaxNode): string | null {
    // 提取函数名
    for (const child of funcDecl.children) {
      if (child.type === 'identifier') {
        return child.text || null;
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

  protected generateSymbolId(symbol: Symbol): string {
    return `${symbol.type}_${Buffer.from(`${symbol.filePath}_${symbol.name}`).toString('hex')}`;
  }

  protected generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }
}