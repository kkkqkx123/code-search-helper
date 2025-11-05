import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult, SymbolInfo, SymbolTable } from '../types';
type StandardType = StandardizedQueryResult['type'];
import { generateDeterministicNodeId } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';

/**
 * C 语言适配器
 * 专门处理C语言的查询结果标准化
 */
export class CLanguageAdapter extends BaseLanguageAdapter {
  // In-memory symbol table for the current file
  private symbolTable: SymbolTable | null = null;

  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  getSupportedQueryTypes(): string[] {
    return [
      // Entity types
      'functions',
      'structs',
      'variables',
      'preprocessor',
      'control-flow',
      // Relationship types
      'calls',
      'data-flows',
      'inheritance',
      // Advanced relationship types
      'concurrency-relationships',
      'control-flow-relationships',
      'lifecycle-relationships',
      'semantic-relationships'
    ];
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {
      // 函数相关
      'function_definition': 'function',
      'function_declarator': 'function',
      'parameter_declaration': 'parameter',
      'call_expression': 'call',

      // 结构体和类型相关
      'struct_specifier': 'struct',
      'union_specifier': 'union',
      'enum_specifier': 'enum',
      'type_definition': 'type',
      'field_declaration': 'field',
      'array_declarator': 'array',
      'pointer_declarator': 'pointer',
      'field_expression': 'member',
      'subscript_expression': 'subscript',

      // 变量相关
      'declaration': 'variable',
      'init_declarator': 'variable',
      'assignment_expression': 'assignment',

      // 预处理器相关
      'preproc_def': 'macro',
      'preproc_function_def': 'macro',
      'preproc_include': 'include',
      'preproc_if': 'preproc_condition',
      'preproc_ifdef': 'preproc_ifdef',
      'preproc_elif': 'preproc_condition',
      'preproc_else': 'preproc_else',

      // 控制流相关
      'if_statement': 'control_statement',
      'for_statement': 'control_statement',
      'while_statement': 'control_statement',
      'do_statement': 'control_statement',
      'switch_statement': 'control_statement',
      'case_statement': 'control_statement',
      'break_statement': 'control_statement',
      'continue_statement': 'control_statement',
      'return_statement': 'control_statement',
      'goto_statement': 'control_statement',
      'labeled_statement': 'label',
      'compound_statement': 'compound_statement',

      // 表达式相关
      'binary_expression': 'binary_expression',
      'unary_expression': 'unary_expression',
      'update_expression': 'update_expression',
      'cast_expression': 'cast_expression',
      'sizeof_expression': 'sizeof_expression',
      'parenthesized_expression': 'parenthesized_expression',
      'comma_expression': 'comma_expression',
      'conditional_expression': 'conditional_expression',
      'generic_expression': 'generic_expression',
      'alignas_qualifier': 'alignas_qualifier',
      'alignof_expression': 'alignof_expression',
      'extension_expression': 'extension_expression',

      // 字面量和类型
      'comment': 'comment',
      'number_literal': 'number_literal',
      'string_literal': 'string_literal',
      'char_literal': 'char_literal',
      'true': 'boolean_literal',
      'false': 'boolean_literal',
      'null': 'null_literal',
      'type_qualifier': 'type_qualifier',
      'storage_class_specifier': 'storage_class',
      'primitive_type': 'primitive_type',
      // 通用标识符映射
      'identifier': 'identifier',
      'type_identifier': 'type_identifier',
      'field_identifier': 'field_identifier',
      'parameter_list': 'parameter_list',
      'statement_identifier': 'statement_identifier',
      'system_lib_string': 'system_lib_string',
      '_': 'wildcard',
    };

    return typeMapping[nodeType] || nodeType;
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      'name.definition.function',
      'name.definition.struct',
      'name.definition.union',
      'name.definition.enum',
      'name.definition.type',
      'name.definition.field',
      'name.definition.array',
      'name.definition.pointer',
      'name.definition.member',
      'name.definition.subscript',
      'name.definition.variable',
      'name.definition.assignment',
      'name.definition.macro',
      'name.definition.include',
      'name.definition.preproc_condition',
      'name.definition.preproc_ifdef',
      'name.definition.label',
      'name',
      'identifier'
    ];

