import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult, SymbolInfo, SymbolTable } from '../types';
import { generateDeterministicNodeId } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
type StandardType = StandardizedQueryResult['type'];

/**
 * C# 语言适配器
 * 专门处理C#语言的查询结果标准化
 */
export class CSharpLanguageAdapter extends BaseLanguageAdapter {
  // In-memory symbol table for the current file
  private symbolTable: SymbolTable | null = null;

  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  getSupportedQueryTypes(): string[] {
    return [
      // Entity types
      'classes',
      'methods',
      'properties',
      'linq',
      'patterns',
      'expressions',
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
    const typeMapping: Record<string, string> = {// 命名空间和类相关
      'namespace_declaration': 'namespace',
      'file_scoped_namespace_declaration': 'namespace',
      'class_declaration': 'class',
      'record_class_declaration': 'record_class',
      'record_struct_declaration': 'record_struct',
      'struct_declaration': 'struct',
      'interface_declaration': 'interface',
      'enum_declaration': 'enum',
      'record_declaration': 'record',
      'constructor_declaration': 'constructor',
      'destructor_declaration': 'destructor',
      'field_declaration': 'field',
      'event_field_declaration': 'event_field',
      'attribute': 'attribute',
      'attribute_list': 'attribute_list',
      'type_parameter': 'type_parameter',

      // 方法相关
      'method_declaration': 'method',
      'operator_declaration': 'operator',
      'conversion_operator_declaration': 'conversion_operator',
      'lambda_expression': 'lambda',
      'anonymous_method_expression': 'anonymous_method',
      'accessor_declaration': 'accessor',
      'get_accessor_declaration': 'get_accessor',
      'set_accessor_declaration': 'set_accessor',
      'init_accessor_declaration': 'init_accessor',
      'add_accessor_declaration': 'add_accessor',
      'remove_accessor_declaration': 'remove_accessor',
      'invocation_expression': 'invocation',

      // 属性和变量相关
      'property_declaration': 'property',
      'indexer_declaration': 'indexer',
      'event_declaration': 'event',
      'delegate_declaration': 'delegate',
      'local_declaration_statement': 'local_variable',
      'for_each_statement': 'loop_variable',
      'catch_declaration': 'catch_variable',
      'declaration_expression': 'declaration_expression',

      // LINQ相关
      'query_expression': 'linq_expression',
      'from_clause': 'linq_from',
      'where_clause': 'linq_where',
      'select_clause': 'linq_select',
      'group_clause': 'linq_group',
      'order_by_clause': 'linq_order',
      'join_clause': 'linq_join',
      'let_clause': 'linq_let',

      // 模式匹配相关
      'is_pattern_expression': 'pattern_is',
      'switch_expression': 'switch_expression',
      'switch_expression_arm': 'switch_arm',
      'constant_pattern': 'constant_pattern',
      'relational_pattern': 'relational_pattern',
      'var_pattern': 'var_pattern',
      'discard_pattern': 'discard_pattern',
      'binary_pattern': 'binary_pattern',
      'unary_pattern': 'unary_pattern',
      'parenthesized_pattern': 'parenthesized_pattern',
      'list_pattern': 'list_pattern',
      'slice_pattern': 'slice_pattern',
      'recursive_pattern': 'recursive_pattern',
      'positional_pattern': 'positional_pattern',
      'property_pattern_clause': 'property_pattern',
      'subpattern': 'subpattern',
      'switch_statement': 'switch_statement',
      'switch_section': 'switch_section',
      'case_switch_label': 'case_label',
      'default_switch_label': 'default_label',
      'case_pattern_switch_label': 'pattern_label',

      // 表达式相关
      'using_directive': 'using',
      'using_statement': 'using',
      'extern_alias_directive': 'extern_alias',
      'type_parameter_constraints_clause': 'type_constraint',
      'conditional_expression': 'conditional',
      'conditional_access_expression': 'conditional_access',
      'member_binding_expression': 'member_binding',
      'element_binding_expression': 'element_binding',
      'assignment_expression': 'assignment',
      'binary_expression': 'binary_operation',
      'unary_expression': 'unary_operation',
      'update_expression': 'update_operation',
      'cast_expression': 'cast',
      'as_expression': 'as_expression',
      'null_coalescing_expression': 'null_coalescing',
      'throw_expression': 'throw_expression',
      'await_expression': 'await_expression',
      'sizeof_expression': 'sizeof_expression',
      'typeof_expression': 'typeof_expression',
      'nameof_expression': 'nameof_expression',
      'default_expression': 'default_expression',
      'interpolated_string_expression': 'interpolated_string',
      'interpolated_verbatim_string_expression': 'interpolated_verbatim_string',
      'interpolated_string_text': 'interpolated_text',
      'interpolation': 'interpolation',
      'with_expression': 'with_expression',
      'member_access_expression': 'member_access',
      'element_access_expression': 'element_access',
      'object_creation_expression': 'object_creation',
      'anonymous_object_creation_expression': 'anonymous_object_creation',
      'array_creation_expression': 'array_creation',
      'implicit_array_creation_expression': 'implicit_array_creation',
      'stack_alloc_array_creation_expression': 'stackalloc_array_creation',
      'array_type': 'array_type',
      'pointer_type': 'pointer_type',
      'nullable_type': 'nullable_type',
      'tuple_type': 'tuple_type',
      'tuple_element': 'tuple_element',
      'tuple_expression': 'tuple',
      'parenthesized_expression': 'parenthesized',
      'identifier': 'identifier',
      'this_expression': 'this',
      'base_expression': 'base',
      'literal': 'literal',
      'string_literal': 'string_literal',
      'character_literal': 'character_literal',
      'numeric_literal': 'numeric_literal',
      'boolean_literal': 'boolean_literal',
      'null_literal': 'null_literal',
      // 通用标识符映射
      'qualified_name': 'qualified_name',
    };

    return typeMapping[nodeType] || nodeType;
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      'name.definition.namespace',
      'name.definition.class',
      'name.definition.record_class',
      'name.definition.record_struct',
      'name.definition.struct',
      'name.definition.interface',
      'name.definition.enum',
      'name.definition.record',
      'name.definition.constructor',
      'name.definition.destructor',
      'name.definition.field',
      'name.definition.event_field',
      'name.definition.attribute',
      'name.definition.type_parameter',
      'name.definition.method',
      'name.definition.operator',
      'name.definition.conversion_operator',
      'name.definition.accessor',
      'name.definition.get_accessor',
      'name.definition.set_accessor',
      'name.definition.init_accessor',
      'name.definition.add_accessor',
      'name.definition.remove_accessor',
      'name.definition.property',
      'name.definition.indexer',
      'name.definition.event',
      'name.definition.delegate',
      'name.definition.local_variable',
      'name.definition.loop_variable',
      'name.definition.catch_variable',
      'name.definition.declaration_expression',
      'name.definition.linq_from',
      'name.definition.linq_select',
      'name.definition.linq_group',
      'name.definition.linq_join_left',
      'name.definition.linq_join_right',
      'name.definition.linq_let',
      'name.definition.var_pattern',
      'name.definition.using',
      'name.definition.extern_alias',
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

    // 对于C#，尝试从特定字段提取名称
    const mainNode = result.captures?.[0]?.node;
    if (mainNode) {
      // 尝试获取标识符
      const identifier = mainNode.childForFieldName?.('identifier') ||
        mainNode.childForFieldName?.('type_identifier');
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

    // 提取泛型参数
    const typeParameters = mainNode.childForFieldName?.('type_parameters');
    if (typeParameters) {
      extra.hasGenerics = true;
      extra.typeParameters = typeParameters.text;
    }

    // 提取继承信息
    const baseList = mainNode.childForFieldName?.('base_list');
    if (baseList) {
      extra.hasInheritance = true;
      extra.baseTypes = baseList.text;
    }

    // 提取参数信息（对于方法）
    const parameters = mainNode.childForFieldName?.('parameters');
    if (parameters) {
      extra.parameterCount = parameters.childCount;
    }

    // 提取返回类型
    const returnType = mainNode.childForFieldName?.('type');
    if (returnType) {
      extra.returnType = returnType.text;
    }

    // 提取约束信息
    const constraints = mainNode.childForFieldName?.('type_parameter_constraints_clause');
    if (constraints) {
      extra.constraints = constraints.text;
    }

    // 提取属性信息
    const attributeLists = mainNode.childForFieldName?.('attribute_list');
    if (attributeLists) {
      extra.hasAttributes = true;
      extra.attributes = attributeLists.text;
    }

    // 提取异步信息
    if (mainNode.text.includes('async')) {
      extra.isAsync = true;
    }

    // 检查是否是LINQ表达式
    if (mainNode.type === 'query_expression') {
      extra.isLinq = true;
    }

    // 检查是否是模式匹配
    if (mainNode.type === 'switch_expression' || mainNode.type === 'is_pattern_expression') {
      extra.isPatternMatching = true;
    }

    return extra;
  }

  mapQueryTypeToStandardType(queryType: string): StandardType {
    const mapping: Record<string, StandardType> = {
      'classes': 'class',
      'methods': 'method',
      'properties': 'variable',  // 属性映射为变量
      'linq': 'expression',  // LINQ映射为表达式
      'patterns': 'expression',  // 模式匹配映射为表达式
      'expressions': 'expression',
      
      // 关系类型
      'calls': 'call',
      'data-flows': 'data-flow',
      'inheritance': 'inheritance',
      // ... 其他关系类型
      'concurrency-relationships': 'concurrency',
      'control-flow-relationships': 'control-flow',
      'lifecycle-relationships': 'lifecycle',
      'semantic-relationships': 'semantic'
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
    if (nodeType.includes('class') || nodeType.includes('interface') || nodeType.includes('struct')) complexity += 2;
    if (nodeType.includes('method') || nodeType.includes('constructor') || nodeType.includes('destructor')) complexity += 1;
    if (nodeType.includes('generic') || nodeType.includes('template')) complexity += 1;
    if (nodeType.includes('operator')) complexity += 1;
    if (nodeType.includes('linq') || nodeType.includes('query')) complexity += 2;
    if (nodeType.includes('pattern')) complexity += 1;

    // C#特定的复杂度因素
    const text = mainNode.text || '';
    if (text.includes('async') || text.includes('await')) complexity += 1; // 异步
    if (text.includes('lambda') || text.includes('=>')) complexity += 1; // Lambda表达式
    if (text.includes('LINQ') || text.includes('from') || text.includes('select')) complexity += 2; // LINQ
    if (text.includes('pattern') || text.includes('is') || text.includes('switch')) complexity += 1; // 模式匹配
    if (text.includes('generic') || text.includes('<') && text.includes('>')) complexity += 1; // 泛型
    if (text.includes('override')) complexity += 1; // 重写
    if (text.includes('virtual')) complexity += 1; // 虚拟
    if (text.includes('abstract')) complexity += 1; // 抽象
    if (text.includes('interface')) complexity += 1; // 接口
    if (text.includes('delegate')) complexity += 1; // 委托
    if (text.includes('event')) complexity += 1; // 事件

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
    this.findMethodCalls(mainNode, dependencies);

    // 查找LINQ依赖
    this.findLinqDependencies(mainNode, dependencies);

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return modifiers;
    }

    // 检查C#常见的修饰符
    const text = mainNode.text || '';

    if (text.includes('public')) modifiers.push('public');
    if (text.includes('private')) modifiers.push('private');
    if (text.includes('protected')) modifiers.push('protected');
    if (text.includes('internal')) modifiers.push('internal');
    if (text.includes('static')) modifiers.push('static');
    if (text.includes('readonly')) modifiers.push('readonly');
    if (text.includes('const')) modifiers.push('const');
    if (text.includes('virtual')) modifiers.push('virtual');
    if (text.includes('abstract')) modifiers.push('abstract');
    if (text.includes('sealed')) modifiers.push('sealed');
    if (text.includes('override')) modifiers.push('override');
    if (text.includes('async')) modifiers.push('async');
    if (text.includes('await')) modifiers.push('await');
    if (text.includes('extern')) modifiers.push('extern');
    if (text.includes('unsafe')) modifiers.push('unsafe');
    if (text.includes('partial')) modifiers.push('partial');
    if (text.includes('new')) modifiers.push('new');
    if (text.includes('volatile')) modifiers.push('volatile');
    if (text.includes('fixed')) modifiers.push('fixed');
    if (text.includes('lock')) modifiers.push('lock');

    return modifiers;
  }

  // C#特定的辅助方法

  private findMethodCalls(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找方法调用
      if (child.type === 'invocation_expression') {
        const functionNode = child.childForFieldName('function');
        if (functionNode?.text) {
          dependencies.push(functionNode.text);
        }
      }

      this.findMethodCalls(child, dependencies);
    }
  }

  private findLinqDependencies(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找LINQ表达式
      if (child.type === 'query_expression' ||
        child.type === 'from_clause' ||
        child.type === 'where_clause' ||
        child.type === 'select_clause' ||
        child.type === 'group_clause' ||
        child.type === 'order_by_clause' ||
        child.type === 'join_clause') {
        // 提取LINQ方法名
        const text = child.text;
        if (text) {
          dependencies.push('LINQ');
        }
      }

      this.findLinqDependencies(child, dependencies);
    }
  }

