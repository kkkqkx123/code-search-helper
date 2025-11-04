import {
  SymbolResolver,
  Symbol,
  SymbolType,
  TreeSitterService,
  LoggerService,
  inject,
  injectable,
  TYPES,
  Parser
} from '../types';

@injectable()
export class BaseRustRelationshipExtractor {
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
      if (currentNode.type === 'function_item') {
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
      isAsync: false, // 暂时不处理异步
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
    // Rust 中的调用主要是函数调用
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
    // 在 Rust 中，结构体嵌入是通过字段声明包含其他结构体来实现的
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

  protected extractUseInfo(useStmt: Parser.SyntaxNode): {
    source: string;
    importedSymbols: string[];
  } | null {
    // 实现提取 use 声明信息逻辑
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

  protected extractImportedSymbols(useList: Parser.SyntaxNode, importedSymbols: string[]): void {
    for (const child of useList.children) {
      if (child.type === 'identifier') {
        importedSymbols.push(child.text || '');
      } else if (child.type === 'scoped_use_list' || child.type === 'use_list') {
        this.extractImportedSymbols(child, importedSymbols);
      }
    }
  }

  protected determineReferenceType(identifier: Parser.SyntaxNode, resolvedSymbol: Symbol): 'variable' | 'constant' | 'parameter' | 'field' | 'function' | 'method' | 'type' | 'enum' | 'class' | 'interface' | 'namespace' {
    // 实现确定引用类型逻辑
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
    } else if (resolvedSymbol.type === SymbolType.VARIABLE) {
      return 'variable';
    } else if (resolvedSymbol.type === SymbolType.PARAMETER) {
      return 'parameter';
    }

    return 'variable';
  }

  protected extractFunctionName(funcDecl: Parser.SyntaxNode): string | null {
    // 提取函数名
    if (funcDecl.type === 'function_item') {
      for (const child of funcDecl.children) {
        if (child.type === 'identifier') {
          return child.text || null;
        }
      }
    }
    return null;
  }

  protected extractMethodName(methodDecl: Parser.SyntaxNode): string | null {
    // 提取方法名
    for (const child of methodDecl.children) {
      if (child.type === 'identifier' || child.type === 'function_name') {
        return child.text || null;
      }
    }
    return null;
  }

  protected extractVariableName(varDecl: Parser.SyntaxNode): string | null {
    // 提取变量名
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
      if (resolvedSymbol && resolvedSymbol.type === SymbolType.CLASS) {
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
      if (resolvedSymbol && resolvedSymbol.type === SymbolType.ENUM) {
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

  protected extractAttributeParameters(attribute: Parser.SyntaxNode): Record<string, any> {
    // 实现提取属性参数逻辑
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

  protected extractAttributeArguments(tokenTree: Parser.SyntaxNode): any[] {
    // 提取属性参数
    const args: any[] = [];

    for (const child of tokenTree.children) {
      args.push({
        type: child.type,
        text: child.text
      });
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

  // 辅助方法：查找包含函数
  protected findContainingFunction(node: Parser.SyntaxNode | undefined, filePath: string): Parser.SyntaxNode | null {
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

  // 辅助方法：提取函数名
  protected extractFunctionNameFromNode(funcNode: Parser.SyntaxNode): string | null {
    for (const child of funcNode.children) {
      if (child.type === 'identifier') {
        return child.text || null;
      }
    }
    return null;
  }
}
