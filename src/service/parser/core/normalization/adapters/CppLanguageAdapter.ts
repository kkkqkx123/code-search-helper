import { ILanguageAdapter, StandardizedQueryResult } from '../types';
import { LoggerService } from '../../../../../utils/LoggerService';

/**
 * C++ 语言适配器
 * 专门处理C++语言的查询结果标准化
 */
export class CppLanguageAdapter implements ILanguageAdapter {
  private logger: LoggerService;

  constructor() {
    this.logger = new LoggerService();
  }

  normalize(queryResults: any[], queryType: string, language: string): StandardizedQueryResult[] {
    const results: (StandardizedQueryResult | null)[] = [];

    for (const result of queryResults) {
      try {
        const extraInfo = this.extractExtraInfo(result);
        results.push({
          type: this.mapQueryTypeToStandardType(queryType),
          name: this.extractName(result),
          startLine: this.extractStartLine(result),
          endLine: this.extractEndLine(result),
          content: this.extractContent(result),
          metadata: {
            language,
            complexity: this.calculateComplexity(result),
            dependencies: this.extractDependencies(result),
            modifiers: this.extractModifiers(result),
            extra: Object.keys(extraInfo).length > 0 ? extraInfo : undefined
          }
        });
      } catch (error) {
        this.logger.warn(`Failed to normalize C++ result for ${queryType}:`, error);
      }
    }

    return results.filter((result): result is StandardizedQueryResult => result !== null);
  }

  getSupportedQueryTypes(): string[] {
    return [
      'classes',
      'functions',
      'variables',
      'types',
      'namespaces',
      'preprocessor',
      'control-flow',
      'modern-features'
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

  extractContent(result: any): string {
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return '';
    }

    return mainNode.text || '';
  }

  extractStartLine(result: any): number {
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return 1;
    }

    return (mainNode.startPosition?.row || 0) + 1; // 转换为1-based
  }

  extractEndLine(result: any): number {
    const mainNode = result.captures?.[0]?.node;
    if (!mainNode) {
      return 1;
    }

    return (mainNode.endPosition?.row || 0) + 1; // 转换为1-based
  }

  calculateComplexity(result: any): number {
    let complexity = 1; // 基础复杂度

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

    // 基于代码行数增加复杂度
    const lineCount = this.extractEndLine(result) - this.extractStartLine(result) + 1;
    complexity += Math.floor(lineCount / 10);

    // 基于嵌套深度增加复杂度
    const nestingDepth = this.calculateNestingDepth(mainNode);
    complexity += nestingDepth;

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

    // 查找模板依赖
    this.findTemplateDependencies(mainNode, dependencies);

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

    return modifiers;
  }

  extractExtraInfo(result: any): Record<string, any> {
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

    return extra;
  }

  private mapQueryTypeToStandardType(queryType: string): 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' {
    const mapping: Record<string, 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression'> = {
      'classes': 'class',
      'functions': 'function',
      'variables': 'variable',
      'types': 'type',
      'namespaces': 'class',  // 命名空间映射为类
      'preprocessor': 'expression',  // 预处理器映射为表达式
      'control-flow': 'control-flow',
      'modern-features': 'expression'  // 现代特性映射为表达式
    };

    return mapping[queryType] || 'expression';
  }

  private calculateNestingDepth(node: any, currentDepth: number = 0): number {
    if (!node || !node.children) {
      return currentDepth;
    }

    let maxDepth = currentDepth;

    for (const child of node.children) {
      if (this.isBlockNode(child)) {
        const childDepth = this.calculateNestingDepth(child, currentDepth + 1);
        maxDepth = Math.max(maxDepth, childDepth);
      }
    }

    return maxDepth;
  }

  private isBlockNode(node: any): boolean {
    const blockTypes = [
      'compound_statement', 'class_specifier', 'struct_specifier', 'function_definition',
      'method_declaration', 'namespace_definition', 'if_statement', 'for_statement',
      'while_statement', 'do_statement', 'switch_statement', 'try_statement', 'template_declaration'
    ];
    return blockTypes.includes(node.type);
  }

  private findTypeReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找类型引用模式
      if (child.type === 'type_identifier' || child.type === 'identifier') {
        const text = child.text;
        if (text && text[0] === text[0].toUpperCase()) {
          // 仅当名称以大写字母开头时才添加到依赖项（通常表示类型名）
          dependencies.push(text);
        }
      } else if (child.type === 'qualified_name') {
        // 处理命名空间或类名引用
        const text = child.text;
        if (text) {
          dependencies.push(text);
        }
      }

      this.findTypeReferences(child, dependencies);
    }
  }

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

  private findTemplateDependencies(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找模板实例化
      if (child.type === 'template_function' || child.type === 'template_type') {
        const identifier = child.childForFieldName('identifier') ||
          child.childForFieldName('type_identifier');
        if (identifier?.text) {
          dependencies.push(identifier.text);
        }
      }

      this.findTemplateDependencies(child, dependencies);
    }
  }
}