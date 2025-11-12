import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult, SymbolInfo, SymbolTable } from '../types';
import { NodeIdGenerator } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
import { MetadataBuilder } from '../utils/MetadataBuilder';
import {
  AnnotationRelationshipExtractor,
  CallRelationshipExtractor,
  CreationRelationshipExtractor,
  DataFlowRelationshipExtractor,
  DependencyRelationshipExtractor,
  InheritanceRelationshipExtractor,
  ConcurrencyRelationshipExtractor,
  LifecycleRelationshipExtractor,
  ReferenceRelationshipExtractor,
  SemanticRelationshipExtractor,
  ControlFlowRelationshipExtractor,
  JsHelperMethods,
  JS_NODE_TYPE_MAPPING,
  JS_QUERY_TYPE_MAPPING,
  JS_SUPPORTED_QUERY_TYPES,
  JS_NAME_CAPTURES,
  JS_BLOCK_NODE_TYPES,
  JS_MODIFIERS,
  JS_COMPLEXITY_KEYWORDS
} from './js-utils';

type StandardType = StandardizedQueryResult['type'];

/**
 * JavaScript语言适配器
 * 处理JavaScript特定的查询结果标准化
 */
export class JavaScriptLanguageAdapter extends BaseLanguageAdapter {
  // In-memory symbol table for the current file
  private symbolTable: SymbolTable | null = null;

  // 关系提取器实例
  private annotationExtractor: AnnotationRelationshipExtractor;
  private callExtractor: CallRelationshipExtractor;
  private creationExtractor: CreationRelationshipExtractor;
  private dataFlowExtractor: DataFlowRelationshipExtractor;
  private dependencyExtractor: DependencyRelationshipExtractor;
  private inheritanceExtractor: InheritanceRelationshipExtractor;
  private referenceExtractor: ReferenceRelationshipExtractor;
  private concurrencyExtractor: ConcurrencyRelationshipExtractor;
  private lifecycleExtractor: LifecycleRelationshipExtractor;
  private semanticExtractor: SemanticRelationshipExtractor;
  private controlFlowExtractor: ControlFlowRelationshipExtractor;

  constructor(options: AdapterOptions = {}) {
    super(options);

    // 初始化关系提取器
    this.annotationExtractor = new AnnotationRelationshipExtractor();
    this.callExtractor = new CallRelationshipExtractor();
    this.creationExtractor = new CreationRelationshipExtractor();
    this.dataFlowExtractor = new DataFlowRelationshipExtractor();
    this.dependencyExtractor = new DependencyRelationshipExtractor();
    this.inheritanceExtractor = new InheritanceRelationshipExtractor();
    this.referenceExtractor = new ReferenceRelationshipExtractor();
    this.concurrencyExtractor = new ConcurrencyRelationshipExtractor();
    this.lifecycleExtractor = new LifecycleRelationshipExtractor();
    this.semanticExtractor = new SemanticRelationshipExtractor();
    this.controlFlowExtractor = new ControlFlowRelationshipExtractor();
  }

  getSupportedQueryTypes(): string[] {
    return JS_SUPPORTED_QUERY_TYPES;
  }

  mapNodeType(nodeType: string): string {
    return JS_NODE_TYPE_MAPPING[nodeType] || nodeType;
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    for (const captureName of JS_NAME_CAPTURES) {
      const capture = result.captures?.find((c: any) => c.name === captureName);
      if (capture?.node?.text) {
        return capture.node.text;
      }
    }

    // 如果没有找到名称捕获，尝试从主节点提取
    if (result.captures?.[0]?.node?.childForFieldName?.('name')?.text) {
      return result.captures[0].node.childForFieldName('name').text;
    }

    // 对于JavaScript，尝试从特定字段提取名称
    const mainNode = result.captures?.[0]?.node;
    if (mainNode) {
      // 尝试获取标识符
      const identifier = mainNode.childForFieldName?.('name') ||
        mainNode.childForFieldName?.('identifier') ||
        mainNode.childForFieldName?.('property_identifier');
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
    return JS_QUERY_TYPE_MAPPING[queryType] as StandardType || 'expression';
  }

  calculateComplexity(result: any): number {
    let complexity = this.calculateBaseComplexity(result);

    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return complexity;
    }

    // 基于节点类型增加复杂度
    const nodeType = mainNode.type;
    if (nodeType.includes('class') || nodeType.includes('struct')) complexity += 2;
    if (nodeType.includes('function') || nodeType.includes('method')) complexity += 1;
    if (nodeType.includes('interface')) complexity += 1;

    // JavaScript特定的复杂度因素
    const text = mainNode.text || '';
    for (const keyword of JS_COMPLEXITY_KEYWORDS) {
      if (new RegExp(keyword.pattern).test(text)) {
        complexity += keyword.weight;
      }
    }

    return complexity;
  }

