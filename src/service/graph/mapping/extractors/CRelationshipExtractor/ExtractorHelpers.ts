import { Parser } from '../types';

/**
 * C语言关系提取器的辅助工具类
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

  /**
   * 提取包含信息
   */
  static extractIncludeInfo(includeStmt: Parser.SyntaxNode): {
    source: string;
    importedSymbols: string[];
  } | null {
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

  /**
   * 确定引用类型
   */
  static determineReferenceType(identifier: Parser.SyntaxNode): 'variable' | 'constant' | 'parameter' | 'field' | 'type' | 'enum' {
    if (identifier.parent?.type === 'parameter_declaration') {
      return 'parameter';
    } else if (identifier.parent?.type === 'field_identifier' ||
      identifier.parent?.parent?.type === 'field_expression') {
      return 'field';
    }

    return 'variable';
  }

  /**
   * 提取函数名
   */
  static extractFunctionName(funcDecl: Parser.SyntaxNode): string | null {
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

  /**
   * 提取变量名
   */
  static extractVariableName(varDecl: Parser.SyntaxNode): string | null {
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

  /**
   * 提取属性参数
   */
  static extractAttributeParameters(attribute: Parser.SyntaxNode): Record<string, any> {
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

  /**
   * 提取调用参数
   */
  static extractCallArguments(argList: Parser.SyntaxNode): any[] {
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

  /**
   * 查找包含函数
   */
  static findContainingFunction(node: Parser.SyntaxNode | undefined, filePath: string): Parser.SyntaxNode | null {
    if (!node) return null;

    let currentNode: Parser.SyntaxNode | null = node;
    while (currentNode) {
      if (currentNode.type === 'function_definition') {
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
      if (child.type === 'function_declarator') {
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

  /**
   * 生成节点ID
   */
  static generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }
}