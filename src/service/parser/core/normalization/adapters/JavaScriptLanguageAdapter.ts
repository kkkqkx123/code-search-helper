import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult, SymbolInfo, SymbolTable } from '../types';
import { generateDeterministicNodeId } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
type StandardType = StandardizedQueryResult['type'];

/**
 * JavaScript语言适配器
 * 处理JavaScript特定的查询结果标准化
 */
export class JavaScriptLanguageAdapter extends BaseLanguageAdapter {
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
      'exports',
      'interfaces',
      'methods',
      'properties',
      'types',
      'control-flow',
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
    const typeMapping: Record<string, string> = {
      // Functions
      'function_declaration': 'functionDeclaration',
      'arrow_function': 'lambdaExpression',
      'function_expression': 'functionDeclaration',
      'generator_function': 'functionDeclaration',
      'generator_function_declaration': 'functionDeclaration',
      'async_function_declaration': 'functionDeclaration',
      'async_function_expression': 'functionDeclaration',
      
      // Classes
      'class_declaration': 'classDeclaration',
      'class_expression': 'classDeclaration',
      'class': 'classDeclaration',
      
      // Methods
      'method_definition': 'methodDeclaration',
      
      // Imports and Exports
      'import_statement': 'importDeclaration',
      'export_statement': 'exportDeclaration',
      
      // Variables
      'variable_declaration': 'variableDeclaration',
      'lexical_declaration': 'variableDeclaration',
      
      // Properties
      'property_definition': 'variableDeclaration',
      'public_field_definition': 'variableDeclaration',
      'private_field_definition': 'variableDeclaration',
      'pair': 'propertyIdentifier',
      
      // Control Flow
      'if_statement': 'controlFlow',
      'for_statement': 'controlFlow',
      'while_statement': 'controlFlow',
      'do_statement': 'controlFlow',
      'switch_statement': 'controlFlow',
      'switch_case': 'controlFlow',
      'switch_default': 'controlFlow',
      'try_statement': 'controlFlow',
      'catch_clause': 'controlFlow',
      'finally_clause': 'controlFlow',
      'return_statement': 'controlFlow',
      'break_statement': 'controlFlow',
      'continue_statement': 'controlFlow',
      'labeled_statement': 'controlFlow',
      'with_statement': 'controlFlow',
      'debugger_statement': 'controlFlow',
      
      // Expressions
      'expression_statement': 'expression',
      'binary_expression': 'expression',
      'unary_expression': 'expression',
      'update_expression': 'expression',
      'logical_expression': 'expression',
      'conditional_expression': 'expression',
      'assignment_expression': 'expression',
      'augmented_assignment_expression': 'expression',
      'sequence_expression': 'expression',
      'yield_expression': 'expression',
      'await_expression': 'expression',
      'new_expression': 'callExpression',
      'optional_chain': 'memberExpression',
      'call_expression': 'callExpression',
      'member_expression': 'memberExpression',
      
      // Literals
      'string': 'literal',
      'template_string': 'literal',
      'regex': 'literal',
      'number': 'literal',
      'true': 'literal',
      'false': 'literal',
      'null': 'literal',
      
      // Patterns
      'array_pattern': 'pattern',
      'object_pattern': 'pattern',
      'assignment_pattern': 'pattern',
      'spread_element': 'pattern',
      '_': 'pattern',
      
      // Types
      'type_alias_declaration': 'typeAnnotation',
      'namespace_declaration': 'typeAnnotation',
      'type_parameters': 'genericTypes',
      'type_arguments': 'genericTypes',
      
      // JSX
      'jsx_element': 'classDeclaration',
      'jsx_self_closing_element': 'classDeclaration',
      'jsx_fragment': 'classDeclaration',
      'jsx_attribute': 'propertyIdentifier',
      'jsx_expression': 'expression',
      
      // Comments
      'comment': 'comment',
      
      // Identifiers
      'private_property_identifier': 'propertyIdentifier',
      'identifier': 'propertyIdentifier',
      'property_identifier': 'propertyIdentifier',
      
      // Objects and Arrays
      'object': 'variableDeclaration',
      'array': 'variableDeclaration',
      
      // Function
      'function': 'functionDeclaration'
    };

