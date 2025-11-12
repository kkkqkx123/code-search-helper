import { SymbolInfo, SymbolTable } from '../../types';
import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
import { C_NAME_CAPTURES, C_FUNCTION_NODE_TYPES, C_BLOCK_NODE_TYPES } from './constants';

/**
 * C语言适配器辅助方法
 * 包含名称提取、依赖查找、符号信息创建等通用方法
 */
export class CHelperMethods {
  /**
   * 从查询结果中提取名称
   */
  static extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    for (const captureName of C_NAME_CAPTURES) {
      const capture = result.captures?.find((c: any) => c.name === captureName);
      if (capture?.node?.text) {
        return capture.node.text;
      }
    }

    // 如果没有找到名称捕获，尝试从主节点提取
    if (result.captures?.[0]?.node?.childForFieldName?.('name')?.text) {
      return result.captures[0].node.childForFieldName('name').text;
    }

    // 对于C语言，尝试从特定字段提取名称
    const mainNode = result.captures?.[0]?.node;
    if (mainNode) {
      // 尝试获取标识符
      const identifier = mainNode.childForFieldName?.('identifier') ||
        mainNode.childForFieldName?.('type_identifier') ||
        mainNode.childForFieldName?.('field_identifier');
      if (identifier?.text) {
        return identifier.text;
      }

      // 尝试获取name字段
      const nameNode = mainNode.childForFieldName?.('name');
      if (nameNode?.text) {
        return nameNode.text;
      }
    }