  // 重写isBlockNode方法以支持C#特定的块节点类型
  protected isBlockNode(node: any): boolean {
    const csharpBlockTypes = [
      'class_declaration', 'struct_declaration', 'interface_declaration', 'method_declaration',
      'constructor_declaration', 'property_declaration', 'namespace_declaration', 'block',
      'if_statement', 'for_statement', 'while_statement', 'do_statement', 'switch_statement',
      'try_statement', 'catch_clause', 'finally_clause', 'lambda_expression', 'query_expression'
    ];
    return csharpBlockTypes.includes(node.type) || super.isBlockNode(node);
  }

  // 重写normalize方法以集成nodeId生成和符号信息
  async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
    const results: StandardizedQueryResult[] = [];

    // Initialize symbol table for the current processing context
    // In a real scenario, filePath would be passed in. For now, we'll use a placeholder.
    const filePath = 'current_file.cs';
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
        if (['function', 'class', 'method', 'variable', 'import', 'interface', 'type'].includes(standardType)) {
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
        this.logger?.error(`Error normalizing C# result: ${error}`);
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

    // Add parameters for methods
    if (symbolType === 'method') {
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
      if (current.type === 'method_declaration') {
        return 'function';
      }
      if (current.type === 'class_declaration') {
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
        if (child.type === 'parameter') {
          const identifier = child.childForFieldName('name');
          if (identifier) {
            parameters.push(identifier.text);
          }
        }
      }
    }
    return parameters;
  }

