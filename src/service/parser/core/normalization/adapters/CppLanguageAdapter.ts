import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult, SymbolInfo, SymbolTable } from '../types';
import { generateDeterministicNodeId } from '../../../../../utils/deterministic-node-id';
import Parser from 'tree-sitter';
import {
  CallRelationshipExtractor,
  DataFlowRelationshipExtractor,
  InheritanceRelationshipExtractor,
  ConcurrencyRelationshipExtractor,
  LifecycleRelationshipExtractor,
  SemanticRelationshipExtractor,
  ControlFlowRelationshipExtractor,
  CppHelperMethods
} from './cpp-utils';
type StandardType = StandardizedQueryResult['type'];

/**
 * C++ 语言适配器
 * 专门处理C++语言的查询结果标准化
 */
export class CppLanguageAdapter extends BaseLanguageAdapter {
  // In-memory symbol table for the current file
  private symbolTable: SymbolTable | null = null;
  
  // 关系提取器实例
  private callExtractor: CallRelationshipExtractor;
  private dataFlowExtractor: DataFlowRelationshipExtractor;
  private inheritanceExtractor: InheritanceRelationshipExtractor;
  private concurrencyExtractor: ConcurrencyRelationshipExtractor;
  private lifecycleExtractor: LifecycleRelationshipExtractor;
  private semanticExtractor: SemanticRelationshipExtractor;
  private controlFlowExtractor: ControlFlowRelationshipExtractor;

  constructor(options: AdapterOptions = {}) {
    super(options);
    
    // 初始化关系提取器
    this.callExtractor = new CallRelationshipExtractor();
    this.dataFlowExtractor = new DataFlowRelationshipExtractor();
    this.inheritanceExtractor = new InheritanceRelationshipExtractor();
    this.concurrencyExtractor = new ConcurrencyRelationshipExtractor();
    this.lifecycleExtractor = new LifecycleRelationshipExtractor();
    this.semanticExtractor = new SemanticRelationshipExtractor();
    this.controlFlowExtractor = new ControlFlowRelationshipExtractor();
  }

