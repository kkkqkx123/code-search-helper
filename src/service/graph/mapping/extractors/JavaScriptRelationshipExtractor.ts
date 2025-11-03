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
import { v4 as uuidv4 } from 'uuid';

@injectable()
export class JavaScriptRelationshipExtractor implements ILanguageRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) private logger: LoggerService
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
    fileContent: string,
    symbolResolver: SymbolResolver
  ): Promise<CallRelationship[]> {
    const relationships: CallRelationship[] = [];

    // 查找所有调用表达式
    const callExpressions = this.treeSitterService.findNodeByType(ast, 'call_expression');

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
    const classDeclarations = this.treeSitterService.findNodeByType(ast, 'class_declaration');

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
    const importStatements = this.treeSitterService.findNodeByType(ast, 'import_statement');

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

    // 查找所有标识符引用
    const identifiers = this.treeSitterService.findNodeByType(ast, 'identifier');

    for (const identifier of identifiers) {
      const identifierName = this.treeSitterService.getNodeText(identifier, fileContent);

      // 使用符号解析器解析引用的符号
      const resolvedSymbol = symbolResolver.resolveSymbol(identifierName, filePath, identifier);

      if (resolvedSymbol) {
        // 确定引用类型
        const referenceType = this.determineReferenceType(identifier, resolvedSymbol);

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

    return relationships;
  }

  async extractCreationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    fileContent: string,
    symbolResolver: SymbolResolver
  ): Promise<CreationRelationship[]> {
    const relationships: CreationRelationship[] = [];

    // 查找new表达式
    const newExpressions = this.treeSitterService.findNodeByType(ast, 'new_expression');

    for (const newExpr of newExpressions) {
      const className = this.extractClassNameFromNewExpression(newExpr, fileContent);

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

    return relationships;
  }

  async extractAnnotationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<AnnotationRelationship[]> {
    const relationships: AnnotationRelationship[] = [];

    // 查找装饰器
    const decorators = this.treeSitterService.findNodeByType(ast, 'decorator');

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

    return relationships;
  }

  // 辅助方法实现
  private findCallerSymbol(callExpr: Parser.SyntaxNode, symbolResolver: SymbolResolver, filePath: string): Symbol | null {
    // 实现查找调用者符号的逻辑
    // 需要遍历AST找到包含当前调用的函数
    return null; // 简化实现
  }

  private extractCalleeName(callExpr: Parser.SyntaxNode, fileContent: string): string | null {
    // 实现提取被调用函数名逻辑
    if (callExpr.children && callExpr.children.length > 0) {
      const funcNode = callExpr.children[0];
      if (funcNode.type === 'identifier') {
        return this.treeSitterService.getNodeText(funcNode, fileContent);
      } else if (funcNode.type === 'member_expression') {
        // 处理 obj.method() 的情况
        return this.extractMethodNameFromMemberExpression(funcNode, fileContent);
      }
    }
    return null;
  }

  private extractMethodNameFromMemberExpression(memberExpr: Parser.SyntaxNode, fileContent: string): string | null {
    // 从成员表达式中提取方法名
    if (memberExpr.children && memberExpr.children.length > 0) {
      const lastChild = memberExpr.children[memberExpr.children.length - 1];
      if (lastChild.type === 'property_identifier') {
        return this.treeSitterService.getNodeText(lastChild, fileContent);
      }
    }
    return null;
  }

  private analyzeCallContext(callExpr: Parser.SyntaxNode, fileContent: string): {
    isChained: boolean;
    chainDepth?: number;
    isAsync: boolean;
  } {
    // 实现分析调用上下文的逻辑
    return {
      isChained: false,
      isAsync: false
    };
  }

  private determineCallType(callExpr: Parser.SyntaxNode, resolvedSymbol: Symbol | null): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' {
    // 实现确定调用类型逻辑
    return 'function';
  }

  private extractClassName(classDecl: Parser.SyntaxNode): string | null {
    // 实现提取类名逻辑
    for (const child of classDecl.children) {
      if (child.type === 'identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  private findHeritageClauses(classDecl: Parser.SyntaxNode): Parser.SyntaxNode[] {
    // 实现查找继承子句逻辑
    const heritageClauses: Parser.SyntaxNode[] = [];
    for (const child of classDecl.children) {
      if (child.type === 'class_heritage') {
        heritageClauses.push(child);
      }
    }
    return heritageClauses;
  }

  private extractParentClassName(heritageClause: Parser.SyntaxNode): string | null {
    // 实现提取父类名逻辑
    if (heritageClause.children && heritageClause.children.length > 0) {
      const parentClassNode = heritageClause.children[0];
      if (parentClassNode.type === 'identifier') {
        return parentClassNode.text || null;
      }
    }
    return null;
  }

  private getInheritanceType(heritageClause: Parser.SyntaxNode): 'extends' | 'implements' | 'mixin' {
    // 实现确定继承类型逻辑
    return 'extends';
  }

  private extractImportInfo(importStmt: Parser.SyntaxNode): {
    source: string;
    importedSymbols: string[];
  } | null {
    // 实现提取导入信息逻辑
    return null; // 简化实现
  }

  private determineReferenceType(identifier: Parser.SyntaxNode, resolvedSymbol: Symbol): 'variable' | 'constant' | 'parameter' | 'field' {
    // 实现确定引用类型逻辑
    return 'variable';
  }

  private extractClassNameFromNewExpression(newExpr: Parser.SyntaxNode, fileContent: string): string | null {
    // 实现从new表达式中提取类名逻辑
    if (newExpr.children && newExpr.children.length > 0) {
      const classNode = newExpr.children[0];
      if (classNode.type === 'identifier') {
        return this.treeSitterService.getNodeText(classNode, fileContent);
      }
    }
    return null;
  }

  private extractAnnotationName(decorator: Parser.SyntaxNode): string | null {
    // 实现提取注解名逻辑
    if (decorator.children && decorator.children.length > 0) {
      const annotationNode = decorator.children[0];
      if (annotationNode.type === 'identifier') {
        return annotationNode.text || null;
      }
    }
    return null;
  }

  private extractAnnotationParameters(decorator: Parser.SyntaxNode): Record<string, any> {
    // 实现提取注解参数逻辑
    return {};
  }

  private generateSymbolId(symbol: Symbol): string {
    return `${symbol.type}_${Buffer.from(`${symbol.filePath}_${symbol.name}`).toString('hex')}`;
  }

  private generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }
}