    return 'unnamed';
  }

  /**
   * 查找调用者函数上下文
   */
  static findCallerFunctionContext(callNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let current = callNode.parent;
    while (current) {
      if (C_FUNCTION_NODE_TYPES.includes(current.type)) {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * 判断是否为函数节点
   */
  static isFunctionNode(node: Parser.SyntaxNode): boolean {
    return C_FUNCTION_NODE_TYPES.includes(node.type);
  }

  /**
   * 判断是否为块节点
   */
  static isBlockNode(node: Parser.SyntaxNode): boolean {
    return C_BLOCK_NODE_TYPES.includes(node.type);
  }

  /**
   * 查找函数调用
   */
  static findFunctionCalls(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找函数调用
      if (child.type === 'call_expression') {
        const functionNode = child.childForFieldName('function');
        if (functionNode?.text) {
          dependencies.push(functionNode.text);
        }
      }

      this.findFunctionCalls(child, dependencies);
    }
  }

  /**
   * 查找类型引用
   */
  static findTypeReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找类型引用
      if (child.type === 'type_identifier' || child.type === 'struct_specifier' || child.type === 'union_specifier') {
        if (child.text) {
          dependencies.push(child.text);
        }
      }

      this.findTypeReferences(child, dependencies);
    }
  }

  /**
   * 创建符号信息
   */
  static createSymbolInfo(
    node: Parser.SyntaxNode | undefined,
    name: string,
    standardType: string,
    filePath: string
  ): SymbolInfo | null {
    if (!name || !node) return null;

    const symbolType = this.mapToSymbolType(standardType);

    const symbolInfo: SymbolInfo = {
      name,
      type: symbolType,
      filePath,
      location: {
        startLine: node.startPosition.row + 1,
        startColumn: node.startPosition.column,
        endLine: node.endPosition.row + 1,
        endColumn: node.endPosition.column,
      },
      scope: this.determineScope(node)
    };

    // Add parameters for functions
    if (symbolType === 'function' || symbolType === 'method') {
      symbolInfo.parameters = this.extractParameters(node);
    }

    // Add source path for imports
    if (symbolType === 'import') {
      symbolInfo.sourcePath = this.extractImportPath(node);
    }

    return symbolInfo;
  }

  /**
   * 将标准类型映射为符号类型
   */
  static mapToSymbolType(standardType: string): SymbolInfo['type'] {
    const mapping: Record<string, SymbolInfo['type']> = {
      'function': 'function',
      'method': 'method',
      'class': 'class',
      'interface': 'interface',
      'variable': 'variable',
      'import': 'import'
    };
    return mapping[standardType] || 'variable';
  }

  /**
   * 确定符号作用域
   */
  static determineScope(node: Parser.SyntaxNode): SymbolInfo['scope'] {
    // Simplified scope determination. A real implementation would traverse up the AST.
    let current = node.parent;
    while (current) {
      if (current.type === 'function_definition') {
        return 'function';
      }
      if (current.type === 'struct_specifier') {
        return 'class';
      }
      current = current.parent;
    }
    return 'global';
  }

  /**
   * 提取函数参数
   */
  static extractParameters(node: Parser.SyntaxNode): string[] {
    const parameters: string[] = [];
    const parameterList = node.childForFieldName?.('parameters');
    if (parameterList) {
      for (const child of parameterList.children) {
        if (child.type === 'parameter_declaration') {
          const declarator = child.childForFieldName('declarator');
          if (declarator?.text) {
            parameters.push(declarator.text);
          }
        }
      }
    }
    return parameters;
  }

  /**
   * 提取导入路径
   */
  static extractImportPath(node: Parser.SyntaxNode): string | undefined {
    // For C preprocessor include
    if (node.type === 'preproc_include') {
      const pathNode = node.childForFieldName('path');
      return pathNode ? pathNode.text.replace(/[<>"]/g, '') : undefined;
    }
    return undefined;
  }

  /**
   * 提取调用名称
   */
  static extractCalleeName(callExpr: Parser.SyntaxNode): string | null {
    const functionNode = callExpr.childForFieldName('function');
    return functionNode?.text || null;
  }

  /**
   * 确定调用类型
   */
  static determineCallType(callExpr: Parser.SyntaxNode, resolvedSymbol: any): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' {
    // C语言中主要是函数调用
    if (resolvedSymbol) {
      if (resolvedSymbol.type === 'method') {
        return 'method';
      } else if (resolvedSymbol.type === 'function') {
        return 'function';
      }
    }

    return 'function';
  }

  /**
   * 分析调用上下文
   */
  static analyzeCallContext(callExpr: Parser.SyntaxNode): {
    isChained: boolean;
    chainDepth?: number;
    isAsync: boolean;
  } {
    const isChained = callExpr.parent?.type === 'call_expression' || callExpr.parent?.type === 'field_expression';
    const isAsync = false; // C语言没有原生异步支持

    return {
      isChained,
      isAsync,
      chainDepth: isChained ? this.calculateChainDepth(callExpr) : 0
    };
  }

  /**
   * 计算调用链深度
   */
  static calculateChainDepth(node: Parser.SyntaxNode): number {
    let depth = 0;
    let current = node;
    while (current.parent && (current.parent.type === 'call_expression' || current.parent.type === 'field_expression')) {
      depth++;
      current = current.parent;
    }
    return depth;
  }

  /**
   * 提取语言特定元数据
   */
  static extractLanguageSpecificMetadata(result: any): Record<string, any> {
    const extra: Record<string, any> = {};
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return extra;
    }

    // 提取参数信息（对于函数）
    const parameters = mainNode.childForFieldName?.('parameters');
    if (parameters) {
      extra.parameterCount = parameters.childCount;
    }

    // 提取返回类型
    const returnType = mainNode.childForFieldName?.('type');
    if (returnType) {
      extra.returnType = returnType.text;
    }

    // 提取存储类说明符
    const storageClass = mainNode.childForFieldName?.('storage_class_specifier');
    if (storageClass) {
      extra.storageClass = storageClass.text;
    }

    // 提取类型限定符
    const typeQualifier = mainNode.childForFieldName?.('type_qualifier');
    if (typeQualifier) {
      extra.typeQualifier = typeQualifier.text;
    }

    // 检查是否是宏定义
    if (mainNode.type === 'preproc_def' || mainNode.type === 'preproc_function_def') {
      extra.isMacro = true;
    }

    // 检查是否是指针
    const text = mainNode.text || '';
    if (text.includes('*')) {
      extra.isPointer = true;
    }

    return extra;
  }

  /**
   * 计算复杂度
   */
  static calculateComplexity(result: any, baseComplexity: number): number {
    let complexity = baseComplexity;

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return complexity;
    }

    // 基于节点类型增加复杂度
    const nodeType = mainNode.type;
    if (nodeType.includes('function')) complexity += 1;
    if (nodeType.includes('struct') || nodeType.includes('union') || nodeType.includes('enum')) complexity += 1;

    // C语言特定的复杂度因素
    const text = mainNode.text || '';
    if (text.includes('pointer') || text.includes('*')) complexity += 1; // 指针
    if (text.includes('static')) complexity += 1; // 静态
    if (text.includes('extern')) complexity += 1; // 外部
    if (text.includes('const')) complexity += 1; // 常量
    if (text.includes('volatile')) complexity += 1; // 易变
    if (text.includes('->') || text.includes('.')) complexity += 1; // 成员访问
    if (text.includes('sizeof')) complexity += 1; // 尺寸计算
    if (text.includes('malloc') || text.includes('free')) complexity += 1; // 内存管理
    if (text.includes('thread') || text.includes('mutex')) complexity += 2; // 多线程
    if (text.includes('signal')) complexity += 1; // 信号处理

    return complexity;
  }

  /**
   * 提取修饰符
   */
  static extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return modifiers;
    }

    // 检查C语言常见的修饰符
    const text = mainNode.text || '';

    if (text.includes('static')) modifiers.push('static');
    if (text.includes('extern')) modifiers.push('extern');
    if (text.includes('const')) modifiers.push('const');
    if (text.includes('volatile')) modifiers.push('volatile');
    if (text.includes('inline')) modifiers.push('inline');
    if (text.includes('register')) modifiers.push('register');
    if (text.includes('auto')) modifiers.push('auto');
    if (text.includes('restrict')) modifiers.push('restrict');
    if (text.includes('_Atomic')) modifiers.push('atomic');
    if (text.includes('thread_local')) modifiers.push('thread_local');
    if (text.includes('_Noreturn')) modifiers.push('_Noreturn');
    if (text.includes('_Thread_local')) modifiers.push('_Thread_local');
    if (text.includes('__attribute__')) modifiers.push('attribute');

    return modifiers;
  }
}