    return typeMapping[nodeType] || nodeType;
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      'name', // Simple name capture from queries like (class name: (_) @name)
      'name.definition.function',
      'name.definition.method',
      'name.definition.class',
      'name.definition.interface',
      'name.definition.type',
      'name.definition.variable',
      'name.definition.property',
      'name.definition.constant',
      'name.definition.let_variable',
      'name.assignment',
      'name.definition.import',
      'name.definition.export',
      // Support for definition.xxx format (used in both TS and JS queries)
      'definition.function',
      'definition.method',
      'definition.class',
      'definition.interface',
      'definition.type',
      'definition.variable',
      'definition.property',
      'definition.constant',
      'definition.constructor',
      'definition.getter',
      'definition.setter',
      'definition.static',
      'definition.private_property',
      'definition.private_method',
      'definition.async_function',
      'definition.async_method',
      'definition.generator_function',
      'definition.generator_method',
      'definition.arrow_function',
      'definition.function_expression',
      'definition.import',
      'definition.export',
      'definition.if',
      'definition.for',
      'definition.for_in',
      'definition.for_of',
      'definition.while',
      'definition.do_while',
      'definition.switch',
      'definition.switch_case',
      'definition.switch_default',
      'definition.try',
      'definition.catch',
      'definition.finally',
      'definition.throw',
      'definition.return',
      'definition.break',
      'definition.continue',
      'definition.labeled',
      'definition.debugger',
      'definition.yield',
      'definition.await',
      'definition.ternary',
      'definition.call',
      'definition.new_expression',
      'definition.member_expression',
      'definition.optional_chain',
      'definition.binary_expression',
      'definition.unary_expression',
      'definition.update_expression',
      'definition.logical_expression',
      'definition.assignment',
      'definition.augmented_assignment',
      'definition.subscript_expression',
      'definition.template_string',
      'definition.regex',
      // JavaScript-specific captures
      'definition.accessor',
      'definition.private_field',
      'definition.test',
      'definition.lexical_declaration',
      'definition.variable_declaration',
      'definition.computed_method',
      'definition.static_property',
      'definition.object_property',
      'definition.computed_property',
      'definition.object_method',
      'definition.object_getter',
      'definition.object_setter',
      'definition.pattern_property',
      'definition.with',
      'definition.expression',
      'definition.conditional',
      'definition.sequence',
      'definition.async_function_expression',
      'definition.async_arrow_function',
      'definition.array_pattern',
      'definition.object_pattern',
      'definition.assignment_pattern',
      'definition.spread_element',
      'definition.jsx_self_closing_element',
      'definition.jsx_fragment',
      'definition.jsx_attribute',
      'definition.jsx_expression',
      'definition.comment',
      'definition.jsdoc',
      'definition.public_api',
      'definition.error_handling',
      'definition.promise_method',
      // Additional captures
      'export',
      'default'
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

    // 提取继承信息
    const heritageClause = mainNode.childForFieldName('heritage_clause');
    if (heritageClause) {
      extra.hasInheritance = true;
      extra.extends = heritageClause.text;
    }

    // 提取参数信息（对于函数）
    const parameters = mainNode.childForFieldName('parameters');
    if (parameters) {
      extra.parameterCount = parameters.childCount;
    }

    // 提取JSX相关信息
    if (this.isJSXElement(mainNode)) {
      extra.isJSX = true;
      extra.jsxType = mainNode.type;
    }

