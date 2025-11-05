import {
  Parser,
  generateDeterministicNodeId
} from '../types';

export class BasePythonRelationshipExtractor {

  // 共享的辅助方法

  protected findCallerSymbol(callExpr: Parser.SyntaxNode, filePath: string): string | null {
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
              return generateDeterministicNodeId(child);
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

  protected determineCallType(callExpr: Parser.SyntaxNode): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' {
    // 实现确定调用类型逻辑
    if (callExpr.parent?.type === 'decorator') {
      return 'decorator';
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

  protected determineReferenceType(identifier: Parser.SyntaxNode): 'variable' | 'constant' | 'parameter' | 'field' {
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

  // 辅助方法
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
      if (child.type !== ',' && child.type !== '(' && child.type !== ')') { // Skip separators
        args.push({
          type: child.type,
          node: child
        });
      }
    }

    return args;
  }
}