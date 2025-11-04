import { SymbolResolver, Symbol } from '../../../symbol/SymbolResolver';
import { TreeSitterService } from '../../../../parser/core/parse/TreeSitterService';
import { LoggerService } from '../../../../../utils/LoggerService';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../../../../types';
import Parser = require('tree-sitter');

@injectable()
export class BaseJavaScriptRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) protected treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) protected logger: LoggerService
  ) { }

  // 共享的辅助方法
  protected generateSymbolId(symbol: Symbol): string {
    return `${symbol.type}_${Buffer.from(`${symbol.filePath}_${symbol.name}`).toString('hex')}`;
  }

  protected generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }

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

  // 辅助方法：查找包含函数
  protected findContainingFunction(node: Parser.SyntaxNode | undefined, filePath: string): Parser.SyntaxNode | null {
    if (!node) return null;

    let currentNode: Parser.SyntaxNode | null = node;
    while (currentNode) {
      if (currentNode.type === 'function_declaration' ||
          currentNode.type === 'method_definition' ||
          currentNode.type === 'arrow_function' ||
          currentNode.type === 'function') {
        return currentNode;
      }
      currentNode = currentNode.parent;
    }
    return null;
  }

  // 辅助方法：提取函数名
  protected extractFunctionNameFromNode(funcNode: Parser.SyntaxNode): string | null {
    for (const child of funcNode.children) {
      if (child.type === 'identifier' || child.type === 'property_identifier') {
        return child.text || null;
      } else if (child.type === 'function_name') {
        return child.text || null;
      }
    }
    return null;
  }
}