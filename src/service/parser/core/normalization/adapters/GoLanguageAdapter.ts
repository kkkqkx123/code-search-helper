import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult } from '../types';

/**
 * Go语言适配器
 * 处理Go特定的查询结果标准化
 */
export class GoLanguageAdapter extends BaseLanguageAdapter {
  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  getSupportedQueryTypes(): string[] {
    return [
      'functions-types',
      'variables-imports',
      'expressions-control-flow'
    ];
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {
      // Function related
      'function_declaration': 'functionDeclaration',
      'method_declaration': 'methodDeclaration',
      'func_literal': 'lambdaExpression', // Anonymous functions
      'function_type': 'typeAnnotation',

      // Type related
      'type_declaration': 'classDeclaration', // Go structs/interfaces as class-like
      'struct_type': 'structDeclaration',
      'interface_type': 'interfaceDeclaration',
      'type_alias': 'typeAnnotation',
      'type_identifier': 'propertyIdentifier',
      'field_declaration': 'memberExpression',
      'field_identifier': 'propertyIdentifier',
      'qualified_type': 'typeAnnotation', // Qualified types (package.Type)

      // Import related
      'import_declaration': 'importDeclaration',
      'import_spec': 'importDeclaration',
      'package_clause': 'importDeclaration',
      'dot': 'importDeclaration', // Dot import identifier

      // Variable related
      'var_declaration': 'variableDeclaration',
      'var_spec': 'variableDeclaration',
      'const_declaration': 'variableDeclaration',
      'const_spec': 'variableDeclaration',
      'assignment_statement': 'variableDeclaration',
      'short_var_declaration': 'variableDeclaration',
      'parameter_declaration': 'variableDeclaration',
      'variadic_parameter_declaration': 'variableDeclaration',
      'identifier': 'propertyIdentifier',

      // Control flow - map to variableDeclaration since there's no control-flow category
      'if_statement': 'variableDeclaration',
      'for_statement': 'variableDeclaration',
      'range_clause': 'variableDeclaration',
      'select_statement': 'variableDeclaration',
      'expression_case': 'variableDeclaration',
      'default_case': 'variableDeclaration',
      'type_case': 'variableDeclaration',
      'type_switch_statement': 'variableDeclaration',
      'return_statement': 'variableDeclaration',
      'defer_statement': 'variableDeclaration',
      'go_statement': 'variableDeclaration',
      'break_statement': 'variableDeclaration',
      'continue_statement': 'variableDeclaration',
      'fallthrough_statement': 'variableDeclaration',
      'block': 'variableDeclaration',
      'labeled_statement': 'variableDeclaration', // Labeled statements

      // Expressions
      'call_expression': 'callExpression',
      'selector_expression': 'memberExpression',
      'composite_literal': 'variableDeclaration',
      'slice_expression': 'variableDeclaration',
      'index_expression': 'variableDeclaration',
      'send_statement': 'variableDeclaration',
      'unary_expression': 'variableDeclaration',
      'binary_expression': 'variableDeclaration',
      'type_assertion_expression': 'variableDeclaration',
      'type_conversion_expression': 'variableDeclaration',
      'expression_statement': 'variableDeclaration',
      'parenthesized_expression': 'variableDeclaration',
      'argument_list': 'variableDeclaration',
      'expression_list': 'variableDeclaration',
      'literal_value': 'variableDeclaration',
      'keyed_element': 'variableDeclaration',
      'literal_element': 'variableDeclaration',
      'inc_statement': 'variableDeclaration', // Increment statements
      'dec_statement': 'variableDeclaration', // Decrement statements
      'variadic_argument': 'variableDeclaration', // Variadic arguments
      'escape_sequence': 'variableDeclaration', // Escape sequences

      // Literals
      'int_literal': 'variableDeclaration',
      'float_literal': 'variableDeclaration',
      'interpreted_string_literal': 'variableDeclaration',
      'raw_string_literal': 'variableDeclaration',
      'rune_literal': 'variableDeclaration',

      // Types
      'array_type': 'typeAnnotation',
      'slice_type': 'typeAnnotation',
      'map_type': 'typeAnnotation',
      'pointer_type': 'typeAnnotation',
      'channel_type': 'typeAnnotation',
      'type_parameter_list': 'genericTypes',

      // Others
      'comment': 'variableDeclaration',
      'blank_identifier': 'variableDeclaration',
      'iota': 'variableDeclaration',
      'package_identifier': 'propertyIdentifier'
    };

    return typeMapping[nodeType] || 'variableDeclaration';
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      'name.definition.function',
      'name.definition.method',
      'name.definition.type',
      'name.definition.interface',
      'name.definition.struct',
      'name.definition.var',
      'name.definition.const',
      'name.definition.import',
      'name.definition.package',
      'name.definition.call',
      'name.definition.field',
      'name.definition.field_identifier',
      'name.definition.identifier',
      'name.definition.type_identifier',
      'name.definition.package_identifier',
      'name.definition.test',
      'name.definition.benchmark',
      'name.definition.example',
      'name.definition.selector',
      'name.definition.composite_literal',
      'name.definition.channel',
      'name.definition.if',
      'name.definition.for',
      'name.definition.return',
      'name.definition.defer',
      'name.definition.goroutine',
      'name.definition.block',
      'name.definition.expression',
      'name.definition.string_literal',
      'name.definition.int_literal',
      'name.definition.float_literal',
      'name.definition.rune_literal',
      'name.definition.comment',
      'name.definition.type_alias',
      'name.definition.func_literal',
      'name.definition.function_type',
      'name.definition.type_parameter_list',
      'name.definition.generic_type',
      'name.definition.field_declaration',
      'name.definition.parameter',
      'name.definition.variadic_parameter',
      'name.definition.import_spec',
      'name.definition.var_spec',
      'name.definition.const_spec',
      'name.definition.assignment',
      'name.definition.short_var',
      'name.definition.embedded_field',
      'name.definition.qualified_embedded_field',
      'name.definition.variadic',
      'name.definition.blank_identifier',
      'name.definition.iota',
      'name.definition.dot_import',
      'name.definition.import_path',
      'name.definition.type_assertion',
      'name.definition.type_conversion',
      'name.definition.slice',
      'name.definition.index',
      'name.definition.send',
      'name.definition.receive',
      'name.definition.range',
      'name.definition.select',
      'name.definition.case',
      'name.definition.default_case',
      'name.definition.type_switch',
      'name.definition.type_case',
      'name.definition.binary',
      'name.definition.unary',
      'name.definition.inc',
      'name.definition.dec',
      'name.definition.raw_string_literal',
      'name.definition.qualified_type',
      'name.definition.array_type',
      'name.definition.slice_type',
      'name.definition.map_type',
      'name.definition.pointer_type',
      'name.definition.label',
      'name.definition.break',
      'name.definition.continue',
      'name.definition.fallthrough',
      'name.definition.parenthesized',
      'name.definition.builtin',
      'name.definition.generic_call',
      'name.definition.variadic_argument',
      'name.definition.argument_list',
      'name.definition.expression_list',
      'name.definition.literal_value',
      'name.definition.keyed_element',
      'name.definition.literal_element',
      'name.definition.escape_sequence'
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

    // 对于Go，尝试从特定字段提取名称
    const mainNode = result.captures?.[0]?.node;
    if (mainNode) {
      // 尝试获取标识符
      const identifier = mainNode.childForFieldName?.('identifier') ||
                        mainNode.childForFieldName?.('type_identifier') ||
                        mainNode.childForFieldName?.('field_identifier') ||
                        mainNode.childForFieldName?.('package_identifier');
      if (identifier?.text) {
        return identifier.text;
      }

      // 尝试获取name字段
      const nameNode = mainNode.childForFieldName?.('name');
      if (nameNode?.text) {
        return nameNode.text;
      }
      
      // For function declarations, try to get the name of the function
      if (mainNode.type === 'function_declaration') {
        // Look for the name identifier in the function declaration
        if (mainNode.children) {
          for (const child of mainNode.children) {
            if (child.type === 'identifier' && child.text) {
              return child.text;
            }
          }
        }
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
    if (typeof mainNode.childForFieldName === 'function') {
      const parameters = mainNode.childForFieldName('parameters');
      if (parameters) {
        extra.parameterCount = parameters.childCount;
      }

      // 提取返回类型
      const returnType = mainNode.childForFieldName('type');
      if (returnType) {
        extra.returnType = returnType.text;
      }

      // 提取接收器（对于方法）
      const receiver = mainNode.childForFieldName('receiver');
      if (receiver) {
        extra.receiver = receiver.text;
        extra.isMethod = true;
      }

      // 提取嵌入式字段信息
      const type = mainNode.childForFieldName('type');
      if (type && mainNode.type === 'field_declaration') {
        extra.embedded = type.text;
      }

      // 提取类型参数
      const typeParameterList = mainNode.childForFieldName('type_parameter_list');
      if (typeParameterList) {
        extra.hasGeneric = true;
        extra.typeParameters = typeParameterList.text;
      }

      // 提取导出状态
      const nameNode = mainNode.childForFieldName('name');
      if (nameNode?.text && nameNode.text && /^[A-Z]/.test(nameNode.text)) {
        extra.isExported = true;
      }
    }

    // 检查是否是接口类型
    if (mainNode.type === 'interface_type') {
      extra.isInterface = true;
    }

    // 检查是否是结构体类型
    if (mainNode.type === 'struct_type') {
      extra.isStruct = true;
    }

    // 检查是否是方法（通过查看是否包含接收者）
    if (mainNode.type === 'method_declaration' || extra.receiver) {
      extra.isMethod = true;
    }

    // 检查是否是匿名函数
    if (mainNode.type === 'func_literal') {
      extra.isAnonymous = true;
    }

    // 检查是否是内置函数
    if (mainNode.type === 'call_expression') {
      const funcNode = mainNode.childForFieldName?.('function') || 
                      mainNode.childForFieldName?.('name') ||
                      (mainNode.children?.[0]?.type === 'identifier' ? mainNode.children[0] : null);
      if (funcNode && this.isBuiltinFunction(funcNode.text)) {
        extra.isBuiltinCall = true;
      }
    }

    return extra;
  }

  mapQueryTypeToStandardType(queryType: string): 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' {
    const mapping: Record<string, 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression'> = {
      'functions-types': 'function',
      'variables-imports': 'variable',
      'expressions-control-flow': 'expression'
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
    if (nodeType.includes('function') || nodeType.includes('method')) complexity += 1;
    if (nodeType.includes('struct') || nodeType.includes('interface')) complexity += 1;
    if (nodeType.includes('type')) complexity += 1;

    // Go特定复杂度因素
    const text = this.extractContent(result);
    if (text.includes('goroutine') || text.includes('go ')) complexity += 1; // Goroutines
    if (text.includes('channel') || text.includes('<-')) complexity += 1; // Channels
    if (text.includes('select')) complexity += 1; // Select statements
    if (text.includes('interface{}')) complexity += 1; // Empty interface
    if (text.includes('defer')) complexity += 1; // Defer statements
    if (text.includes('range')) complexity += 1; // Range loops
    if (text.includes('panic') || text.includes('recover')) complexity += 1; // Error handling
    if (text.includes('context')) complexity += 1; // Context usage
    if (text.includes('mutex') || text.includes('sync')) complexity += 1; // Synchronization
    if (text.includes('error')) complexity += 0.5; // Error handling

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
          // 提取导入的包
          const importText = capture.node.text;
          // 例如从 "import \"fmt\"" 提取包名
          const packageMatch = importText.match(/["']([^"']+)["']/);
          if (packageMatch) {
            dependencies.push(packageMatch[1]);
          }
        }
      }
    }

    // 查找类型引用
    this.findTypeReferences(mainNode, dependencies);

    // 查找函数调用引用
    this.findFunctionCalls(mainNode, dependencies);

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    
    // 使用extractContent方法获取内容，这样可以正确处理mock的情况
    const text = this.extractContent(result);
    
    // Go特定的修饰符/特性
    if (text.includes('func')) modifiers.push('function');
    if (text.includes('type')) modifiers.push('type');
    if (text.includes('interface')) modifiers.push('interface');
    if (text.includes('struct')) modifiers.push('struct');
    if (text.includes('var')) modifiers.push('variable');
    if (text.includes('const')) modifiers.push('constant');
    if (text.includes('import')) modifiers.push('import');
    if (text.includes('package')) modifiers.push('package');
    
    // Go并发特性
    if (text.includes('go ')) modifiers.push('goroutine');
    if (text.includes('<-')) modifiers.push('channel');
    if (text.includes('select')) modifiers.push('select');
    if (text.includes('defer')) modifiers.push('defer');
    if (text.includes('range')) modifiers.push('range');
    
    // Go错误处理特性
    if (text.includes('error')) modifiers.push('error-handling');
    if (text.includes('panic')) modifiers.push('panic');
    if (text.includes('recover')) modifiers.push('recover');
    
    // Go包导出特性
    if (text.match(/\b[A-Z]\w*/)) modifiers.push('exported'); // Exported identifiers start with capital letter
    
    // Go特殊标识符
    if (text.includes('_')) modifiers.push('blank-identifier');
    if (text.includes('iota')) modifiers.push('iota');
    
    return modifiers;
  }

  // Go特定的辅助方法

  private isBuiltinFunction(funcName: string): boolean {
    const builtinFunctions = [
      'append', 'cap', 'close', 'complex', 'copy', 'delete', 'imag', 'len', 
      'make', 'new', 'panic', 'print', 'println', 'real', 'recover'
    ];
    return builtinFunctions.includes(funcName);
  }

  private findFunctionCalls(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找函数调用
      if (child.type === 'call_expression') {
        const funcNode = child.childForFieldName?.('function') || 
                        child.childForFieldName?.('name') ||
                        (child.children?.[0] || null);
        if (funcNode?.text) {
          dependencies.push(funcNode.text);
        }
      } else if (child.type === 'identifier' && child.text) {
        // Also add identifiers that might be function calls
        dependencies.push(child.text);
      }
      
      this.findFunctionCalls(child, dependencies);
    }
  }

  // 重写isBlockNode方法以支持Go特定的块节点类型
  protected isBlockNode(node: any): boolean {
    const goBlockTypes = [
      'block', 'function_declaration', 'method_declaration', 'func_literal',
      'if_statement', 'for_statement', 'switch_statement', 'select_statement',
      'type_switch_statement', 'block'
    ];
    return goBlockTypes.includes(node.type) || super.isBlockNode(node);
  }
}