  extractDependencies(result: any): string[] {
    const dependencies: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return dependencies;
    }

    // 使用辅助方法查找依赖
    JsHelperMethods.findTypeReferences(mainNode, dependencies);
    JsHelperMethods.findFunctionCalls(mainNode, dependencies);
    JsHelperMethods.findImportDependencies(mainNode, dependencies);
    JsHelperMethods.findDataFlowDependencies(mainNode, dependencies);
    JsHelperMethods.findConcurrencyDependencies(mainNode, dependencies);
    JsHelperMethods.findInheritanceDependencies(mainNode, dependencies);
    JsHelperMethods.findInterfaceDependencies(mainNode, dependencies);
    JsHelperMethods.findTypeAliasDependencies(mainNode, dependencies);

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return modifiers;
    }

    // 检查JavaScript常见的修饰符
    const text = mainNode.text || '';

    for (const modifier of JS_MODIFIERS) {
      if (modifier === 'async' || modifier === 'export' || modifier === 'default' ||
        modifier === 'static' || modifier === 'public' || modifier === 'private' ||
        modifier === 'protected' || modifier === 'readonly' || modifier === 'abstract' ||
        modifier === 'override') {
        if (text.includes(modifier)) {
          modifiers.push(modifier);
        }
      }
    }

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
    return JS_BLOCK_NODE_TYPES.includes(node.type) || super.isBlockNode(node);
  }

  // 重写normalize方法以集成nodeId生成和符号信息
  async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
    const results: StandardizedQueryResult[] = [];
    const processingStartTime = Date.now();

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
        const nodeId = NodeIdGenerator.safeForAstNode(astNode, standardType, name);

        // 使用 MetadataBuilder 创建增强的元数据
        const builder = this.createMetadataBuilder(result, language)
          .setProcessingStartTime(processingStartTime)
          .addDependencies(dependencies)
          .addModifiers(modifiers)
          .addCustomFields(extra);

        // 如果是关系类型，添加关系元数据
        if (this.isRelationshipType(standardType)) {
          const relationshipMetadata = this.extractRelationshipMetadata(result, standardType, astNode);
          if (relationshipMetadata) {
            builder.addCustomFields(relationshipMetadata);
          }
        }

        let symbolInfo: SymbolInfo | null = null;

        // Only create symbol info for entity types, not relationships
        if (['function', 'class', 'method', 'variable', 'import', 'interface', 'type'].includes(standardType)) {
          symbolInfo = this.createSymbolInfo(astNode, name, standardType, filePath);
          if (this.symbolTable && symbolInfo) {
            this.symbolTable.globalScope.symbols.set(name, symbolInfo);
          }
        }

        results.push({
          nodeId,
          type: standardType,
          name,
          startLine: result.startLine || 1,
          endLine: result.endLine || 1,
          content,
          metadata: builder.build(),
          symbolInfo: symbolInfo || undefined
        });
      } catch (error: unknown) {
        this.logger?.error(`Error normalizing JavaScript result: ${error}`);
        // 使用 MetadataFactory 创建错误元数据
        const errorForMetadata = error instanceof Error ? error : new Error(String(error));
        const errorBuilder = MetadataBuilder.fromComplete(this.createMetadata(result, language))
          .setError(errorForMetadata, { phase: 'normalization', queryType, filePath });
        results.push({
          nodeId: NodeIdGenerator.forError('javascript_normalization'),
          type: 'expression',
          name: 'error',
          startLine: 0,
          endLine: 0,
          content: '',
          metadata: errorBuilder.build()
        });
      }
    }

    return results;
  }

  /**
   * 检查是否为关系类型
   */
  private isRelationshipType(type: string): boolean {
    const relationshipTypes = ['call', 'data-flow', 'inheritance', 'concurrency', 'lifecycle', 'semantic', 'control-flow', 'dependency', 'reference', 'creation', 'annotation'];
    return relationshipTypes.includes(type);
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
      fromNodeId: callerNode ? NodeIdGenerator.forAstNode(callerNode) : 'unknown',
      toNodeId: functionNode ? NodeIdGenerator.forAstNode(functionNode) : 'unknown',
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
      fromNodeId: right ? NodeIdGenerator.forAstNode(right) : 'unknown',
      toNodeId: left ? NodeIdGenerator.forAstNode(left) : 'unknown',
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
    // 使用新的关系提取器提取元数据
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) return [];

    const metadata = this.concurrencyExtractor.extractConcurrencyMetadata(result, mainNode, 'javascript');

    // 将元数据转换为关系数组
    const relationships: Array<{
      source: string;
      target: string;
      type: 'synchronizes' | 'locks' | 'communicates' | 'races';
    }> = [];

    if (metadata.operation) {
      relationships.push({
        source: metadata.operation.text || 'unknown',
        target: 'async_context',
        type: 'communicates' as const
      });
    }

    return relationships;
  }

  // 高级关系提取方法 - 委托给专门的提取器
  extractAnnotationRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'comment' | 'jsdoc' | 'directive';
  }> {
    const relationships = this.annotationExtractor.extractAnnotationRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map((rel: any) => ({
      source: rel.source,
      target: rel.target,
      type: this.mapAnnotationType(rel.type)
    }));
  }

  extractCreationRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'object_instance' | 'array' | 'function' | 'class_instance' | 'promise';
  }> {
    const relationships = this.creationExtractor.extractCreationRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map((rel: any) => ({
      source: rel.source,
      target: rel.target,
      type: this.mapCreationType(rel.type)
    }));
  }

  extractReferenceRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'read' | 'write' | 'declaration' | 'usage';
  }> {
    const relationships = this.referenceExtractor.extractReferenceRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map((rel: any) => ({
      source: rel.source,
      target: rel.target,
      type: this.mapReferenceType(rel.type)
    }));
  }

  extractDependencyRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'import' | 'export' | 'require' | 'dynamic_import';
  }> {
    const relationships = this.dependencyExtractor.extractDependencyRelationships(result);
    // 转换类型以匹配基类接口
    return relationships.map((rel: any) => ({
      source: rel.source,
      target: rel.target,
      type: this.mapDependencyType(rel.type)
    }));
  }

  // 类型映射辅助方法
  private mapAnnotationType(type: string): 'comment' | 'jsdoc' | 'directive' {
    switch (type) {
      case 'comment': return 'comment';
      case 'jsdoc': return 'comment'; // 映射到comment类型
      case 'directive': return 'directive';
      default: return 'comment';
    }
  }

  private mapCreationType(type: string): 'object_instance' | 'array' | 'function' | 'class_instance' | 'promise' {
    switch (type) {
      case 'object_instance': return 'object_instance';
      case 'array': return 'array';
      case 'function': return 'function';
      case 'class_instance': return 'class_instance';
      case 'promise': return 'function';
      default: return 'object_instance';
    }
  }

  private mapReferenceType(type: string): 'read' | 'write' | 'declaration' | 'usage' {
    switch (type) {
      case 'read': return 'read';
      case 'write': return 'write';
      case 'declaration': return 'declaration';
      case 'usage': return 'usage';
      default: return 'usage';
    }
  }

  private mapDependencyType(type: string): 'import' | 'export' | 'require' | 'dynamic_import' {
    switch (type) {
      case 'import': return 'import';
      case 'export': return 'import'; // 映射到import类型
      case 'require': return 'import';
      case 'dynamic_import': return 'import';
      default: return 'import';
    }
  }
}
