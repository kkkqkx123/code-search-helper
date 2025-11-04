import { Symbol, SymbolType, Parser } from '../types';

/**
 * Rust语言关系提取器的辅助工具类
 * 包含各种通用的辅助方法和工具函数
 */
export class ExtractorHelpers {
  /**
   * 从字段表达式中提取字段名
   */
  static extractFieldNameFromFieldExpression(fieldExpr: Parser.SyntaxNode): string | null {
    if (fieldExpr.children && fieldExpr.children.length > 0) {
      const lastChild = fieldExpr.children[fieldExpr.children.length - 1];
      if (lastChild.type === 'field_identifier' || lastChild.type === 'identifier') {
        return lastChild.text;
      }
    }
    return null;
  }

  /**
   * 提取结构体名
   */
  static extractStructName(structDecl: Parser.SyntaxNode): string | null {
    for (const child of structDecl.children) {
      if (child.type === 'type_identifier' || child.type === 'identifier') {
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
      if (child.type === 'type_identifier' || child.type === 'identifier') {
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
      if (child.type === 'enum_variant_list') {
        for (const listChild of child.children) {
          if (listChild.type === 'enum_variant') {
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

  /**
   * 提取 use 声明信息
   */
  static extractUseInfo(useStmt: Parser.SyntaxNode): {
    source: string;
    importedSymbols: string[];
  } | null {
    let source = '';
    const importedSymbols: string[] = [];

    for (const child of useStmt.children) {
      // Find the source path
      if (child.type === 'scoped_identifier' || child.type === 'identifier') {
        source = child.text;
      } else if (child.type === 'use_list') {
        // Extract imported symbols
        this.extractImportedSymbols(child, importedSymbols);
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
   * 递归提取导入的符号
   */
  static extractImportedSymbols(useList: Parser.SyntaxNode, importedSymbols: string[]): void {
    for (const child of useList.children) {
      if (child.type === 'identifier') {
        importedSymbols.push(child.text || '');
      } else if (child.type === 'scoped_use_list' || child.type === 'use_list') {
        this.extractImportedSymbols(child, importedSymbols);
      }
    }
  }

  /**
   * 确定引用类型
   */
  static determineReferenceType(identifier: Parser.SyntaxNode, resolvedSymbol: Symbol): 'variable' | 'constant' | 'parameter' | 'field' | 'function' | 'method' | 'type' | 'enum' | 'class' | 'interface' | 'namespace' {
    if (resolvedSymbol.type === SymbolType.TYPE || resolvedSymbol.type === SymbolType.CLASS) {
      return 'type';
    } else if (resolvedSymbol.type === SymbolType.ENUM) {
      return 'enum';
    } else if (identifier.parent?.type === 'parameter' || identifier.parent?.type === 'parameter_list') {
      return 'parameter';
    } else if (identifier.parent?.type === 'field_identifier' &&
      identifier.parent.parent?.type === 'field_expression') {
      return 'field';
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

  /**
   * 提取函数名
   */
  static extractFunctionName(funcDecl: Parser.SyntaxNode): string | null {
    if (funcDecl.type === 'function_item') {
      for (const child of funcDecl.children) {
        if (child.type === 'identifier') {
          return child.text || null;
        }
      }
    }
    return null;
  }

  /**
   * 提取变量名
   */
  static extractVariableName(varDecl: Parser.SyntaxNode): string | null {
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

  /**
   * 提取类型名
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
   * 提取属性名
   */
  static extractAttributeName(attribute: Parser.SyntaxNode): string | null {
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

  /**
   * 提取属性参数
   */
  static extractAttributeParameters(attribute: Parser.SyntaxNode): Record<string, any> {
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

  /**
   * 提取属性参数
   */
  static extractAttributeArguments(tokenTree: Parser.SyntaxNode): any[] {
    const args: any[] = [];

    for (const child of tokenTree.children) {
      args.push({
        type: child.type,
        text: child.text
      });
    }

    return args;
  }

  /**
   * 查找包含函数
   */
  static findContainingFunction(node: Parser.SyntaxNode | undefined, filePath: string): Parser.SyntaxNode | null {
    if (!node) return null;

    let currentNode: Parser.SyntaxNode | null = node;
    while (currentNode) {
      if (currentNode.type === 'function_item') {
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
      if (child.type === 'identifier') {
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