  getSupportedQueryTypes(): string[] {
    return [
      // Entity types
      'functions',
      'classes',
      'variables',
      'types',
      'namespaces',
      'preprocessor',
      'control-flow',
      'modern-features',
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
    const typeMapping: Record<string, string> = {// 类和结构体相关
      'struct_specifier': 'class',
      'union_specifier': 'class',
      'class_specifier': 'class',
      'template_declaration': 'template',
      'access_specifier': 'access_specifier',
      'base_class_clause': 'base_class',
      'member_initializer': 'member_initializer',
      'friend_declaration': 'friend',

      // 函数相关
      'function_definition': 'function',
      'function_declarator': 'function',
      'field_declarator': 'method',  // 类方法
      'declaration': 'function',  // 函数声明
      'lambda_expression': 'lambda',
      'operator_name': 'operator',
      'constructor_initializer': 'constructor',
      'destructor_name': 'destructor',
      'virtual_specifier': 'virtual_specifier',
      'co_await_expression': 'co_await_expression',
      'co_yield_expression': 'co_yield_expression',
      'co_return_statement': 'co_return_statement',

      // 变量相关
      'init_declarator': 'variable',
      'structured_binding_declarator': 'binding',
      'parameter_pack_expansion': 'parameter_pack',
      'assignment_expression': 'assignment',
      'call_expression': 'call',
      'field_expression': 'member',

      // 类型相关
      'type_definition': 'type',
      'type_alias_declaration': 'type_alias',
      'enum_specifier': 'enum',
      'concept_definition': 'concept',
      'template_function': 'template',
      'template_type': 'template',
      'auto': 'auto_var',
      'type_qualifier': 'type_qualifier',
      'primitive_type': 'primitive_type',

      // 命名空间相关
      'namespace_definition': 'namespace',
      'using_declaration': 'using',

      // 预处理器相关
      'preproc_function_def': 'macro',
      'preproc_def': 'macro',
      'preproc_include': 'include',
      'preproc_if': 'preproc_condition',
      'preproc_ifdef': 'preproc_ifdef',
      'preproc_elif': 'preproc_condition',
      'preproc_else': 'preproc_else',
      'preproc_endif': 'preproc_endif',
      'preproc_call': 'preproc_call',

      // 控制流相关
      'try_statement': 'try_statement',
      'catch_clause': 'catch_clause',
      'throw_specifier': 'throw_specifier',
      'noexcept_specifier': 'noexcept_specifier',
      'range_based_for_statement': 'range_for',
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
      'typeid_expression': 'typeid_expression',
      'parenthesized_expression': 'parenthesized_expression',
      'conditional_expression': 'conditional_expression',
      'new_expression': 'new_expression',
      'delete_expression': 'delete_expression',
      'comment': 'comment',
      'number_literal': 'number_literal',
      'string_literal': 'string_literal',
      'char_literal': 'char_literal',
      'true': 'boolean_literal',
      'false': 'boolean_literal',

      // 现代特性
      'explicit_specialization': 'explicit_specialization',
      'static_assert_declaration': 'static_assert',
      'attribute_declaration': 'attribute_declaration',
      'attribute_specifier': 'attribute_specifier',
      'requires_clause': 'requires_clause',
      'alignas_specifier': 'alignas_specifier',
      'literal_suffix': 'literal_suffix',
      // 通用标识符映射
      'identifier': 'identifier',
      'type_identifier': 'type_identifier',
      'field_identifier': 'field_identifier',
      'template_parameter_list': 'template_parameter_list',
      'storage_class_specifier': 'storage_class_specifier',
      'explicit_specifier': 'explicit_specifier',
      'namespace_identifier': 'namespace_identifier',
      'statement_identifier': 'statement_identifier',
      'system_lib_string': 'system_lib_string',
      '_': 'wildcard',
    };

    return typeMapping[nodeType] || nodeType;
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      'name.definition.class',
      'name.definition.template.class',
      'name.definition.template.struct',
      'name.definition.function',
      'name.definition.method',
      'name.definition.template.function',
      'name.definition.constructor',
      'name.definition.destructor',
      'name.definition.operator',
      'name.definition.operator.new',
      'name.definition.operator.delete',
      'name.definition.variable',
      'name.definition.binding',
      'name.definition.assignment',
      'name.definition.call',
      'name.definition.member',
      'name.definition.type',
      'name.definition.type_alias',
      'name.definition.enum',
      'name.definition.template.enum',
      'name.definition.concept',
      'name.definition.template.instantiation',
      'name.definition.auto_var',
      'name.definition.namespace',
      'name.definition.using',
      'name.definition.macro',
      'name.definition.include',
      'name.definition.preproc_condition',
      'name.definition.preproc_ifdef',
      'name.definition.label',
      'name.definition.try_statement',
      'name.definition.catch_clause',
      'name.definition.range_for',
      'name.definition.control_statement',
      'name.definition.compound_statement',
      'name.definition.binary_expression',
      'name.definition.unary_expression',
      'name.definition.update_expression',
      'name.definition.cast_expression',
      'name.definition.sizeof_expression',
      'name.definition.typeid_expression',
      'name.definition.parenthesized_expression',
      'name.definition.conditional_expression',
      'name.definition.new_expression',
      'name.definition.delete_expression',
      'name.definition.comment',
      'name.definition.number_literal',
      'name.definition.string_literal',
      'name.definition.char_literal',
      'name.definition.boolean_literal',
      'name.definition.explicit_specialization',
      'name.definition.static_assert',
      'name.definition.attribute_declaration',
      'name.definition.attribute_specifier',
      'name.definition.requires_clause',
      'name.definition.alignas_specifier',
      'name.definition.literal_suffix',
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

    // 对于C++，尝试从特定字段提取名称
    const mainNode = result.captures?.[0]?.node;
    if (mainNode) {
      // 尝试获取标识符
      const identifier = mainNode.childForFieldName?.('identifier') ||
        mainNode.childForFieldName?.('type_identifier') ||
        mainNode.childForFieldName?.('field_identifier') ||
        mainNode.childForFieldName?.('namespace_identifier');
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

    // 提取模板参数
    const templateParameters = mainNode.childForFieldName?.('parameters');
    if (templateParameters) {
      extra.hasTemplate = true;
      extra.templateParameters = templateParameters.text;
    }

    // 提取继承信息
    const baseClassClause = mainNode.childForFieldName?.('base_class_clause');
    if (baseClassClause) {
      extra.hasInheritance = true;
      extra.baseClasses = baseClassClause.text;
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

    // 提取访问修饰符
    const accessSpecifier = mainNode.childForFieldName?.('access_specifier');
    if (accessSpecifier) {
      extra.accessModifier = accessSpecifier.text;
    }

    // 提取异常规范
    const exceptionSpec = mainNode.childForFieldName?.('throw_specifier') ||
      mainNode.childForFieldName?.('noexcept_specifier');
    if (exceptionSpec) {
      extra.exceptionSpec = exceptionSpec.text;
    }

    // 提取概念约束
    const requiresClause = mainNode.childForFieldName?.('requires_clause');
    if (requiresClause) {
      extra.constraints = requiresClause.text;
    }

    // 检查是否是Lambda表达式
    if (mainNode.type === 'lambda_expression') {
      extra.isLambda = true;
    }

    // 检查是否是协程
    const text = mainNode.text || '';
    if (text.includes('co_await') || text.includes('co_yield') || text.includes('co_return')) {
      extra.isCoroutine = true;
    }

    return extra;
  }

  mapQueryTypeToStandardType(queryType: string): StandardType {
    const mapping: Record<string, StandardType> = {
      'functions': 'function',
      'classes': 'class',
      'variables': 'variable',
      'types': 'type',
      'namespaces': 'class',  // 命名空间映射为类
      'preprocessor': 'expression',  // 预处理器映射为表达式
      'control-flow': 'control-flow',
      'modern-features': 'expression',  // 现代特性映射为表达式
      
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
    if (nodeType.includes('class') || nodeType.includes('struct')) complexity += 2;
    if (nodeType.includes('function') || nodeType.includes('method')) complexity += 1;
    if (nodeType.includes('template')) complexity += 2;
    if (nodeType.includes('operator')) complexity += 1;
    if (nodeType.includes('data-flow')) complexity += 2;
    if (nodeType.includes('semantic-relationship')) complexity += 3;
    if (nodeType.includes('lifecycle-relationship')) complexity += 3;
    if (nodeType.includes('concurrency-relationship')) complexity += 3;

    // C++特定的复杂度因素
    const text = mainNode.text || '';
    if (text.includes('template')) complexity += 2; // 模板
    if (text.includes('virtual')) complexity += 1; // 虚函数
    if (text.includes('override')) complexity += 1; // 重写
    if (text.includes('constexpr')) complexity += 1; // 常量表达式
    if (text.includes('consteval')) complexity += 1; // 立即函数
    if (text.includes('constinit')) complexity += 1; // 常量初始化
    if (text.includes('noexcept')) complexity += 1; // 异常规范
    if (text.includes('lambda') || text.includes('[]')) complexity += 1; // Lambda表达式
    if (text.includes('co_await') || text.includes('co_yield') || text.includes('co_return')) complexity += 2; // 协程
    if (text.includes('concept')) complexity += 2; // 概念
    if (text.includes('requires')) complexity += 1; // 约束
    if (text.includes('thread') || text.includes('mutex') || text.includes('condition_variable')) complexity += 2; // 多线程
    if (text.includes('unique_ptr') || text.includes('shared_ptr') || text.includes('weak_ptr')) complexity += 1; // 智能指针
    if (text.includes('std::') || text.includes('::')) complexity += 1; // 命名空间使用
    if (text.includes('try') || text.includes('catch')) complexity += 1; // 异常处理

    return complexity;
  }

  extractDependencies(result: any): string[] {
    const dependencies: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return dependencies;
    }

    // 使用辅助方法查找依赖
    CppHelperMethods.findTypeReferences(mainNode, dependencies);
    CppHelperMethods.findFunctionCalls(mainNode, dependencies);
    CppHelperMethods.findTemplateDependencies(mainNode, dependencies);
    CppHelperMethods.findDataFlowDependencies(mainNode, dependencies);
    CppHelperMethods.findConcurrencyDependencies(mainNode, dependencies);

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;

    if (!mainNode) {
      return modifiers;
    }

    // 检查C++常见的修饰符
    const text = mainNode.text || '';

    if (text.includes('virtual')) modifiers.push('virtual');
    if (text.includes('static')) modifiers.push('static');
    if (text.includes('const')) modifiers.push('const');
    if (text.includes('volatile')) modifiers.push('volatile');
    if (text.includes('inline')) modifiers.push('inline');
    if (text.includes('extern')) modifiers.push('extern');
    if (text.includes('mutable')) modifiers.push('mutable');
    if (text.includes('thread_local')) modifiers.push('thread_local');
    if (text.includes('constexpr')) modifiers.push('constexpr');
    if (text.includes('consteval')) modifiers.push('consteval');
    if (text.includes('constinit')) modifiers.push('constinit');
    if (text.includes('explicit')) modifiers.push('explicit');
    if (text.includes('override')) modifiers.push('override');
    if (text.includes('final')) modifiers.push('final');
    if (text.includes('noexcept')) modifiers.push('noexcept');
    if (text.includes('throw')) modifiers.push('throw');
    if (text.includes('public:')) modifiers.push('public');
    if (text.includes('private:')) modifiers.push('private');
    if (text.includes('protected:')) modifiers.push('protected');
    if (text.includes('friend')) modifiers.push('friend');
    if (text.includes('co_await')) modifiers.push('coroutine');
    if (text.includes('co_yield')) modifiers.push('coroutine');
    if (text.includes('co_return')) modifiers.push('coroutine');
    if (text.includes('requires')) modifiers.push('requires');
    if (text.includes('concept')) modifiers.push('concept');
    if (text.includes('decltype')) modifiers.push('decltype');

    return modifiers;
  }

  // 高级关系提取方法 - 委托给专门的提取器
  extractDataFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'assignment' | 'parameter' | 'return';
  }> {
    return this.dataFlowExtractor.extractDataFlowRelationships(result);
  }

  extractControlFlowRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'conditional' | 'loop' | 'exception' | 'callback';
  }> {
    return this.controlFlowExtractor.extractControlFlowRelationships(result);
  }

  extractSemanticRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'overrides' | 'overloads' | 'delegates' | 'observes' | 'configures';
  }> {
    return this.semanticExtractor.extractSemanticRelationships(result);
  }

  extractLifecycleRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'instantiates' | 'initializes' | 'destroys' | 'manages';
  }> {
    return this.lifecycleExtractor.extractLifecycleRelationships(result);
  }

  extractConcurrencyRelationships(result: any): Array<{
    source: string;
    target: string;
    type: 'synchronizes' | 'locks' | 'communicates' | 'races';
  }> {
    return this.concurrencyExtractor.extractConcurrencyRelationships(result);
  }

  // 重写isBlockNode方法以支持C++特定的块节点类型
  protected isBlockNode(node: any): boolean {
    const cppBlockTypes = [
      'compound_statement', 'class_specifier', 'struct_specifier', 'function_definition',
      'method_declaration', 'namespace_definition', 'if_statement', 'for_statement',
      'while_statement', 'do_statement', 'switch_statement', 'try_statement', 'template_declaration'
    ];
    return cppBlockTypes.includes(node.type) || super.isBlockNode(node);
  }

  // 重写normalize方法以集成nodeId生成和符号信息
  async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
    const results: StandardizedQueryResult[] = [];

    // Initialize symbol table for the current processing context
    // In a real scenario, filePath would be passed in. For now, we'll use a placeholder.
    const filePath = 'current_file.cpp';
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

        // 构建元数据，确保关系元数据正确合并
        const metadata: any = {
          language,
          complexity,
          dependencies,
          modifiers,
        };

        // 添加语言特定元数据
        if (extra && Object.keys(extra).length > 0) {
          metadata.extra = extra;
        }

        // 添加关系特定元数据
        if (relationshipMetadata) {
          // 如果extra不存在，创建它
          if (!metadata.extra) {
            metadata.extra = {};
          }
          
          // 合并关系元数据到extra中
          Object.assign(metadata.extra, relationshipMetadata);
          
          // 对于关系类型，也添加一些顶级属性以便于访问
          if (relationshipMetadata.type) {
            metadata.relationshipType = relationshipMetadata.type;
          }
          if (relationshipMetadata.fromNodeId) {
            metadata.fromNodeId = relationshipMetadata.fromNodeId;
          }
          if (relationshipMetadata.toNodeId) {
            metadata.toNodeId = relationshipMetadata.toNodeId;
          }
        }

        results.push({
          nodeId,
          type: standardType,
          name,
          startLine: result.startLine || 1,
          endLine: result.endLine || 1,
          content,
          metadata,
          symbolInfo: symbolInfo || undefined
        });
      } catch (error) {
        this.logger?.error(`Error normalizing C++ result: ${error}`);
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
      if (current.type === 'class_specifier' || current.type === 'struct_specifier') {
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
    // For C++ includes
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
        return this.callExtractor.extractCallMetadata(result, astNode, this.symbolTable);
      case 'data-flow':
        return this.dataFlowExtractor.extractDataFlowMetadata(result, astNode, this.symbolTable);
      case 'inheritance':
        return this.inheritanceExtractor.extractInheritanceMetadata(result, astNode, this.symbolTable);
      case 'concurrency':
        return this.concurrencyExtractor.extractConcurrencyMetadata(result, astNode, this.symbolTable);
      case 'lifecycle':
        return this.lifecycleExtractor.extractLifecycleMetadata(result, astNode, this.symbolTable);
      case 'semantic':
        return this.semanticExtractor.extractSemanticMetadata(result, astNode, this.symbolTable);
      case 'control-flow':
        return this.controlFlowExtractor.extractControlFlowMetadata(result, astNode, this.symbolTable);
      default:
        return null;
    }
  }
}