import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult, SymbolInfo, SymbolTable } from '../types';
import { generateDeterministicNodeId } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
type StandardType = StandardizedQueryResult['type'];

/**
 * Python语言适配器
 * 处理Python特定的查询结果标准化
 */
export class PythonLanguageAdapter extends BaseLanguageAdapter {
  // In-memory symbol table for the current file
  private symbolTable: SymbolTable | null = null;

  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  getSupportedQueryTypes(): string[] {
    return [
      // Entity types
      'functions',
      'classes',
      'variables',
      'imports',
      'control-flow',
      'data-structures',
      'types-decorators',
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
      'function_definition': 'functionDeclaration',
      'async_function_definition': 'functionDeclaration',
      'decorated_definition': 'functionDeclaration', // 默认为函数，后续会根据内容调整
      'method_definition': 'methodDeclaration',
      'lambda': 'lambdaExpression',
      
      // 类相关
      'class_definition': 'classDeclaration',
      'class_pattern': 'classDeclaration',
      
      // 导入相关
      'import_statement': 'importDeclaration',
      'import_from_statement': 'importDeclaration',
      'relative_import': 'importDeclaration',
      'wildcard_import': 'importDeclaration',
      'dotted_name': 'memberExpression',
      
      // 变量相关
      'assignment': 'variableDeclaration',
      'annotated_assignment': 'variableDeclaration',
      'augmented_assignment': 'variableDeclaration',
      'named_expression': 'expression',
      
      // 控制流相关
      'for_statement': 'controlFlow',
      'while_statement': 'controlFlow',
      'if_statement': 'controlFlow',
      'try_statement': 'controlFlow',
      'with_statement': 'controlFlow',
      'break_statement': 'controlFlow',
      'continue_statement': 'controlFlow',
      'return_statement': 'controlFlow',
      'raise_statement': 'controlFlow',
      'assert_statement': 'controlFlow',
      'expression_statement': 'controlFlow',
      'type_alias_statement': 'typeAnnotation',
      'global_statement': 'controlFlow',
      'nonlocal_statement': 'controlFlow',
      
      // 表达式相关
      'call': 'callExpression',
      'attribute': 'memberExpression',
      'subscript': 'memberExpression',
      'binary_operator': 'expression',
      'yield': 'expression',
      'type': 'typeAnnotation',
      'parameters': 'typeAnnotation',
      'default_parameter': 'typeAnnotation',
      'typed_parameter': 'typeAnnotation',
      'typed_default_parameter': 'typeAnnotation',
      'decorator': 'decorator',
      'comment': 'comment',
      'string': 'literal',
      'integer': 'literal',
      'float': 'literal',
      'true': 'literal',
      'false': 'literal',
      'none': 'literal',
      'ellipsis': 'literal',
      'list': 'variableDeclaration',
      'tuple': 'variableDeclaration',
      'set': 'variableDeclaration',
      'dictionary': 'variableDeclaration',
      'list_comprehension': 'expression',
      'dictionary_comprehension': 'expression',
      'set_comprehension': 'expression',
      'generator_expression': 'lambdaExpression',
      'parenthesized_expression': 'expression',
      'expression_list': 'expression',
      'slice': 'expression',
      'tuple_pattern': 'pattern',
      'list_pattern': 'pattern',
      'dict_pattern': 'pattern',
      'union_type': 'typeAnnotation',
      'generic_type': 'genericTypes',
      'argument_list': 'callExpression',
      
      // 其他
      'identifier': 'propertyIdentifier',
      'block': 'block'
    };
    
    return typeMapping[nodeType] || 'expression';
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      // 基础捕获
      'name.definition.function',
      'name.definition.class',
      'name.definition.variable',
      'name.definition.import',
      'name.definition.if',
      'name.definition.binary_operator',
      'name.definition.list_comprehension',
      'name.definition.type_annotation',
      
      // 函数相关
      'name.definition.async_function',
      'name.definition.method',
      'name.definition.async_method',
      'name.definition.lambda',
      'name.definition.generator',
      'name.definition.async_generator',
      'name.definition.typed_function',
      'name.definition.typed_async_function',
      'name.definition.test',
      'name.definition.dunder_method',
      'name.definition.private_method',
      
      // 类相关
      'name.definition.class',
      'name.definition.superclass',
      'name.definition.property',
      'name.definition.static_method',
      'name.definition.class_method',
      
      // 变量相关
      'name.definition.variable',
      'name.definition.constant',
      'name.definition.typed_variable',
      'name.definition.augmented_assignment',
      'name.definition.named_expression',
      'name.definition.pattern_variable',
      'name.definition.attribute_variable',
      'name.definition.subscript_variable',
      'name.definition.tuple_variable',
      'name.definition.list_variable',
      
      // 导入相关
      'name.definition.import',
      'name.definition.import_from',
      'name.definition.wildcard_import',
      'name.definition.relative_import',
      'name.definition.global',
      'name.definition.nonlocal',
      'name.definition.imported_module',
      'name.definition.imported_name',
      
      // 控制流相关
      'name.definition.if',
      'name.definition.for',
      'name.definition.while',
      'name.definition.break',
      'name.definition.continue',
      'name.definition.return',
      'name.definition.raise',
      'name.definition.assert',
      'name.definition.expression',
      
      // 表达式相关
      'name.definition.binary_operator',
      'name.definition.call',
      'name.definition.attribute',
      'name.definition.subscript',
      
      // 数据结构相关
      'name.definition.list_comprehension',
      'name.definition.dict_comprehension',
      'name.definition.set_comprehension',
      'name.definition.generator_expression',
      'name.definition.list',
      'name.definition.tuple',
      'name.definition.set',
      'name.definition.dictionary',
      'name.definition.class_pattern',
      'name.definition.tuple_pattern',
      'name.definition.list_pattern',
      'name.definition.dict_pattern',
      'name.definition.string',
      'name.definition.integer',
      'name.definition.float',
      'name.definition.true',
      'name.definition.false',
      'name.definition.none',
      'name.definition.ellipsis',
      'name.definition.slice',
      'name.definition.parenthesized_expression',
      'name.definition.expression_list',
      'name.definition.generic_type_name',
      
      // 类型相关
      'name.definition.type_annotation',
      'name.definition.type_hint',
      'name.definition.type_alias',
      'name.definition.parameters',
      'name.definition.default_parameter',
      'name.definition.typed_parameter',
      'name.definition.typed_default_parameter',
      'name.definition.decorator',
      'name.definition.union_type',
      'name.definition.comment',
      'name.definition.docstring'
    ];