    return extra;
  }

  mapQueryTypeToStandardType(queryType: string): StandardType {
    const mapping: Record<string, StandardType> = {
      'functions': 'function',
      'classes': 'class',
      'variables': 'variable',
      'imports': 'import',
      'exports': 'export',
      'interfaces': 'interface',
      'methods': 'method',
      'properties': 'variable',
      'types': 'type',
      'control-flow': 'control-flow',
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
    if (nodeType.includes('class')) complexity += 2;
    if (nodeType.includes('function')) complexity += 1;
    if (nodeType.includes('interface')) complexity += 1;

    // JavaScript特有的复杂度因素
    const text = mainNode.text || '';
    if (text.includes('async')) complexity += 1; // 异步函数
    if (text.includes('await')) complexity += 1; // 异步等待
    if (text.includes('extends')) complexity += 1; // 继承
    if (text.includes('JSX') || text.includes('jsx')) complexity += 1; // JSX

    return complexity;
  }

  extractDependencies(result: any): string[] {
    const dependencies: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return dependencies;
    }

    // 首先检查捕获中的依赖项
    if (result.captures && Array.isArray(result.captures)) {
      for (const capture of result.captures) {
        if (capture.name && capture.name.includes('import') && capture.node?.text) {
          // 提取导入的标识符
          const importText = capture.node.text;
          // 例如从 \"Component\" 提取标识符
          const identifierMatch = importText.match(/[A-Za-z_][A-Za-z0-9_]*/g);
          if (identifierMatch) {
            dependencies.push(...identifierMatch);
          }
        }
      }
    }

    // 查找类型引用
    this.findTypeReferences(mainNode, dependencies);

    // 查找导入引用
    this.findImportReferences(mainNode, dependencies);

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return modifiers;
    }

    // 检查常见的修饰符
    const text = mainNode.text || '';

    if (text.includes('async')) modifiers.push('async');
    if (text.includes('export')) modifiers.push('export');
    if (text.includes('default')) modifiers.push('default');
    if (text.includes('static')) modifiers.push('static');

    return modifiers;
  }

  // JavaScript特定的辅助方法

  private isJSXElement(node: any): boolean {
    if (!node) {
      return false;
    }

    const jsxTypes = [
      'jsx_element',
      'jsx_self_closing_element',
      'jsx_fragment',
      'jsx_opening_element',
      'jsx_closing_element',
      'jsx_attribute'
    ];

    return jsxTypes.includes(node.type);
  }

  private findImportReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找导入引用
      if (child.type === 'identifier' && child.text) {
        dependencies.push(child.text);
      } else if (child.type === 'import_specifier') {
        // 处理import { Component } from 'react'这类导入
        const importedName = child.childForFieldName('name');
        if (importedName && importedName.text) {
          dependencies.push(importedName.text);
        }
      }

      this.findImportReferences(child, dependencies);
    }
  }

  // 重写isBlockNode方法以支持JavaScript特定的块节点类型
  protected isBlockNode(node: any): boolean {
    const jsBlockTypes = ['block', 'statement_block', 'class_body', 'object'];
    return jsBlockTypes.includes(node.type) || super.isBlockNode(node);
  }

  // 重写normalize方法以集成nodeId生成和符号信息
  async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
    const results: StandardizedQueryResult[] = [];

    // Initialize symbol table for the current processing context
    // In a real scenario, filePath would be passed in. For now, we'll use a placeholder.
    const filePath = 'current_file.js';
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
        this.logger?.error(`Error normalizing JavaScript result: ${error}`);
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
      if (current.type === 'function_declaration' || current.type === 'function_expression' || current.type === 'arrow_function') {
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
        if (child.type === 'identifier') {
          parameters.push(child.text);
        }
      }
    }
    return parameters;
  }

  private extractImportPath(node: Parser.SyntaxNode): string | undefined {
    // For JavaScript imports
    if (node.type === 'import_statement') {
      const pathNode = node.childForFieldName('source');
      return pathNode ? pathNode.text.replace(/['"]/g, '') : undefined;
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
        filePath: 'current_file.js',
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
        filePath: 'current_file.js',
        lineNumber: astNode.startPosition.row + 1,
        columnNumber: astNode.startPosition.column,
      }
    };
  }

  private extractInheritanceMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // For JavaScript, this might be for class inheritance or prototype chain
    // This is a placeholder for more complex logic
    return null;
  }

  private findCallerFunctionContext(callNode: Parser.SyntaxNode): Parser.SyntaxNode | null {
    let current = callNode.parent;
    while (current) {
      if (current.type === 'function_declaration' || current.type === 'function_expression' || current.type === 'arrow_function') {
        return current;
      }
      current = current.parent;
    }
    return null;
  }

  private extractConcurrencyMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // Placeholder for concurrency metadata extraction
    // This would analyze Promise, async/await operations from the query result
    return {
      type: 'concurrency',
      operation: 'unknown', // e.g., 'promise', 'async_await'
      location: {
        filePath: 'current_file.js',
        lineNumber: astNode.startPosition.row + 1,
      }
    };
  }

  private extractLifecycleMetadata(result: any, astNode: Parser.SyntaxNode): any {
    // Placeholder for lifecycle metadata extraction
    // This would analyze object creation, destruction, etc.
    return {
      type: 'lifecycle',
      operation: 'unknown', // e.g., 'create', 'destroy'
      location: {
        filePath: 'current_file.js',
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
        filePath: 'current_file.js',
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
    
    // 从查询结果中提取捕获的数据流关系
    if (result.captures && Array.isArray(result.captures)) {
      for (const capture of result.captures) {
        if (!capture.name || !capture.node?.text) continue;
        
        // 根据捕获名称提取数据流关系
        if (capture.name.includes('source.') || capture.name.includes('target.')) {
          const parts = capture.name.split('.');
          if (parts.length >= 3) {
            const flowType = parts[2]; // 例如 'assignment', 'parameter', 'return'
            const direction = parts[0]; // 'source' 或 'target'
            const context = parts[1]; // 例如 'variable', 'function', 'method'
            
            // 查找对应的源或目标
            const counterpart = result.captures.find((c: any) => 
              c.name === `${direction === 'source' ? 'target' : 'source'}.${context}.${flowType}`
            );
            
            if (counterpart?.node?.text) {
              const dataFlowType = this.determineDataFlowType(flowType);
              if (direction === 'source') {
                relationships.push({
                  source: capture.node.text,
                  target: counterpart.node.text,
                  type: dataFlowType
                });
              }
            }
          }
        }
      }
    }
    
    // 如果没有从查询结果中提取到关系，使用传统的AST分析方法
    if (relationships.length === 0) {
      this.extractDataFlowFromAST(result, relationships);
    }
    
    return relationships;
  }
  
  private determineDataFlowType(flowType: string): 'assignment' | 'parameter' | 'return' {
    if (flowType === 'assignment' || flowType === 'property.assignment' || 
        flowType === 'array.assignment' || flowType === 'function.assignment' ||
        flowType === 'arrow.assignment' || flowType === 'destructuring.object' ||
        flowType === 'destructuring.array') {
      return 'assignment';
    } else if (flowType === 'parameter' || flowType === 'method.parameter') {
      return 'parameter';
    } else if (flowType === 'return' || flowType === 'property.return') {
      return 'return';
    }
    return 'assignment'; // 默认值
  }
  
  private extractDataFlowFromAST(result: any, relationships: Array<{
    source: string;
    target: string;
    type: 'assignment' | 'parameter' | 'return';
  }>): void {
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return;
    }

    // 提取赋值数据流关系
    if (mainNode.type === 'assignment_expression') {
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
    if (mainNode.type === 'call_expression') {
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
    
    // 从查询结果中提取捕获的关系
    if (result.captures && Array.isArray(result.captures)) {
      for (const capture of result.captures) {
        if (!capture.name || !capture.node?.text) continue;
        
        // 根据捕获名称提取关系
        if (capture.name.includes('source.') || capture.name.includes('target.')) {
          const parts = capture.name.split('.');
          if (parts.length >= 3) {
            const relationType = parts[2]; // 例如 'condition', 'loop', 'exception'
            const direction = parts[0]; // 'source' 或 'target'
            const context = parts[1]; // 例如 'if', 'for', 'try'
            
            // 查找对应的源或目标
            const counterpart = result.captures.find((c: any) => 
              c.name === `${direction === 'source' ? 'target' : 'source'}.${context}.${relationType}`
            );
            
            if (counterpart?.node?.text) {
              const flowType = this.determineFlowType(context, relationType);
              if (direction === 'source') {
                relationships.push({
                  source: capture.node.text,
                  target: counterpart.node.text,
                  type: flowType
                });
              }
            }
          }
        }
      }
    }
    
    // 如果没有从查询结果中提取到关系，使用传统的AST分析方法
    if (relationships.length === 0) {
      this.extractControlFlowFromAST(result, relationships);
    }
    
    return relationships;
  }
  
  private determineFlowType(context: string, relationType: string): 'conditional' | 'loop' | 'exception' | 'callback' {
    if (context === 'if' || context === 'switch' || context === 'ternary') {
      return 'conditional';
    } else if (context === 'for' || context === 'while' || context === 'do') {
      return 'loop';
    } else if (context === 'try' || context === 'catch' || context === 'throw') {
      return 'exception';
    } else if (context === 'callback' || context === 'promise' || context === 'async') {
      return 'callback';
    }
    return 'conditional'; // 默认值
  }
  
  private extractControlFlowFromAST(result: any, relationships: Array<{
    source: string;
    target: string;
    type: 'conditional' | 'loop' | 'exception' | 'callback';
  }>): void {
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return;
    }

    // 提取条件控制流
    if (mainNode.type === 'if_statement') {
      const condition = mainNode.childForFieldName('condition');
      const consequence = mainNode.childForFieldName('consequence');
      const alternative = mainNode.childForFieldName('alternative');
      
      if (condition?.text) {
        if (consequence?.text) {
          relationships.push({
            source: condition.text,
            target: 'if-consequence',
            type: 'conditional'
          });
        }
        if (alternative?.text) {
          relationships.push({
            source: condition.text,
            target: 'if-alternative',
            type: 'conditional'
          });
        }
      }
    }

    // 提取循环控制流
    if (mainNode.type === 'for_statement') {
      const condition = mainNode.childForFieldName('condition');
      const body = mainNode.childForFieldName('body');
      
      if (condition?.text && body?.text) {
        relationships.push({
          source: condition.text,
          target: 'for-body',
          type: 'loop'
        });
      }
    }
    
    if (mainNode.type === 'while_statement') {
      const condition = mainNode.childForFieldName('condition');
      const body = mainNode.childForFieldName('body');
      
      if (condition?.text && body?.text) {
        relationships.push({
          source: condition.text,
          target: 'while-body',
          type: 'loop'
        });
      }
    }

    // 提取异常控制流
    if (mainNode.type === 'try_statement') {
      const body = mainNode.childForFieldName('body');
      const catchClause = mainNode.childForFieldName('catch_clause');
      const finallyClause = mainNode.childForFieldName('finally_clause');
      
      if (body?.text && catchClause?.text) {
        relationships.push({
          source: 'try-body',
          target: 'catch-body',
          type: 'exception'
        });
      }
      
      if (body?.text && finallyClause?.text) {
        relationships.push({
          source: 'try-body',
          target: 'finally-body',
          type: 'exception'
        });
      }
    }
    
    // 提取回调控制流
    if (mainNode.type === 'call_expression') {
      const args = mainNode.childForFieldName('arguments');
      if (args?.children) {
        for (const arg of args.children) {
          if (arg.type === 'function_expression' || arg.type === 'arrow_function') {
            relationships.push({
              source: 'callback-function',
              target: 'async-operation',
              type: 'callback'
            });
          }
        }
      }
    }
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

    // 提取JavaScript中可能的语义关系
    // 比如方法重写（在类继承中）
    // 比如观察者模式（通过on/emit等模式）
    const text = mainNode.text || '';
    
    // 简单的观察者模式检测
    if (text.includes('.on(') || text.includes('.addListener(')) {
      relationships.push({
        source: 'event-emitter',
        target: 'listener',
        type: 'observes'
      });
    }

    // 简单的配置模式检测
    if (text.includes('.configure') || text.includes('.config')) {
      relationships.push({
        source: 'configuration',
        target: 'configurable',
        type: 'configures'
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
    if (mainNode.type === 'new_expression') {
      const constructor = mainNode.childForFieldName('constructor');
      if (constructor?.text) {
        relationships.push({
          source: 'new-instance',
          target: constructor.text,
          type: 'instantiates'
        });
      }
    }

    // 提取初始化关系
    if (mainNode.type === 'method_definition' && mainNode.text?.includes('constructor')) {
      relationships.push({
        source: 'constructor',
        target: 'instance',
        type: 'initializes'
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

    // 提取JavaScript中的并发关系（如Promise、async/await）
    const text = mainNode.text || '';
    
    if (text.includes('Promise') || text.includes('await') || text.includes('.then')) {
      relationships.push({
        source: 'async-operation',
        target: 'result',
        type: 'communicates'
      });
    }

    return relationships;
  }
}
