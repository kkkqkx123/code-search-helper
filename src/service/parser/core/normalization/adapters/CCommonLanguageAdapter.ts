import { ILanguageAdapter, StandardizedQueryResult } from '../types';
import { LoggerService } from '../../../../../utils/LoggerService';

/**
 * C/C#/C++ 共同语言适配器
 * 处理C、C#和C++特定的查询结果标准化
 */
export class CCommonLanguageAdapter implements ILanguageAdapter {
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
           type: this.mapQueryTypeToStandardType(queryType, language),
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
         this.logger.warn(`Failed to normalize ${language} result for ${queryType}:`, error);
       }
     }
     
     return results.filter((result): result is StandardizedQueryResult => result !== null);
   }

  getSupportedQueryTypes(): string[] {
    return [
      'functions',
      'classes', 
      'methods',
      'imports',      // C++ includes, C# using directives
      'variables',
      'control-flow',
      'types',        // structs, unions, enums in C/C++; classes, interfaces, enums in C#
      'expressions',
      'namespaces',   // C++ namespaces, C# namespaces
      'properties',   // C# properties
      'patterns',     // C# pattern matching
      'linq'          // C# LINQ expressions
    ];
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {
      // C/C++ specific
      'function_definition': 'function',
      'function_declarator': 'function',
      'struct_specifier': 'class',
      'union_specifier': 'class',
      'enum_specifier': 'type',
      'type_definition': 'type',
      'field_declaration': 'property',  // C/C++ field
      'declaration': 'variable',
      'parameter_declaration': 'variable',
      'call_expression': 'function',   // C/C++ function call
      
      // C++ specific
      'class_specifier': 'class',
      'template_declaration': 'class',
      'constructor_initializer': 'function',
      'destructor_name': 'function',
      'access_specifier': 'type',
      'base_class_clause': 'class',
      'member_initializer': 'property',
      'friend_declaration': 'function',
      'namespace_definition': 'namespace',
      'namespace_alias_definition': 'namespace',
      
      // C# specific
      'method_declaration': 'method',
      'class_declaration': 'class',
      'interface_declaration': 'interface',
      'struct_declaration': 'class',
      'enum_declaration': 'type',
      'record_declaration': 'class',
      'csharp_field_declaration': 'variable',  // 重命名C# field以避免冲突
      'property_declaration': 'property',
      'constructor_declaration': 'function',
      'destructor_declaration': 'function',
      'namespace_declaration': 'namespace',
      'using_directive': 'import',
      'operator_declaration': 'function',
      'conversion_operator_declaration': 'function',
      'accessor_declaration': 'method',
      'get_accessor_declaration': 'method',
      'set_accessor_declaration': 'method',
      'init_accessor_declaration': 'method',
      'add_accessor_declaration': 'method',
      'remove_accessor_declaration': 'method',
      'lambda_expression': 'function',
      'anonymous_method_expression': 'function',
      'invocation_expression': 'function',
      'record_class_declaration': 'class',
      'record_struct_declaration': 'class',
      'event_field_declaration': 'property',
      'attribute': 'type',
      'attribute_list': 'type',
      'type_parameter': 'type',
      
      // Control flow
      'if_statement': 'control-flow',
      'for_statement': 'control-flow',
      'while_statement': 'control-flow',
      'do_statement': 'control-flow',
      'switch_statement': 'control-flow',
      'try_statement': 'control-flow',
      'catch_clause': 'control-flow',
      'finally_clause': 'control-flow',
      
      // Expressions
      'assignment_expression': 'expression',
      'binary_expression': 'expression',
      'unary_expression': 'expression',
      'conditional_expression': 'expression',
      'csharp_call_expression': 'expression',  // 重命名C# call以避免冲突
      'subscript_expression': 'expression',
      'field_expression': 'expression',
      'identifier': 'expression'
    };
    
    return typeMapping[nodeType] || nodeType;
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      'name.definition.function',
      'name.definition.method',
      'name.definition.class',
      'name.definition.interface',
      'name.definition.type',
      'name.definition.variable',
      'name.definition.property',
      'name.definition.constructor',
      'name.definition.destructor',
      'name.definition.operator',
      'name.definition.namespace',
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
    
    // 对于C/C++/C#，尝试从特定字段提取名称
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
    if (nodeType.includes('class') || nodeType.includes('struct') || nodeType.includes('interface')) complexity += 2;
    if (nodeType.includes('function') || nodeType.includes('method') || nodeType.includes('constructor')) complexity += 1;
    if (nodeType.includes('template')) complexity += 1;
    if (nodeType.includes('operator')) complexity += 1;

    // 基于代码行数增加复杂度
    const lineCount = this.extractEndLine(result) - this.extractStartLine(result) + 1;
    complexity += Math.floor(lineCount / 10);

    // 基于嵌套深度增加复杂度
    const nestingDepth = this.calculateNestingDepth(mainNode);
    complexity += nestingDepth;

    // 通用复杂度因素
    const text = mainNode.text || '';
    if (text.includes('template') || text.includes('generic')) complexity += 1; // 模板/泛型
    if (text.includes('virtual')) complexity += 1; // 虚函数
    if (text.includes('override')) complexity += 1; // 重写
    if (text.includes('async') || text.includes('await')) complexity += 1; // 异步
    if (text.includes('lambda') || text.includes('=>')) complexity += 1; // Lambda表达式

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

    // 检查常见的修饰符
    const text = mainNode.text || '';
    
    if (text.includes('virtual')) modifiers.push('virtual');
    if (text.includes('static')) modifiers.push('static');
    if (text.includes('public:')) modifiers.push('public');
    if (text.includes('private:')) modifiers.push('private');
    if (text.includes('protected:')) modifiers.push('protected');
    if (text.includes('public')) modifiers.push('public');
    if (text.includes('private')) modifiers.push('private');
    if (text.includes('protected')) modifiers.push('protected');
    if (text.includes('internal')) modifiers.push('internal');
    if (text.includes('abstract')) modifiers.push('abstract');
    if (text.includes('sealed')) modifiers.push('sealed');
    if (text.includes('override')) modifiers.push('override');
    if (text.includes('async')) modifiers.push('async');
    if (text.includes('extern')) modifiers.push('extern');
    if (text.includes('unsafe')) modifiers.push('unsafe');
    if (text.includes('partial')) modifiers.push('partial');
    if (text.includes('new')) modifiers.push('new');
    if (text.includes('const')) modifiers.push('const');
    if (text.includes('volatile')) modifiers.push('volatile');
    if (text.includes('inline')) modifiers.push('inline');
    if (text.includes('explicit')) modifiers.push('explicit');
    if (text.includes('friend')) modifiers.push('friend');
    if (text.includes('final')) modifiers.push('final');

    return modifiers;
  }

  extractExtraInfo(result: any): Record<string, any> {
    const extra: Record<string, any> = {};
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return extra;
    }

    // 提取模板/泛型信息
    const templateParameters = mainNode.childForFieldName?.('parameters') ||
                              mainNode.childForFieldName?.('type_parameters');
    if (templateParameters) {
      extra.hasTemplate = true;
      extra.templateParameters = templateParameters.text;
    }

    // 提取继承信息
    const heritageClause = mainNode.childForFieldName?.('base_class_clause') ||
                          mainNode.childForFieldName?.('superclasses');
    if (heritageClause) {
      extra.hasInheritance = true;
      extra.extends = heritageClause.text;
    }

    // 提取参数信息（对于函数）
    const parameters = mainNode.childForFieldName?.('parameters');
    if (parameters) {
      extra.parameterCount = parameters.childCount;
    }

    // 提取访问修饰符
    const accessSpecifier = mainNode.childForFieldName?.('access_specifier');
    if (accessSpecifier) {
      extra.accessModifier = accessSpecifier.text;
    }

    // 提取返回类型
    const returnType = mainNode.childForFieldName?.('type') ||
                      mainNode.childForFieldName?.('return_type');
    if (returnType) {
      extra.returnType = returnType.text;
    }

    return extra;
  }

  private mapQueryTypeToStandardType(queryType: string, language: string): 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' {
    const mapping: Record<string, 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression'> = {
      'functions': 'function',
      'classes': 'class',
      'methods': 'method',
      'imports': 'import',  // C++ includes, C# using
      'variables': 'variable',
      'control-flow': 'control-flow',
      'types': 'type',
      'expressions': 'expression',
      'namespaces': 'class',  // 命名空间映射为类
      'properties': 'variable',  // 属性映射为变量，因为StandardizedQueryResult不支持property类型
      'patterns': 'expression', // C# patterns
      'linq': 'expression',  // C# LINQ
      'structs': 'class',  // 结构体映射为类
      'unions': 'class',  // 联合体映射为类
      'enums': 'type',  // 枚举映射为类型
      'preprocessor': 'expression',  // 预处理器映射为表达式
      'modern-features': 'expression',  // 现代特性映射为表达式
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
      'compound_statement', 'statement_block', 'class_specifier', 'struct_specifier', 
      'function_definition', 'method_declaration', 'class_declaration', 'block',
      'function_body', 'class_body', 'struct_body', 'if_statement', 'for_statement',
      'while_statement', 'do_statement', 'switch_statement', 'try_statement'
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
      } else if (child.type === 'qualified_name' || child.type === 'dotted_name') {
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
      if (child.type === 'call_expression' || child.type === 'invocation_expression') {
        const functionNode = child.childForFieldName('function') ||
                            child.childForFieldName('name') ||
                            child.childForFieldName('method');
        if (functionNode?.text) {
          dependencies.push(functionNode.text);
        }
      }
      
      this.findFunctionCalls(child, dependencies);
    }
  }
}