    for (const captureName of nameCaptures) {
      const capture = result.captures?.find((c: any) => c.name === captureName);
      if (capture?.node?.text) {
        return capture.node.text;
      }
    }

    // 如果没有找到名称捕获，尝试从主节点提取
    if (result.captures?.[0]?.node?.childForFieldName('name')?.text) {
      return result.captures[0].node.childForFieldName('name').text;
    }

    return 'unnamed';
  }

  extractLanguageSpecificMetadata(result: any): Record<string, any> {
    const extra: Record<string, any> = {};
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return extra;
    }

    // 提取装饰器信息 - 检查捕获中的装饰器
    const capturedDecorators = result.captures?.filter((capture: any) =>
      capture.name === 'decorator' && capture.node?.text
    ).map((capture: any) => capture.node.text) || [];
    
    const nodeDecorators = this.extractDecorators(mainNode);
    const allDecorators = [...new Set([...capturedDecorators, ...nodeDecorators])]; // 合并并去重
    
    if (allDecorators.length > 0) {
      extra.decorators = allDecorators;
    }

    // 提取参数信息（对于函数）
    const parameters = mainNode.childForFieldName('parameters');
    if (parameters) {
      extra.parameterCount = parameters.childCount;
      extra.hasTypeHints = this.hasTypeHints(parameters);
    }

    // 提取返回类型信息
    const returnType = mainNode.childForFieldName('return_type');
    if (returnType) {
      extra.hasReturnType = true;
      extra.returnType = returnType.text;
    }

    // 提取继承信息（对于类）
    const superclasses = mainNode.childForFieldName('superclasses');
    if (superclasses) {
      extra.hasInheritance = true;
      extra.superclasses = this.extractSuperclassNames(superclasses);
    }

    // 检查是否是异步函数
    if (mainNode.type === 'async_function_definition' || 
        mainNode.type === 'async_method_definition' ||
        (mainNode.text && mainNode.text.includes('async'))) {
      extra.isAsync = true;
    }

    // 检查是否是生成器函数
    if (mainNode.text && mainNode.text.includes('yield')) {
      extra.isGenerator = true;
    }

    return extra;
  }

  mapQueryTypeToStandardType(queryType: string): StandardType {
    const mapping: Record<string, StandardType> = {
      'functions': 'function',
      'classes': 'class',
      'variables': 'variable',
      'imports': 'import',
      'control-flow': 'control-flow',
      'data-structures': 'class', // Python的数据结构通常映射为类
      'types-decorators': 'type',
      
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
    if (nodeType.includes('class')) complexity += 2;
    if (nodeType.includes('function')) complexity += 1;
    if (nodeType.includes('async')) complexity += 1;
    if (nodeType.includes('decorated')) complexity += 1;

    // Python特有的复杂度因素
    const text = mainNode.text || '';
    if (text.includes('yield')) complexity += 1; // 生成器
    if (text.includes('await')) complexity += 1; // 异步等待
    if (text.includes('lambda')) complexity += 1; // Lambda表达式
    if (text.includes('@')) complexity += 1; // 装饰器

    return complexity;
  }

  extractDependencies(result: any): string[] {
    const dependencies: string[] = [];
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return dependencies;
    }

    // 查找导入引用
    this.findImportReferences(mainNode, dependencies);
    
    // 查找函数调用
    this.findFunctionCalls(mainNode, dependencies);

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return modifiers;
    }

    // 检查装饰器 - 检查捕获中是否有装饰器
    const hasDecoratorCapture = result.captures?.some((capture: any) => capture.name === 'decorator' || capture.node?.type === 'decorator');
    if (hasDecoratorCapture || this.hasDecorators(mainNode)) {
      modifiers.push('decorated');
    }

    // 检查异步
    const text = mainNode.text || '';
    if (text.includes('async')) {
      modifiers.push('async');
    }

    // 检查生成器
    if (text.includes('yield')) {
      modifiers.push('generator');
    }

    // 检查类方法修饰符
    if (this.isClassMethod(mainNode)) {
      if (this.isStaticMethod(mainNode)) {
        modifiers.push('static');
      }
      if (this.isClassMethod(mainNode)) {
        modifiers.push('classmethod');
      }
      if (this.isPropertyMethod(mainNode)) {
        modifiers.push('property');
      }
    }

    return modifiers;
  }

  // Python特定的辅助方法

  private extractDecorators(node: any): string[] {
    const decorators: string[] = [];
    const decoratorsNode = node.children?.find((child: any) => child.type === 'decorators');
    
    if (decoratorsNode) {
      for (const child of decoratorsNode.children) {
        if (child.type === 'decorator' && child.text) {
          decorators.push(child.text.trim());
        }
      }
    }
    
    return decorators;
  }

  private hasDecorators(node: any): boolean {
    return node.children?.some((child: any) => child.type === 'decorators') || false;
  }

  private isClassMethod(node: any): boolean {
    // 检查是否是类方法（通过检查父节点是否是类定义）
    let parent = node.parent;
    while (parent) {
      if (parent.type === 'class_definition') {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  private isStaticMethod(node: any): boolean {
    const text = node.text || '';
    return text.includes('@staticmethod') || text.includes('@classmethod');
  }

  private isPropertyMethod(node: any): boolean {
    const text = node.text || '';
    return text.includes('@property');
  }

  private hasTypeHints(parameters: any): boolean {
    if (!parameters || !parameters.children) {
      return false;
    }
    
    return parameters.children.some((child: any) => 
      child.type === 'typed_parameter' || child.type === 'type_annotation'
    );
  }

  private extractSuperclassNames(superclasses: any): string[] {
    const names: string[] = [];
    
    if (superclasses && superclasses.children) {
      for (const child of superclasses.children) {
        if (child.type === 'identifier' || child.type === 'dotted_name') {
          names.push(child.text);
        }
      }
    }
    
    return names;
  }

  private findImportReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找导入引用
      if (child.type === 'identifier' || child.type === 'dotted_name') {
        dependencies.push(child.text);
      }
      
      this.findImportReferences(child, dependencies);
    }
  }

  private findFunctionCalls(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找函数调用
      if (child.type === 'call') {
        const functionNode = child.childForFieldName('function');
        if (functionNode?.text) {
          dependencies.push(functionNode.text);
        }
      }
      
      this.findFunctionCalls(child, dependencies);
    }
  }

  // 重写isBlockNode方法以支持Python特定的块节点类型
  protected isBlockNode(node: any): boolean {
    const pythonBlockTypes = ['block', 'suite'];
    return pythonBlockTypes.includes(node.type) || super.isBlockNode(node);
  }

  // 重写normalize方法以集成nodeId生成和符号信息
  async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
    const results: StandardizedQueryResult[] = [];

    // Initialize symbol table for the current processing context
    // In a real scenario, filePath would be passed in. For now, we'll use a placeholder.
    const filePath = 'current_file.py';
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
        if (['function', 'class', 'method', 'variable', 'import', 'type'].includes(standardType)) {
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
        this.logger?.error(`Error normalizing Python result: ${error}`);
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
      if (current.type === 'function_definition' || current.type === 'async_function_definition') {
        return 'function';
      }
      if (current.type === 'class_definition') {
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
        if (child.type === 'identifier') {
          parameters.push(child.text);
        }
      }
    }
    return parameters;
  }

  private extractImportPath(node: Parser.SyntaxNode): string | undefined {
    // For Python imports
    if (node.type === 'import_from_statement') {
      const moduleNode = node.childForFieldName('module_name');
      return moduleNode ? moduleNode.text : undefined;
    } else if (node.type === 'import_statement') {
      const moduleNode = node.childForFieldName('name');
      return moduleNode ? moduleNode.text : undefined;
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
        filePath: 'current_file.py',
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
        filePath: 'current_file.py',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  private extractInheritanceMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // For Python, this might be for class inheritance
    // This is a placeholder for more complex logic
    return null;
  }

  private findCallerFunctionContext(callNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let current = callNode.parent;
    while (current) {
      if (current.type === 'function_definition' || current.type === 'async_function_definition') {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  private extractConcurrencyMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // Placeholder for concurrency metadata extraction
    // This would analyze async/await operations from the query result
    return {
      type: 'concurrency',
      operation: 'unknown', // e.g., 'async_await', 'threading', 'multiprocessing'
      location: {
        filePath: 'current_file.py',
        lineNumber: astNode.startPosition.row + 1,
      }
    };
  }

  private extractLifecycleMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // Placeholder for lifecycle metadata extraction
    // This would analyze object creation, destruction, etc.
    return {
      type: 'lifecycle',
      operation: 'unknown', // e.g., 'create', 'destroy', 'context_manager'
      location: {
        filePath: 'current_file.py',
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
        filePath: 'current_file.py',
        lineNumber: astNode.startPosition.row + 1,
      }
    };
  }

  // 高级关系提取方法

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

    // 提取赋值数据流关系
    if (mainNode.type === 'assignment') {
      const left = mainNode.childForFieldName('left');
      const right = mainNode.childForFieldName('right');
      
      if (left?.text && right?.text) {
        relationships.push({
          source: right.text,
          target: left.text,
          type: 'assignment'
        });
      }
    }

    // 提取增强赋值数据流关系
    if (mainNode.type === 'augmented_assignment') {
      const left = mainNode.childForFieldName('left');
      const right = mainNode.childForFieldName('right');
      
      if (left?.text && right?.text) {
        relationships.push({
          source: right.text,
          target: left.text,
          type: 'assignment'
        });
      }
    }

    // 提取参数数据流关系
    if (mainNode.type === 'call') {
      const args = mainNode.childForFieldName('arguments');
      const func = mainNode.childForFieldName('function');
      
      if (args && func?.text) {
        for (const arg of args.children || []) {
          if (arg.type === 'identifier' && arg.text) {
            relationships.push({
              source: arg.text,
              target: func.text,
              type: 'parameter'
            });
          }
        }
      }
    }

    // 提取返回值数据流关系
    if (mainNode.type === 'return_statement') {
      const value = mainNode.childForFieldName('value');
      if (value?.text) {
        relationships.push({
          source: value.text,
          target: 'return',
          type: 'return'
        });
      }
    }

    return relationships;
  }

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

    // 提取条件控制流
    if (mainNode.type === 'if_statement') {
      const condition = mainNode.childForFieldName('condition');
      if (condition?.text) {
        relationships.push({
          source: condition.text,
          target: 'if-block',
          type: 'conditional'
        });
      }
    }

    // 提取循环控制流
    if (mainNode.type === 'for_statement' || mainNode.type === 'while_statement') {
      const condition = mainNode.childForFieldName('condition');
      if (condition?.text) {
        relationships.push({
          source: condition.text,
          target: 'loop-body',
          type: 'loop'
        });
      }
    }

    // 提取异常控制流
    if (mainNode.type === 'try_statement') {
      relationships.push({
        source: 'try-block',
        target: 'except-block',
        type: 'exception'
      });
    }

    // 提取上下文管理器控制流
    if (mainNode.type === 'with_statement') {
      const context = mainNode.childForFieldName('context');
      if (context?.text) {
        relationships.push({
          source: context.text,
          target: 'with-block',
          type: 'conditional' // Using conditional as a generic type for context management
        });
      }
    }

    return relationships;
  }

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

    // 提取Python中的语义关系
    const text = mainNode.text || '';
    
    // 检查装饰器，可能是重写或观察者模式
    if (text.includes('@override') || text.includes('@property')) {
      relationships.push({
        source: 'base-method',
        target: 'overriding-method',
        type: 'overrides'
      });
    }

    // 简单的观察者模式检测（装饰器或回调模式）
    if (text.includes('@on') || text.includes('@event') || text.includes('.connect')) {
      relationships.push({
        source: 'event-emitter',
        target: 'listener',
        type: 'observes'
      });
    }

    return relationships;
  }

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

    // 提取实例化关系
    if (mainNode.type === 'call' && mainNode.text && mainNode.text.includes('(')) {
      // 检查是否是类的实例化
      const func = mainNode.childForFieldName('function');
      if (func && (func.text && func.text[0] === func.text[0].toUpperCase())) {
        relationships.push({
          source: 'new-instance',
          target: func.text,
          type: 'instantiates'
        });
      }
    }

    // 提取初始化关系
    if (mainNode.type === 'method_definition' && mainNode.text?.includes('__init__')) {
      relationships.push({
        source: '__init__',
        target: 'instance',
        type: 'initializes'
      });
    }

    // 提取析构关系
    if (mainNode.type === 'method_definition' && mainNode.text?.includes('__del__')) {
      relationships.push({
        source: 'instance',
        target: '__del__',
        type: 'destroys'
      });
    }

    return relationships;
  }

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

    // 提取Python中的并发关系
    const text = mainNode.text || '';
    
    // 检查锁机制
    if (text.includes('with lock:') || text.includes('threading.Lock') || text.includes('asyncio.Lock')) {
      relationships.push({
        source: 'lock',
        target: 'critical-section',
        type: 'synchronizes'
      });
    }

    // 检查异步操作
    if (text.includes('async def') || text.includes('await')) {
      relationships.push({
        source: 'async-operation',
        target: 'await-point',
        type: 'communicates'
      });
    }

    return relationships;
  }
}