    for (const captureName of nameCaptures) {
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

  extractLanguageSpecificMetadata(result: any): Record<string, any> {
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

  mapQueryTypeToStandardType(queryType: string): StandardType {
    const mapping: Record<string, StandardType> = {
      'functions': 'function',
      'structs': 'class',  // 结构体映射为类
      'variables': 'variable',
      'preprocessor': 'expression',  // 预处理器映射为表达式
      'control-flow': 'control-flow',
      'calls': 'call',
      'data-flows': 'data-flow',
      'inheritance': 'inheritance'
    };

    return mapping[queryType] || 'expression';
  }

  calculateComplexity(result: any): number {
    let complexity = this.calculateBaseComplexity(result);

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

  extractDependencies(result: any): string[] {
    const dependencies: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return dependencies;
    }

    // 查找类型引用
    this.findTypeReferences(mainNode, dependencies);

    // 查找函数调用引用
    this.findFunctionCalls(mainNode, dependencies);

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
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

  // 重写normalize方法以集成nodeId生成和符号信息
  async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
    const results: StandardizedQueryResult[] = [];

    // Initialize symbol table for the current processing context
    // In a real scenario, filePath would be passed in. For now, we'll use a placeholder.
    const filePath = 'current_file.c';
    this.symbolTable = {
      filePath,
      globalScope: { symbols: new Map() },
      imports: new Map()
    };

    for (const result of queryResults) {
      try {
        const standardType = this.mapQueryTypeToStandardType(queryType);
        const name = this.extractName(result);
        const content = this.extractContent(result);
        const complexity = this.calculateComplexity(result);
        const dependencies = this.extractDependencies(result);
        const modifiers = this.extractModifiers(result);
        const extra = this.extractLanguageSpecificMetadata(result);

        // 获取AST节点以生成确定性ID
        const astNode = result.captures?.[0]?.node;
        const nodeId = astNode ? generateDeterministicNodeId(astNode) : `${standardType}:${name}:${Date.now()}`;

        let symbolInfo: SymbolInfo | null = null;
        let relationshipMetadata: any = null;

        // Only create symbol info for entity types, not relationships
        if (['function', 'class', 'method', 'variable', 'import', 'union', 'enum'].includes(standardType)) {
          symbolInfo = this.createSymbolInfo(astNode, name, standardType, filePath);
          if (this.symbolTable && symbolInfo) {
            this.symbolTable.globalScope.symbols.set(name, symbolInfo);
          }
        } else {
          // For relationships, extract specific metadata
          relationshipMetadata = this.extractRelationshipMetadata(result, standardType, astNode);
        }

        results.push({
          nodeId,
          type: standardType,
          name,
          startLine: result.startLine || 1,
          endLine: result.endLine || 1,
          content,
          metadata: {
            language,
            complexity,
            dependencies,
            modifiers,
            extra: {
              ...extra,
              ...relationshipMetadata // Merge relationship-specific metadata
            }
          },
          symbolInfo: symbolInfo || undefined
        });
      } catch (error) {
        this.logger?.error(`Error normalizing C language result: ${error}`);
      }
    }

    return results;
  }

  private createSymbolInfo(node: Parser.SyntaxNode | undefined, name: string, standardType: string, filePath: string): SymbolInfo | null {
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

  private mapToSymbolType(standardType: string): SymbolInfo['type'] {
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

  private determineScope(node: Parser.SyntaxNode): SymbolInfo['scope'] {
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

  private extractParameters(node: Parser.SyntaxNode): string[] {
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

  private extractImportPath(node: Parser.SyntaxNode): string | undefined {
    // For C preprocessor include
    if (node.type === 'preproc_include') {
      const pathNode = node.childForFieldName('path');
      return pathNode ? pathNode.text.replace(/[<>"]/g, '') : undefined;
    }
    return undefined;
  }

  private extractRelationshipMetadata(result: any, standardType: string, astNode: Parser.SyntaxNode | undefined): any {
    if (!astNode) return null;

    switch (standardType) {
      case 'call':
        return this.extractCallMetadata(result, astNode);
      case 'data-flow':
        return this.extractDataFlowMetadata(result, astNode);
      case 'inheritance':
        return this.extractInheritanceMetadata(result, astNode);
      case 'concurrency':
        return this.extractConcurrencyMetadata(result, astNode);
      case 'lifecycle':
        return this.extractLifecycleMetadata(result, astNode);
      case 'semantic':
        return this.extractSemanticMetadata(result, astNode);
      default:
        return null;
    }
  }

  private extractCallMetadata(result: any, astNode: Parser.SyntaxNode): any {
    const functionNode = astNode.childForFieldName('function');
    const callerNode = this.findCallerFunctionContext(astNode);

    return {
      fromNodeId: callerNode ? generateDeterministicNodeId(callerNode) : 'unknown',
      toNodeId: functionNode ? generateDeterministicNodeId(functionNode) : 'unknown',
      callName: functionNode?.text || 'unknown',
      location: {
        filePath: 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  private extractDataFlowMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // Simplified data flow extraction
    const left = astNode.childForFieldName('left');
    const right = astNode.childForFieldName('right');

    return {
      fromNodeId: right ? generateDeterministicNodeId(right) : 'unknown',
      toNodeId: left ? generateDeterministicNodeId(left) : 'unknown',
      flowType: 'assignment',
      location: {
        filePath: 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  private extractInheritanceMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // For C, this might be for struct composition or other patterns
    // This is a placeholder for more complex logic
    return null;
  }

  private findCallerFunctionContext(callNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let current = callNode.parent;
    while (current) {
      if (current.type === 'function_definition') {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  private extractConcurrencyMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // Placeholder for concurrency metadata extraction
    // This would analyze thread, mutex, semaphore operations from the query result
    return {
      type: 'concurrency',
      operation: 'unknown', // e.g., 'lock', 'unlock', 'create_thread'
      location: {
        filePath: 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
      }
    };
  }

  private extractLifecycleMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // Placeholder for lifecycle metadata extraction
    // This would analyze memory allocation, file operations, etc.
    return {
      type: 'lifecycle',
      operation: 'unknown', // e.g., 'allocate', 'deallocate', 'open', 'close'
      location: {
        filePath: 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
      }
    };
  }

  private extractSemanticMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // Placeholder for semantic metadata extraction
    // This would analyze design patterns, error handling, etc.
    return {
      type: 'semantic',
      pattern: 'unknown', // e.g., 'singleton', 'factory', 'observer'
      location: {
        filePath: 'current_file.c',
        lineNumber: astNode.startPosition.row + 1,
      }
    };
  }

  // C语言特定的辅助方法

  private findFunctionCalls(node: any, dependencies: string[]): void {
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

  protected findTypeReferences(node: any, dependencies: string[]): void {
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

  // 重写isBlockNode方法以支持C语言特定的块节点类型
  protected isBlockNode(node: any): boolean {
    const cBlockTypes = [
      'compound_statement', 'function_definition', 'if_statement', 'for_statement',
      'while_statement', 'do_statement', 'switch_statement', 'struct_specifier', 'union_specifier'
    ];
    return cBlockTypes.includes(node.type) || super.isBlockNode(node);
  }
}
