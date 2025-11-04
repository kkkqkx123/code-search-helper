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

    // 查找所有调用表达式
    const callExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['python'].callExpression
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
    symbolResolver: SymbolResolver
  ): Promise<ReferenceRelationship[]> {
    const relationships: ReferenceRelationship[] = [];

    // 查找所有标识符引用和点分名称
    const identifiers = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['python'].propertyIdentifier
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
      LANGUAGE_NODE_MAPPINGS['python'].memberExpression
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
    symbolResolver: SymbolResolver
  ): Promise<CreationRelationship[]> {
    const relationships: CreationRelationship[] = [];

    // 查找类实例化调用
    const callExpressions = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['python'].callExpression
    );

    for (const callExpr of callExpressions) {
      const className = this.extractClassNameFromCallExpression(callExpr);

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

  // 新增：数据流关系提取
  async extractDataFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DataFlowRelationship[]> {
    const relationships: DataFlowRelationship[] = [];

    // 提取变量赋值数据流
    const assignments = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['python'].variableDeclaration
    );

    for (const assignment of assignments) {
      const dataFlowRelations = this.extractAssignmentDataFlow(
        assignment, filePath, symbolResolver
      );
      relationships.push(...dataFlowRelations);
    }

    // 提取函数参数传递数据流
    const functionCalls = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['python'].callExpression
    );

    for (const call of functionCalls) {
      const parameterFlows = this.extractParameterDataFlow(
        call, filePath, symbolResolver
      );
      relationships.push(...parameterFlows);
    }

    // 提取返回值数据流
    const returnStatements = this.treeSitterService.findNodesByTypes(ast,
      ['return_statement']
    );

    for (const returnStmt of returnStatements) {
      const returnFlows = this.extractReturnDataFlow(
        returnStmt, filePath, symbolResolver
      );
      relationships.push(...returnFlows);
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

    // 提取条件语句控制流
    const ifStatements = this.treeSitterService.findNodeByType(ast, 'if_statement');
    for (const ifStmt of ifStatements) {
      const conditionalFlows = this.extractConditionalControlFlow(
        ifStmt, filePath, symbolResolver
      );
      relationships.push(...conditionalFlows);
    }

    // 提取异常处理控制流
    const tryStatements = this.treeSitterService.findNodeByType(ast, 'try_statement');
    for (const tryStmt of tryStatements) {
      const exceptionFlows = this.extractExceptionControlFlow(
        tryStmt, filePath, symbolResolver
      );
      relationships.push(...exceptionFlows);
    }

    // 提取异步控制流
    const awaitExpressions = this.treeSitterService.findNodeByType(ast, 'await');
    for (const awaitExpr of awaitExpressions) {
      const asyncFlows = this.extractAsyncControlFlow(
        awaitExpr, filePath, symbolResolver
      );
      relationships.push(...asyncFlows);
    }

    // 提取循环控制流
    const forStatements = this.treeSitterService.findNodeByType(ast, 'for_statement');
    const whileStatements = this.treeSitterService.findNodeByType(ast, 'while_statement');
    for (const loopStmt of [...forStatements, ...whileStatements]) {
      const loopFlows = this.extractLoopControlFlow(
        loopStmt, filePath, symbolResolver
      );
      relationships.push(...loopFlows);
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

    // 提取方法重写关系
    const methodOverrides = this.extractMethodOverrides(ast, filePath, symbolResolver);
    relationships.push(...methodOverrides);

    // 提取重载关系
    const overloads = this.extractOverloads(ast, filePath, symbolResolver);
    relationships.push(...overloads);

    // 提取装饰器观察者模式
    const decorators = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['python'].decorator
    );

    for (const decorator of decorators) {
      const observerRelations = this.extractObserverPattern(
        decorator, filePath, symbolResolver
      );
      relationships.push(...observerRelations);
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

    // 提取类实例化关系
    const newExpressions = this.treeSitterService.findNodeByType(ast, 'call');
    for (const newExpr of newExpressions) {
      const instantiationRelations = this.extractInstantiationRelations(
        newExpr, filePath, symbolResolver
      );
      relationships.push(...instantiationRelations);
    }

    // 提取构造函数初始化关系
    const initMethods = this.treeSitterService.findNodesByTypes(ast,
      ['function_definition'] // In Python, __init__ is a function definition
    );
    for (const initMethod of initMethods) {
      const initRelations = this.extractInitializationRelations(
        initMethod, filePath, symbolResolver
      );
      relationships.push(...initRelations);
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

    // 提取异步/等待同步机制
    const asyncFunctionDefs = this.treeSitterService.findNodesByTypes(ast,
      ['async_function_definition'] // Python async function is defined as async_function_definition
    );
    for (const asyncFunc of asyncFunctionDefs) {
      const asyncConcurrency = this.extractAsyncConcurrency(
        asyncFunc, filePath, symbolResolver
      );
      relationships.push(...asyncConcurrency);
    }

    // 提取锁机制
    const withStatements = this.treeSitterService.findNodesByTypes(ast,
      ['with_statement']
    );
    for (const withStmt of withStatements) {
      const lockRelations = this.extractLockConcurrency(
        withStmt, filePath, symbolResolver
      );
      relationships.push(...lockRelations);
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

  protected extractCalleeName(callExpr: Parser.SyntaxNode): string | null {
    // 实现提取被调用函数名逻辑
    if (callExpr.children && callExpr.children.length > 0) {
      const funcNode = callExpr.children[0];
      if (funcNode.type === 'identifier') {
        return funcNode.text;
      } else if (funcNode.type === 'attribute') {
        // 处理 obj.method() 的情况
        return this.extractMethodNameFromAttribute(funcNode);
      }
    }
    return null;
  }

  protected extractMethodNameFromAttribute(attribute: Parser.SyntaxNode): string | null {
    // 从属性表达式中提取方法名
    if (attribute.children && attribute.children.length > 0) {
      const lastChild = attribute.children[attribute.children.length - 1];
      if (lastChild.type === 'identifier') {
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
          source = child.text;
          importedSymbols.push(source);
        } else if (child.type === 'aliased_import') {
          // 处理 import module as alias
          for (const aliasChild of child.children) {
            if (aliasChild.type === 'dotted_name') {
              source = aliasChild.text;
              importedSymbols.push(source);
            }
          }
        }
      }
    } else if (importStmt.type === 'import_from_statement') {
      // 处理 from module import name1, name2
      for (const child of importStmt.children) {
        if (child.type === 'dotted_name') {
          source = child.text;
        } else if (child.type === 'dotted_name' || child.type === 'import_list') {
          if (child.type === 'import_list') {
            for (const importItem of child.children) {
              if (importItem.type === 'dotted_name' || importItem.type === 'aliased_import') {
                if (importItem.type === 'dotted_name') {
                  importedSymbols.push(importItem.text);
                } else if (importItem.type === 'aliased_import') {
                  // 处理 name as alias
                  for (const aliasChild of importItem.children) {
                    if (aliasChild.type === 'dotted_name') {
                      importedSymbols.push(aliasChild.text);
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
                importedSymbols.push(importItem.text);
              } else if (importItem.type === 'aliased_import') {
                for (const aliasChild of importItem.children) {
                  if (aliasChild.type === 'dotted_name') {
                    importedSymbols.push(aliasChild.text);
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

  protected extractClassNameFromCallExpression(callExpr: Parser.SyntaxNode): string | null {
    // 实现从调用表达式中提取类名逻辑
    if (callExpr.children && callExpr.children.length > 0) {
      const classNode = callExpr.children[0];
      if (classNode.type === 'identifier') {
        const name = classNode.text;
        // Check if it's likely a class name (starts with uppercase)
        if (name && name[0] === name[0].toUpperCase()) {
          return name;
        }
      } else if (classNode.type === 'attribute') {
        // Handle module.ClassName
        return this.extractAttributeName(classNode);
      }
    }
    return null;
  }

  protected extractAttributeName(attribute: Parser.SyntaxNode): string | null {
    // Extract name from attribute expression like module.ClassName
    const parts: string[] = [];
    this.collectAttributeParts(attribute, parts);
    return parts.join('.');
  }

  protected collectAttributeParts(attribute: Parser.SyntaxNode, parts: string[]): void {
    // Recursively collect parts of an attribute expression
    for (const child of attribute.children) {
      if (child.type === 'identifier') {
        parts.unshift(child.text);
      } else if (child.type === 'attribute') {
        this.collectAttributeParts(child, parts);
      }
    }
  }

  protected extractMemberExpressionName(memberExpr: Parser.SyntaxNode): string | null {
    // Extract name from member expression like obj.method
    if (memberExpr.type === 'attribute') {
      return this.extractAttributeName(memberExpr);
    } else if (memberExpr.type === 'subscript') {
      // Handle array[index] or dict[key]
      return memberExpr.text;
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
        const args = this.extractDecoratorCallArguments(child);
        parameters.args = args;
        break;
      }
    }

    return parameters;
  }

  protected extractDecoratorCallArguments(callExpr: Parser.SyntaxNode): any[] {
    // 提取装饰器调用参数
    const args: any[] = [];

    for (const child of callExpr.children) {
      if (child.type === 'argument_list') {
        for (const arg of child.children) {
          // Simplified参数 extraction
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

  // 数据流关系提取辅助方法
  protected extractAssignmentDataFlow(
    assignment: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): DataFlowRelationship[] {
    const relationships: DataFlowRelationship[] = [];

    // 提取变量赋值的源和目标
    const leftHandSide = assignment.firstChild; // 变量名
    const rightHandSide = assignment.lastChild; // 赋值表达式

    if (leftHandSide && rightHandSide) {
      const targetVar = leftHandSide.text;
      const sourceExpr = rightHandSide.text;

      // 解析目标变量符号
      const resolvedTargetSymbol = symbolResolver.resolveSymbol(targetVar, filePath, leftHandSide);

      // 递归查找源表达式中的变量
      const sourceVars = this.findVariablesInExpression(rightHandSide);
      
      for (const sourceVar of sourceVars) {
        const resolvedSourceSymbol = symbolResolver.resolveSymbol(sourceVar, filePath, rightHandSide);

        relationships.push({
          sourceId: this.generateNodeId(sourceVar, 'variable', filePath),
          targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(targetVar, 'variable', filePath),
          flowType: 'variable_assignment',
          dataType: 'variable',
          flowPath: [sourceVar, targetVar],
          location: {
            filePath,
            lineNumber: assignment.startPosition.row + 1,
            columnNumber: assignment.startPosition.column + 1
          },
          resolvedSourceSymbol: resolvedSourceSymbol || undefined,
          resolvedTargetSymbol: resolvedTargetSymbol || undefined
        });
      }
    }

    return relationships;
  }

  protected extractParameterDataFlow(
    callExpr: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): DataFlowRelationship[] {
    const relationships: DataFlowRelationship[] = [];

    // 提取函数调用的参数传递
    const calleeName = this.extractCalleeName(callExpr);
    if (calleeName) {
      const resolvedTargetSymbol = symbolResolver.resolveSymbol(calleeName, filePath, callExpr);

      // 查找参数
      const args = this.extractCallArguments(callExpr);
      for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        const sourceVars = this.findVariablesInExpression(arg.node);

        for (const sourceVar of sourceVars) {
          const resolvedSourceSymbol = symbolResolver.resolveSymbol(sourceVar, filePath, arg.node);

          relationships.push({
            sourceId: this.generateNodeId(sourceVar, 'parameter', filePath),
            targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(calleeName, 'function', filePath),
            flowType: 'parameter_passing',
            dataType: arg.type,
            flowPath: [sourceVar, calleeName],
            location: {
              filePath,
              lineNumber: callExpr.startPosition.row + 1,
              columnNumber: callExpr.startPosition.column + 1
            },
            resolvedSourceSymbol: resolvedSourceSymbol || undefined,
            resolvedTargetSymbol: resolvedTargetSymbol || undefined
          });
        }
      }
    }

    return relationships;
  }

  protected extractReturnDataFlow(
    returnStmt: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): DataFlowRelationship[] {
    const relationships: DataFlowRelationship[] = [];

    // 查找return语句中的表达式
    const returnExpr = returnStmt.lastChild;
    if (returnExpr) {
      // 查找返回的变量
      const returnVars = this.findVariablesInExpression(returnExpr);

      // 找到包含return语句的函数
      const containingFunction = this.findContainingFunction(returnStmt);
      if (containingFunction) {
        const funcName = this.extractFunctionName(containingFunction);
        if (funcName) {
          const resolvedFuncSymbol = symbolResolver.resolveSymbol(funcName, filePath, containingFunction);

          for (const returnVar of returnVars) {
            const resolvedReturnSymbol = symbolResolver.resolveSymbol(returnVar, filePath, returnExpr);

            relationships.push({
              sourceId: this.generateNodeId(returnVar, 'return_value', filePath),
              targetId: resolvedFuncSymbol ? this.generateSymbolId(resolvedFuncSymbol) : this.generateNodeId(funcName, 'function', filePath),
              flowType: 'return_value',
              dataType: 'return',
              flowPath: [returnVar, funcName],
              location: {
                filePath,
                lineNumber: returnStmt.startPosition.row + 1,
                columnNumber: returnStmt.startPosition.column + 1
              },
              resolvedSourceSymbol: resolvedReturnSymbol || undefined,
              resolvedTargetSymbol: resolvedFuncSymbol || undefined
            });
          }
        }
      }
    }

    return relationships;
  }

  // 控制流关系提取辅助方法
  protected extractConditionalControlFlow(
    ifStmt: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): ControlFlowRelationship[] {
    const relationships: ControlFlowRelationship[] = [];

    // 提取条件表达式
    const condition = ifStmt.child(0); // if的条件部分
    if (condition && condition.text) {
      // 查找条件中涉及的变量
      const conditionVars = this.findVariablesInExpression(condition);

      // 找到条件语句中的函数
      const containingFunction = this.findContainingFunction(ifStmt);
      if (containingFunction) {
        const funcName = this.extractFunctionName(containingFunction);
        if (funcName) {
          for (const varName of conditionVars) {
            const resolvedVarSymbol = symbolResolver.resolveSymbol(varName, filePath, condition);
            const resolvedFuncSymbol = symbolResolver.resolveSymbol(funcName, filePath, containingFunction);

            relationships.push({
              sourceId: this.generateNodeId(varName, 'condition', filePath),
              targetId: resolvedFuncSymbol ? this.generateSymbolId(resolvedFuncSymbol) : this.generateNodeId(funcName, 'function', filePath),
              flowType: 'conditional',
              condition: condition.text,
              isExceptional: false,
              location: {
                filePath,
                lineNumber: ifStmt.startPosition.row + 1,
                columnNumber: ifStmt.startPosition.column + 1
              },
              resolvedSymbol: resolvedVarSymbol || undefined
            });
          }
        }
      }
    }

    return relationships;
  }

  protected extractExceptionControlFlow(
    tryStmt: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): ControlFlowRelationship[] {
    const relationships: ControlFlowRelationship[] = [];

    // 查找try块中的代码
    const tryBlock = tryStmt.child(1); // try块通常在第二个子节点
    if (tryBlock) {
      // 提取try块中可能抛出异常的代码
      const containingFunction = this.findContainingFunction(tryStmt);
      if (containingFunction) {
        const funcName = this.extractFunctionName(containingFunction);
        if (funcName) {
          const resolvedFuncSymbol = symbolResolver.resolveSymbol(funcName, filePath, containingFunction);

          relationships.push({
            sourceId: this.generateNodeId(`try_block_${tryStmt.startPosition.row}`, 'exception', filePath),
            targetId: resolvedFuncSymbol ? this.generateSymbolId(resolvedFuncSymbol) : this.generateNodeId(funcName, 'function', filePath),
            flowType: 'exception',
            condition: 'try-except block',
            isExceptional: true,
            location: {
              filePath,
              lineNumber: tryStmt.startPosition.row + 1,
              columnNumber: tryStmt.startPosition.column + 1
            },
            resolvedSymbol: resolvedFuncSymbol || undefined
          });
        }
      }
    }

    return relationships;
  }

  protected extractAsyncControlFlow(
    awaitExpr: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): ControlFlowRelationship[] {
    const relationships: ControlFlowRelationship[] = [];

    // 查找await表达式中的函数调用
    const awaitContent = awaitExpr.child(0);
    if (awaitContent) {
      const funcName = awaitContent.text;
      if (funcName) {
        const resolvedFuncSymbol = symbolResolver.resolveSymbol(funcName, filePath, awaitExpr);

        // 查找包含await的异步函数
        const containingFunction = this.findContainingAsyncFunction(awaitExpr);
        if (containingFunction) {
          const asyncFuncName = this.extractFunctionName(containingFunction);
          if (asyncFuncName) {
            const resolvedAsyncFuncSymbol = symbolResolver.resolveSymbol(asyncFuncName, filePath, containingFunction);

            relationships.push({
              sourceId: resolvedFuncSymbol ? this.generateSymbolId(resolvedFuncSymbol) : this.generateNodeId(funcName, 'async_function', filePath),
              targetId: resolvedAsyncFuncSymbol ? this.generateSymbolId(resolvedAsyncFuncSymbol) : this.generateNodeId(asyncFuncName, 'async_function', filePath),
              flowType: 'async_await',
              condition: funcName,
              isExceptional: false,
              location: {
                filePath,
                lineNumber: awaitExpr.startPosition.row + 1,
                columnNumber: awaitExpr.startPosition.column + 1
              },
              resolvedSymbol: resolvedAsyncFuncSymbol || undefined
            });
          }
        }
      }
    }

    return relationships;
  }

  protected extractLoopControlFlow(
    loopStmt: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): ControlFlowRelationship[] {
    const relationships: ControlFlowRelationship[] = [];

    // 提取循环条件和循环体
    const condition = loopStmt.child(0);
    if (condition && condition.text) {
      const conditionVars = this.findVariablesInExpression(condition);

      const containingFunction = this.findContainingFunction(loopStmt);
      if (containingFunction) {
        const funcName = this.extractFunctionName(containingFunction);
        if (funcName) {
          const resolvedFuncSymbol = symbolResolver.resolveSymbol(funcName, filePath, containingFunction);

          for (const varName of conditionVars) {
            const resolvedVarSymbol = symbolResolver.resolveSymbol(varName, filePath, condition);

            relationships.push({
              sourceId: this.generateNodeId(varName, 'loop_condition', filePath),
              targetId: resolvedFuncSymbol ? this.generateSymbolId(resolvedFuncSymbol) : this.generateNodeId(funcName, 'function', filePath),
              flowType: 'loop',
              condition: condition.text,
              isExceptional: false,
              location: {
                filePath,
                lineNumber: loopStmt.startPosition.row + 1,
                columnNumber: loopStmt.startPosition.column + 1
              },
              resolvedSymbol: resolvedVarSymbol || undefined
            });
          }
        }
      }
    }

    return relationships;
  }

  // 语义关系提取辅助方法
  protected extractMethodOverrides(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): SemanticRelationship[] {
    const relationships: SemanticRelationship[] = [];

    // 查找类中的方法定义
    const classDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['python'].classDeclaration
    );

    for (const classDecl of classDeclarations) {
      const parentClasses = this.findParentClasses(classDecl);
      const className = this.extractClassName(classDecl);

      if (className && parentClasses.length > 0) {
        // 检查类中的方法是否重写父类方法
        const methodDeclarations = this.treeSitterService.findNodesByTypes(classDecl,
          LANGUAGE_NODE_MAPPINGS['python'].methodDeclaration
        );

        for (const methodDecl of methodDeclarations) {
          const methodName = this.extractMethodName(methodDecl);
          if (methodName) {
            // Check if method exists in parent class
            for (const parentClass of parentClasses) {
              const parentClassName = this.extractParentClassName(parentClass);
              if (parentClassName) {
                // Create a relationship for potential override
                const resolvedSourceSymbol = symbolResolver.resolveSymbol(`${className}.${methodName}`, filePath, methodDecl);
                const resolvedTargetSymbol = symbolResolver.resolveSymbol(`${parentClassName}.${methodName}`, filePath, parentClass);

                relationships.push({
                  sourceId: resolvedSourceSymbol ? this.generateSymbolId(resolvedSourceSymbol) : this.generateNodeId(`${className}.${methodName}`, 'method', filePath),
                  targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(`${parentClassName}.${methodName}`, 'method', filePath),
                  semanticType: 'overrides',
                  pattern: 'inheritance_override',
                  metadata: {
                    className,
                    parentClassName,
                    methodName
                  },
                  location: {
                    filePath,
                    lineNumber: methodDecl.startPosition.row + 1,
                    columnNumber: methodDecl.startPosition.column + 1
                  },
                  resolvedSourceSymbol: resolvedSourceSymbol || undefined,
                  resolvedTargetSymbol: resolvedTargetSymbol || undefined
                });
              }
            }
          }
        }
      }
    }

    return relationships;
  }

  protected extractOverloads(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): SemanticRelationship[] {
    const relationships: SemanticRelationship[] = [];

    // 由于Python是动态类型语言，没有传统意义上的重载
    // 但可以检测具有相同名称的函数定义
    const functionDeclarations = this.treeSitterService.findNodesByTypes(ast,
      LANGUAGE_NODE_MAPPINGS['python'].functionDeclaration
    );

    // Group functions by name to identify potential overloads
    const functionGroups: { [key: string]: Parser.SyntaxNode[] } = {};
    for (const funcDecl of functionDeclarations) {
      const funcName = this.extractFunctionName(funcDecl);
      if (funcName) {
        if (!functionGroups[funcName]) {
          functionGroups[funcName] = [];
        }
        functionGroups[funcName].push(funcDecl);
      }
    }

    // If a function name appears multiple times, create overload relationships
    for (const [funcName, funcDecls] of Object.entries(functionGroups)) {
      if (funcDecls.length > 1) {
        for (let i = 1; i < funcDecls.length; i++) {
          const resolvedSourceSymbol = symbolResolver.resolveSymbol(funcName, filePath, funcDecls[i]);
          const resolvedTargetSymbol = symbolResolver.resolveSymbol(funcName, filePath, funcDecls[i - 1]);

          relationships.push({
            sourceId: resolvedSourceSymbol ? this.generateSymbolId(resolvedSourceSymbol) : this.generateNodeId(funcName, 'function', filePath),
            targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(funcName, 'function', filePath),
            semanticType: 'overloads',
            pattern: 'function_redefinition',
            metadata: {
              functionName: funcName,
              overloadCount: funcDecls.length
            },
            location: {
              filePath,
              lineNumber: funcDecls[i].startPosition.row + 1,
              columnNumber: funcDecls[i].startPosition.column + 1
            },
            resolvedSourceSymbol: resolvedSourceSymbol || undefined,
            resolvedTargetSymbol: resolvedTargetSymbol || undefined
          });
        }
      }
    }

    return relationships;
  }

  protected extractObserverPattern(
    decorator: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): SemanticRelationship[] {
    const relationships: SemanticRelationship[] = [];

    // 检查装饰器是否为观察者模式相关装饰器
    const decoratorName = this.extractAnnotationName(decorator);
    if (decoratorName && ['observer', 'subscriber', 'listener'].includes(decoratorName.toLowerCase())) {
      // 查找装饰器所应用的函数或方法
      const decoratedItem = decorator.parent?.parent; // decorator -> decorated_definition -> actual function
      if (decoratedItem) {
        let decoratedName: string | null = null;
        
        // 查找被装饰项的名称
        for (const child of decoratedItem.children) {
          if (child.type === 'identifier') {
            decoratedName = child.text;
            break;
          }
        }

        if (decoratedName) {
          const resolvedSourceSymbol = symbolResolver.resolveSymbol(decoratorName, filePath, decorator);
          const resolvedTargetSymbol = symbolResolver.resolveSymbol(decoratedName, filePath, decoratedItem);

          relationships.push({
            sourceId: resolvedSourceSymbol ? this.generateSymbolId(resolvedSourceSymbol) : this.generateNodeId(decoratorName, 'decorator', filePath),
            targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(decoratedName, 'function', filePath),
            semanticType: 'observes',
            pattern: 'observer_pattern',
            metadata: {
              decorator: decoratorName,
              observed: decoratedName
            },
            location: {
              filePath,
              lineNumber: decoratedItem.startPosition.row + 1,
              columnNumber: decoratedItem.startPosition.column + 1
            },
            resolvedSourceSymbol: resolvedSourceSymbol || undefined,
            resolvedTargetSymbol: resolvedTargetSymbol || undefined
          });
        }
      }
    }

    return relationships;
  }

  // 生命周期关系提取辅助方法
  protected extractInstantiationRelations(
    callExpr: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): LifecycleRelationship[] {
    const relationships: LifecycleRelationship[] = [];

    // 检查是否是类实例化调用
    const className = this.extractClassNameFromCallExpression(callExpr);
    if (className) {
      // 检查是否是对象实例化
      if (className[0] === className[0].toUpperCase()) { // 大写字母开头的通常为类名
        const resolvedTargetSymbol = symbolResolver.resolveSymbol(className, filePath, callExpr);

        // 查找调用实例化的位置
        const containingFunction = this.findContainingFunction(callExpr);
        if (containingFunction) {
          const funcName = this.extractFunctionName(containingFunction);
          if (funcName) {
            const resolvedSourceSymbol = symbolResolver.resolveSymbol(funcName, filePath, containingFunction);

            relationships.push({
              sourceId: resolvedSourceSymbol ? this.generateSymbolId(resolvedSourceSymbol) : this.generateNodeId(funcName, 'function', filePath),
              targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(className, 'class', filePath),
              lifecycleType: 'instantiates',
              lifecyclePhase: 'creation',
              location: {
                filePath,
                lineNumber: callExpr.startPosition.row + 1,
                columnNumber: callExpr.startPosition.column + 1
              },
              resolvedTargetSymbol: resolvedTargetSymbol || undefined
            });
          }
        }
      }
    }

    return relationships;
  }

  protected extractInitializationRelations(
    initMethod: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): LifecycleRelationship[] {
    const relationships: LifecycleRelationship[] = [];

    // 提取__init__方法中的初始化逻辑
    const className = this.findContainingClassName(initMethod);
    if (className) {
      const resolvedTargetSymbol = symbolResolver.resolveSymbol(className, filePath, initMethod);

      // 查找init方法的名称
      const initName = this.extractMethodName(initMethod);
      if (initName) {
        const resolvedSourceSymbol = symbolResolver.resolveSymbol(initName, filePath, initMethod);

        relationships.push({
          sourceId: resolvedSourceSymbol ? this.generateSymbolId(resolvedSourceSymbol) : this.generateNodeId(initName, 'method', filePath),
          targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(className, 'class', filePath),
          lifecycleType: 'initializes',
          lifecyclePhase: 'setup',
          location: {
            filePath,
            lineNumber: initMethod.startPosition.row + 1,
            columnNumber: initMethod.startPosition.column + 1
          },
          resolvedTargetSymbol: resolvedTargetSymbol || undefined
        });
      }
    }

    return relationships;
  }

  // 并发关系提取辅助方法
  protected extractAsyncConcurrency(
    asyncFunc: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): ConcurrencyRelationship[] {
    const relationships: ConcurrencyRelationship[] = [];

    // 提取异步函数的并发特性
    const funcName = this.extractFunctionName(asyncFunc);
    if (funcName) {
      const resolvedSymbol = symbolResolver.resolveSymbol(funcName, filePath, asyncFunc);

      relationships.push({
        sourceId: this.generateNodeId(`${funcName}_async`, 'function', filePath),
        targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(funcName, 'function', filePath),
        concurrencyType: 'awaits',
        synchronizationMechanism: 'async/await',
        location: {
          filePath,
          lineNumber: asyncFunc.startPosition.row + 1,
          columnNumber: asyncFunc.startPosition.column + 1
        },
        resolvedSymbol: resolvedSymbol || undefined
      });
    }

    return relationships;
  }

  protected extractLockConcurrency(
    withStmt: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): ConcurrencyRelationship[] {
    const relationships: ConcurrencyRelationship[] = [];

    // 检查with语句是否包含锁机制
    const withItem = withStmt.child(1); // with item is usually the second child
    if (withItem && withItem.type === 'with_item') {
      const contextExpr = withItem.firstChild;
      if (contextExpr) {
        // Check if the context expression is a lock
        if (contextExpr.text.includes('lock') || contextExpr.text.includes('Lock') || 
            contextExpr.text.includes('mutex') || contextExpr.text.includes('semaphore')) {
          
          const lockName = contextExpr.text;
          const resolvedSymbol = symbolResolver.resolveSymbol(lockName, filePath, withItem);

          // Find the surrounding function
          const containingFunction = this.findContainingFunction(withStmt);
          if (containingFunction) {
            const funcName = this.extractFunctionName(containingFunction);
            if (funcName) {
              const resolvedTargetSymbol = symbolResolver.resolveSymbol(funcName, filePath, containingFunction);

              relationships.push({
                sourceId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(lockName, 'lock', filePath),
                targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(funcName, 'function', filePath),
                concurrencyType: 'synchronizes',
                synchronizationMechanism: 'context_manager',
                location: {
                  filePath,
                  lineNumber: withStmt.startPosition.row + 1,
                  columnNumber: withStmt.startPosition.column + 1
                },
                resolvedSymbol: resolvedSymbol || undefined
              });
            }
          }
        }
      }
    }

    return relationships;
  }

  // 通用辅助方法
  protected findContainingFunction(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let currentNode: Parser.SyntaxNode | null = node.parent;
    while (currentNode) {
      if (currentNode.type === 'function_definition' ||
          currentNode.type === 'async_function_definition' ||
          currentNode.type === 'method_definition') {
        return currentNode;
      }
      currentNode = currentNode.parent;
    }
    return null;
  }

  protected findContainingAsyncFunction(node: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let currentNode: Parser.SyntaxNode | null = node.parent;
    while (currentNode) {
      if (currentNode.type === 'async_function_definition') {
        return currentNode;
      }
      currentNode = currentNode.parent;
    }
    return null;
  }

  protected findContainingClassName(node: Parser.SyntaxNode): string | null {
    let currentNode: Parser.SyntaxNode | null = node.parent;
    while (currentNode) {
      if (currentNode.type === 'class_definition') {
        // Find class name
        for (const child of currentNode.children) {
          if (child.type === 'identifier') {
            return child.text;
          }
        }
      }
      currentNode = currentNode.parent;
    }
    return null;
  }

  protected findVariablesInExpression(node: Parser.SyntaxNode): string[] {
    const variables: string[] = [];

    // Recursively find identifier nodes in the expression
    if (node.type === 'identifier') {
      variables.push(node.text);
    }

    // Recursively check children
    for (const child of node.children || []) {
      variables.push(...this.findVariablesInExpression(child));
    }

    return variables;
  }

  protected extractCallArguments(callExpr: Parser.SyntaxNode): Array<{type: string, node: Parser.SyntaxNode}> {
    const args: Array<{type: string, node: Parser.SyntaxNode}> = [];

    for (const child of callExpr.children) {
      if (child.type === 'argument_list') {
        for (const arg of child.children) {
          if (arg.type !== ',' && arg.type !== '(' && arg.type !== ')') { // Skip separators
            args.push({
              type: arg.type,
              node: arg
            });
          }
        }
        break;
      }
    }

    return args;
  }
}