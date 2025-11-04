import {
  SymbolResolver,
  Symbol,
  SymbolType,
  TreeSitterService,
  LoggerService,
  inject,
  injectable,
  TYPES,
  Parser,
  SemanticRelationship,
  LANGUAGE_NODE_MAPPINGS
} from '../types';
import { BasePythonRelationshipExtractor } from './BasePythonRelationshipExtractor';

export class SemanticExtractor extends BasePythonRelationshipExtractor {
  async extract(
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
}