  private extractImportPath(node: Parser.SyntaxNode): string | undefined {
    // For C# using directives
    if (node.type === 'using_directive') {
      const pathNode = node.childForFieldName('name');
      return pathNode ? pathNode.text : undefined;
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
    const methodNode = astNode.childForFieldName('function');
    const callerNode = this.findCallerMethodContext(astNode);

    return {
      fromNodeId: callerNode ? generateDeterministicNodeId(callerNode) : 'unknown',
      toNodeId: methodNode ? generateDeterministicNodeId(methodNode) : 'unknown',
      callName: methodNode?.text || 'unknown',
      location: {
        filePath: 'current_file.cs',
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
        filePath: 'current_file.cs',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  private extractInheritanceMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // For C#, this might be for class inheritance or interface implementation
    // This is a placeholder for more complex logic
    return null;
  }

  private findCallerMethodContext(callNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let current = callNode.parent;
    while (current) {
      if (current.type === 'method_declaration') {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  private extractConcurrencyMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // Placeholder for concurrency metadata extraction
    // This would analyze async/await operations, lock statements from the query result
    return {
      type: 'concurrency',
      operation: 'unknown', // e.g., 'async_await', 'lock', 'task'
      location: {
        filePath: 'current_file.cs',
        lineNumber: astNode.startPosition.row + 1,
      }
    };
  }

  private extractLifecycleMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // Placeholder for lifecycle metadata extraction
    // This would analyze object creation, destruction, etc.
    return {
      type: 'lifecycle',
      operation: 'unknown', // e.g., 'create', 'destroy', 'dispose'
      location: {
        filePath: 'current_file.cs',
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
        filePath: 'current_file.cs',
        lineNumber: astNode.startPosition.row + 1,
      }
    };
  }

  // C#特定的数据流关系提取
  extractDataFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'assignment' | 'parameter' | 'return';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'assignment' | 'parameter' | 'return';
    }> = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return relationships;
    }

    // 从捕获中查找数据流关系
    for (const capture of result.captures || []) {
      if (capture.name.includes('source.variable')) {
        const source = capture.node?.text || '';
        const targetCapture = result.captures?.find((c: any) => c.name.includes('target.variable'));
        const target = targetCapture?.node?.text || '';

        if (source && target) {
          relationships.push({
            source,
            target,
            type: 'assignment'
          });
        }
      } else if (capture.name.includes('source.parameter')) {
        const source = capture.node?.text || '';
        const targetCapture = result.captures?.find((c: any) => c.name.includes('target.function'));
        const target = targetCapture?.node?.text || '';

        if (source && target) {
          relationships.push({
            source,
            target,
            type: 'parameter'
          });
        }
      } else if (capture.name.includes('source.variable') && result.captures?.some((c: any) => c.name.includes('data.flow.return'))) {
        const source = capture.node?.text || '';
        
        relationships.push({
          source,
          target: result.captures?.[0]?.node?.parent?.childForFieldName?.('name')?.text || 'unknown',
          type: 'return'
        });
      }
    }

    return relationships;
  }

  // C#特定的控制流关系提取
  extractControlFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'conditional' | 'loop' | 'exception' | 'callback';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'conditional' | 'loop' | 'exception' | 'callback';
    }> = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return relationships;
    }

    const nodeType = mainNode.type;
    
    // 根据节点类型确定控制流类型
    let controlFlowType: 'conditional' | 'loop' | 'exception' | 'callback' | null = null;
    if (nodeType.includes('if') || nodeType.includes('switch')) {
      controlFlowType = 'conditional';
    } else if (nodeType.includes('for') || nodeType.includes('while') || nodeType.includes('foreach')) {
      controlFlowType = 'loop';
    } else if (nodeType.includes('try') || nodeType.includes('catch') || nodeType.includes('throw')) {
      controlFlowType = 'exception';
    } else if (nodeType.includes('lambda') || nodeType.includes('delegate')) {
      controlFlowType = 'callback';
    }

    if (controlFlowType) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('source.condition') || capture.name.includes('source.loop') || 
            capture.name.includes('source.exception') || capture.name.includes('source.lambda')) {
          const source = capture.node?.text || '';
          const targetCapture = result.captures?.find((c: any) => 
            c.name.includes('target.consequence') || 
            c.name.includes('target.loop') || 
            c.name.includes('target.catch') ||
            c.name.includes('target.lambda')
          );
          const target = targetCapture?.node?.text || '';

          if (source && target) {
            relationships.push({
              source,
              target,
              type: controlFlowType
            });
          }
        }
      }
    }

    return relationships;
  }

  // C#特定的语义关系提取
  extractSemanticRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
    }> = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return relationships;
    }

    const nodeType = mainNode.type;
    
    // 检查是否有override修饰符
    if (nodeType.includes('method_declaration') && mainNode.text.includes('override')) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('overridden.method')) {
          const target = capture.node?.text || '';
          const sourceCapture = result.captures?.find((c: any) => 
            c.name.includes('override.modifier') || c.name.includes('method_declaration'));
          const source = sourceCapture?.node?.childForFieldName?.('name')?.text || 'unknown';

          if (source && target) {
            relationships.push({
              source,
              target,
              type: 'overrides'
            });
          }
        }
      }
    } 
    // 检查委托关系
    else if (nodeType.includes('assignment') && mainNode.text.includes('=')) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('target.delegate')) {
          const target = capture.node?.text || '';
          const sourceCapture = result.captures?.find((c: any) => c.name.includes('source.function'));
          const source = sourceCapture?.node?.text || '';

          if (source && target) {
            relationships.push({
              source,
              target,
              type: 'delegates'
            });
          }
        }
      }
    }
    // 检查事件观察关系
    else if (nodeType.includes('assignment') && 
             (mainNode.text.includes('+='))) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('subscriber.event')) {
          const target = capture.node?.text || '';
          const sourceCapture = result.captures?.find((c: any) => c.name.includes('event.handler'));
          const source = sourceCapture?.node?.text || '';

          if (source && target) {
            relationships.push({
              source,
              target,
              type: 'observes'
            });
          }
        }
      }
    }

    return relationships;
  }

  // C#特定的生命周期关系提取
  extractLifecycleRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'instantiates' | 'initializes' | 'destroys' | 'manages';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'instantiates' | 'initializes' | 'destroys' | 'manages';
    }> = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return relationships;
    }

    const nodeType = mainNode.type;
    
    // 检查对象实例化
    if (nodeType.includes('object_creation_expression') || 
        (nodeType.includes('assignment') && mainNode.text.includes('new'))) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('constructed.class')) {
          const target = capture.node?.text || '';
          const sourceCapture = result.captures?.find((c: any) => 
            c.name.includes('target.variable') || 
            c.name.includes('object_creation_expression'));
          const source = sourceCapture?.node?.childForFieldName?.('left')?.text || 'unknown';

          if (source && target) {
            relationships.push({
              source,
              target,
              type: 'instantiates'
            });
          }
        }
      }
    }
    // 检查using语句（资源管理）
    else if (nodeType.includes('using')) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('resource.to.dispose')) {
          const source = capture.node?.text || '';
          const targetCapture = result.captures?.find((c: any) => 
            c.name.includes('using.body') || c.name.includes('using.declaration'));
          const target = targetCapture?.node?.text || '';

          if (source && target) {
            relationships.push({
              source,
              target,
              type: 'manages'
            });
          }
        }
      }
    }
    // 检查Dispose调用
    else if (nodeType.includes('invocation') && mainNode.text.includes('Dispose')) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('resource.object')) {
          const source = capture.node?.text || '';
          
          relationships.push({
            source,
            target: 'resource',
            type: 'destroys'
          });
        }
      }
    }

    return relationships;
  }

  // C#特定的并发关系提取
  extractConcurrencyRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'synchronizes' | 'locks' | 'communicates' | 'races';
  }> {
    const relationships: Array<{
      source: string;
      target: string;
      type: 'synchronizes' | 'locks' | 'communicates' | 'races';
    }> = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return relationships;
    }

    const nodeType = mainNode.type;
    
    // 检查async/await模式
    if (nodeType.includes('await_expression')) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('awaited.expression')) {
          const source = capture.node?.text || '';
          
          relationships.push({
            source,
            target: 'async_context',
            type: 'communicates'
          });
        }
      }
    }
    // 检查lock语句
    else if (nodeType.includes('lock_statement')) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('lock.object')) {
          const source = capture.node?.text || '';
          
          relationships.push({
            source,
            target: 'lock',
            type: 'synchronizes'
          });
        }
      }
    }
    // 检查Monitor方法
    else if (nodeType.includes('invocation') && 
             (mainNode.text.includes('Monitor.Enter') || 
              mainNode.text.includes('Monitor.Exit') ||
              mainNode.text.includes('Wait') ||
              mainNode.text.includes('Pulse'))) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('sync.object')) {
          const source = capture.node?.text || '';
          
          relationships.push({
            source,
            target: 'monitor',
            type: 'synchronizes'
          });
        }
      }
    }
    // 检查Task相关操作
    else if (nodeType.includes('invocation') && 
             (mainNode.text.includes('Task.Run') || 
              mainNode.text.includes('Start') ||
              mainNode.text.includes('Wait'))) {
      for (const capture of result.captures || []) {
        if (capture.name.includes('task.object')) {
          const source = capture.node?.text || '';
          
          relationships.push({
            source,
            target: 'task',
            type: 'communicates'
          });
        }
      }
    }

    return relationships;
  }
}