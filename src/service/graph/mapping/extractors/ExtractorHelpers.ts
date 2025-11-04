import { Symbol, SymbolType, Parser } from './types';

/**
 * JavaScript/TypeScript关系提取器的辅助工具类
 * 包含各种通用的辅助方法和工具函数
 */
export class ExtractorHelpers {
  /**
   * 从成员表达式中提取方法名
   */
  static extractMethodNameFromMemberExpression(memberExpr: Parser.SyntaxNode): string | null {
    if (memberExpr.children && memberExpr.children.length > 0) {
      const lastChild = memberExpr.children[memberExpr.children.length - 1];
      if (lastChild.type === 'property_identifier' || lastChild.type === 'identifier') {
        return lastChild.text;
      }
    }
    return null;
  }

  /**
   * 提取类名
   */
  static extractClassName(classDecl: Parser.SyntaxNode): string | null {
    for (const child of classDecl.children) {
      if (child.type === 'identifier' || child.type === 'type_identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  /**
   * 提取接口名 (TypeScript specific)
   */
  static extractInterfaceName(interfaceDecl: Parser.SyntaxNode): string | null {
    for (const child of interfaceDecl.children) {
      if (child.type === 'identifier' || child.type === 'type_identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  /**
   * 提取枚举名
   */
  static extractEnumName(enumDecl: Parser.SyntaxNode): string | null {
    for (const child of enumDecl.children) {
      if (child.type === 'identifier' || child.type === 'type_identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  /**
   * 查找枚举成员
   */
  static findEnumMembers(enumDecl: Parser.SyntaxNode): string[] {
    const members: string[] = [];

    for (const child of enumDecl.children) {
      if (child.type === 'enum_body') {
        for (const bodyChild of child.children) {
          if (bodyChild.type === 'enum_assignment' || bodyChild.type === 'pair') {
            for (const pairChild of bodyChild.children) {
              if (pairChild.type === 'property_identifier' || pairChild.type === 'identifier') {
                members.push(pairChild.text || '');
              }
            }
          }
        }
      }
    }

    return members;
  }

  /**
   * 提取导入信息
   */
  static extractImportInfo(importStmt: Parser.SyntaxNode): {
    source: string;
    importedSymbols: string[];
  } | null {
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

  /**
   * 提取导出信息
   */
  static extractExportInfo(exportStmt: Parser.SyntaxNode): {
    target: string;
    exportedSymbols: string[];
  } | null {
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

  /**
   * 提取导出符号
   */
  static extractExportSpecifiers(node: Parser.SyntaxNode): string[] {
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

  /**
   * 提取导入符号
   */
  static extractImportSpecifiers(node: Parser.SyntaxNode): string[] {
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

  /**
   * 确定引用类型
   */
  static determineReferenceType(identifier: Parser.SyntaxNode, resolvedSymbol: Symbol): 'variable' | 'constant' | 'parameter' | 'field' | 'interface' | 'type' | 'enum' {
    if (resolvedSymbol.type === 'interface') {
      return 'interface';
    } else if (resolvedSymbol.type === 'type') {
      return 'type';
    } else if (resolvedSymbol.type === 'enum') {
      return 'enum';
    } else if (identifier.parent?.type === 'parameter') {
      return 'parameter';
    } else if (identifier.parent?.type === 'property_identifier' &&
      identifier.parent.parent?.type === 'member_expression') {
      return 'field';
    }

    return 'variable';
  }

  /**
   * 从new表达式中提取类名
   */
  static extractClassNameFromNewExpression(newExpr: Parser.SyntaxNode): string | null {
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

  /**
   * 从成员表达式中提取名称
   */
  static extractMemberExpressionName(memberExpr: Parser.SyntaxNode): string | null {
    const parts: string[] = [];
    this.collectMemberExpressionParts(memberExpr, parts);
    return parts.join('.');
  }

  /**
   * 递归收集成员表达式的部分
   */
  static collectMemberExpressionParts(memberExpr: Parser.SyntaxNode, parts: string[]): void {
    for (const child of memberExpr.children) {
      if (child.type === 'identifier' || child.type === 'property_identifier' || child.type === 'type_identifier') {
        parts.unshift(child.text);
      } else if (child.type === 'member_expression') {
        this.collectMemberExpressionParts(child, parts);
      }
    }
  }

  /**
   * 提取注解名
   */
  static extractAnnotationName(decorator: Parser.SyntaxNode): string | null {
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

  /**
   * 提取注解参数
   */
  static extractAnnotationParameters(decorator: Parser.SyntaxNode): Record<string, any> {
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

  /**
   * 提取调用参数
   */
  static extractCallArguments(callExpr: Parser.SyntaxNode): any[] {
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

  /**
   * 从类型注解节点提取类型名
   */
  static extractTypeName(typeNode: Parser.SyntaxNode): string | null {
    if (typeNode.children && typeNode.children.length > 0) {
      for (const child of typeNode.children) {
        if (child.type === 'type_identifier' || child.type === 'identifier') {
          return child.text || null;
        }
      }
    }
    return null;
  }

  /**
   * 提取函数名
   */
  static extractFunctionName(funcDecl: Parser.SyntaxNode): string | null {
    for (const child of funcDecl.children) {
      if (child.type === 'identifier' || child.type === 'property_identifier') {
        return child.text || null;
      } else if (child.type === 'function_name') {
        return child.text || null;
      }
    }
    return null;
  }

  /**
   * 提取方法名
   */
  static extractMethodName(methodDecl: Parser.SyntaxNode): string | null {
    for (const child of methodDecl.children) {
      if (child.type === 'property_identifier' || child.type === 'identifier') {
        return child.text || null;
      }
    }
    return null;
  }

  /**
   * 提取泛型类型名
   */
  static extractGenericTypeName(genericType: Parser.SyntaxNode): string | null {
    if (genericType.children && genericType.children.length > 0) {
      const typeNode = genericType.children[0];
      if (typeNode.type === 'type_identifier' || typeNode.type === 'identifier') {
        return typeNode.text || null;
      }
    }
    return null;
  }

  /**
   * 提取泛型参数
   */
  static extractTypeArguments(genericType: Parser.SyntaxNode): string[] {
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

  /**
   * 从对象字面量推断类型
   */
  static inferObjectType(objectLiteral: Parser.SyntaxNode): string | null {
    // This is a simplified implementation - in a real system you might look at properties
    // or assign a generic "Object" type
    return 'Object';
  }

  /**
   * 查找包含函数
   */
  static findContainingFunction(node: Parser.SyntaxNode | undefined): Parser.SyntaxNode | null {
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

  /**
   * 从函数节点提取函数名
   */
  static extractFunctionNameFromNode(funcNode: Parser.SyntaxNode): string | null {
    for (const child of funcNode.children) {
      if (child.type === 'identifier' || child.type === 'property_identifier') {
        return child.text || null;
      } else if (child.type === 'function_name') {
        return child.text || null;
      }
    }
    return null;
  }

  /**
   * 生成符号ID
   */
  static generateSymbolId(symbol: Symbol): string {
    return `${symbol.type}_${Buffer.from(`${symbol.filePath}_${symbol.name}`).toString('hex')}`;
  }

  /**
   * 生成节点ID
   */
  static generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }
}