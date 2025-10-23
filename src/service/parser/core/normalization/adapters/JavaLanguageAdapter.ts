import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult } from '../types';

/**
 * Java语言适配器
 * 处理Java特定的查询结果标准化
 */
export class JavaLanguageAdapter extends BaseLanguageAdapter {
  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  getSupportedQueryTypes(): string[] {
    return [
      'classes-interfaces',
      'methods-variables', 
      'control-flow-patterns',
      'functions',
      'classes',
      'methods',
      'imports',
      'variables',
      'control-flow',
      'types',
      'interfaces',
      'enums',
      'records',
      'annotations'
    ];
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {
      // Java specific
      'class_declaration': 'class',
      'interface_declaration': 'interface',
      'enum_declaration': 'type',
      'record_declaration': 'class',
      'annotation_type_declaration': 'interface',
      'module_declaration': 'class',
      'package_declaration': 'import',
      
      // Methods and constructors
      'method_declaration': 'method',
      'constructor_declaration': 'method',
      'lambda_expression': 'function',
      
      // Variables and fields
      'field_declaration': 'variable',
      'local_variable_declaration': 'variable',
      'variable_declarator': 'variable',
      'formal_parameter': 'variable',
      
      // Imports
      'import_declaration': 'import',
      
      // Control flow
      'if_statement': 'control-flow',
      'for_statement': 'control-flow',
      'enhanced_for_statement': 'control-flow',
      'while_statement': 'control-flow',
      'do_statement': 'control-flow',
      'switch_statement': 'control-flow',
      'switch_expression': 'control-flow',
      'try_statement': 'control-flow',
      'catch_clause': 'control-flow',
      'finally_clause': 'control-flow',
      
      // Expressions
      'assignment_expression': 'expression',
      'binary_expression': 'expression',
      'unary_expression': 'expression',
      'instanceof_expression': 'expression',
      'method_invocation': 'expression',
      'object_creation_expression': 'expression',
      
      // Types
      'type_identifier': 'type',
      'generic_type': 'type',
      'array_type': 'type',
      'integral_type': 'type',
      'floating_point_type': 'type',
      'boolean_type': 'type',
      'void_type': 'type',
      
      // Annotations
      'annotation': 'type',
      'marker_annotation': 'type',
      
      // Modifiers
      'modifiers': 'type'
    };
    
    return typeMapping[nodeType] || nodeType;
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      'name.definition.class',
      'name.definition.interface',
      'name.definition.enum',
      'name.definition.record',
      'name.definition.annotation',
      'name.definition.method',
      'name.definition.constructor',
      'name.definition.field',
      'name.definition.local_variable',
      'name.definition.parameter',
      'name.definition.import',
      'name.definition.static_import',
      'name.definition.package',
      'name.definition.module',
      'name.definition.lambda_parameter',
      'name.definition.enum_constant',
      'name.definition.type_parameter',
      'name.definition.annotation_name',
      'name.definition.marker_annotation',
      'name.definition.method_call',
      'name.definition.constructor_call',
      'name.definition.generic_type',
      'name.definition.array_type',
      'name.definition.type_identifier',
      'name.definition.scoped_identifier',
      'name.definition.superclass',
      'name.definition.super_interface',
      'name.definition.exception_variable',
      'name.definition.for_variable',
      'name.definition.pattern_variable',
      'name.definition.record_pattern_component',
      'name.definition.variable_declarator',
      'name.definition.identifier',
      // 新增的捕获名称
      'name.definition.annotation_body',
      'name.definition.assert_statement',
      'name.definition.assignment_expression',
      'name.definition.assignment_target',
      'name.definition.binary_expression',
      'name.definition.binary_integer_literal',
      'name.definition.block',
      'name.definition.block_comment',
      'name.definition.boolean_type',
      'name.definition.break_statement',
      'name.definition.cast_expression',
      'name.definition.cast_value',
      'name.definition.catch_clause',
      'name.definition.catch_parameter',
      'name.definition.character_literal',
      'name.definition.class_body',
      'name.definition.class_literal',
      'name.definition.continue_statement',
      'name.definition.decimal_floating_point_literal',
      'name.definition.decimal_integer_literal',
      'name.definition.dimensions',
      'name.definition.do_statement',
      'name.definition.enhanced_for_statement',
      'name.definition.enhanced_for_variable',
      'name.definition.enhanced_for_with_iterable',
      'name.definition.enum_body',
      'name.definition.escape_sequence',
      'name.definition.expression_statement',
      'name.definition.false_literal',
      'name.definition.floating_point_type',
      'name.definition.for_iterable',
      'name.definition.for_statement',
      'name.definition.formal_parameters',
      'name.definition.guard',
      'name.definition.hex_floating_point_literal',
      'name.definition.hex_integer_literal',
      'name.definition.if_condition',
      'name.definition.if_statement',
      'name.definition.if_with_condition',
      'name.definition.instanceof_expression',
      'name.definition.instanceof_with_pattern',
      'name.definition.integral_type',
      'name.definition.interface_body',
      'name.definition.labeled_statement',
      'name.definition.lambda',
      'name.definition.lambda_body',
      'name.definition.lambda_with_body',
      'name.definition.lambda_with_params',
      'name.definition.line_comment',
      'name.definition.method_invocation',
      'name.definition.modifiers',
      'name.definition.null_literal',
      'name.definition.object_creation',
      'name.definition.octal_integer_literal',
      'name.definition.parenthesized_expression',
      'name.definition.record_body',
      'name.definition.record_pattern',
      'name.definition.record_pattern_body',
      'name.definition.record_with_body',
      'name.definition.return_statement',
      'name.definition.scoped_type_identifier',
      'name.definition.string_fragment',
      'name.definition.string_literal',
      'name.definition.super_expression',
      'name.definition.super_interfaces',
      'name.definition.switch_block',
      'name.definition.switch_block_statement_group',
      'name.definition.switch_expression',
      'name.definition.switch_label',
      'name.definition.switch_rule',
      'name.definition.synchronized_statement',
      'name.definition.this_expression',
      'name.definition.throw_statement',
      'name.definition.true_literal',
      'name.definition.try_block',
      'name.definition.try_statement',
      'name.definition.try_with_block',
      'name.definition.try_with_resources',
      'name.definition.type_argument',
      'name.definition.type_pattern',
      'name.definition.type_pattern_with_variable',
      'name.definition.unary_expression',
      'name.definition.underscore_pattern',
      'name.definition.update_expression',
      'name.definition.void_type',
      'name.definition.while_statement',
      'name.definition.yield_statement'
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
    
    // 对于Java，尝试从特定字段提取名称
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

    // 提取泛型信息
    if (typeof mainNode.childForFieldName === 'function') {
      const typeParameters = mainNode.childForFieldName('type_parameters');
      if (typeParameters) {
        extra.hasGenerics = true;
        extra.typeParameters = typeParameters.text;
      }

      // 提取继承信息
      const superClass = mainNode.childForFieldName('superclass');
      if (superClass) {
        extra.hasSuperclass = true;
        extra.superclass = superClass.text;
      }

      const superInterfaces = mainNode.childForFieldName('super_interfaces');
      if (superInterfaces) {
        extra.hasInterfaces = true;
        extra.interfaces = superInterfaces.text;
      }

      // 提取参数信息（对于方法）
      const parameters = mainNode.childForFieldName('parameters');
      if (parameters) {
        extra.parameterCount = parameters.childCount;
      }

      // 提取返回类型
      const returnType = mainNode.childForFieldName('type');
      if (returnType) {
        extra.returnType = returnType.text;
      }

      // 提取异常声明
      const throws = mainNode.childForFieldName('throws');
      if (throws) {
        extra.hasThrows = true;
        extra.throws = throws.text;
      }

      // 提取包信息
      const packageNode = mainNode.childForFieldName('package');
      if (packageNode) {
        extra.package = packageNode.text;
      }

      // 提取模块信息
      const moduleName = mainNode.childForFieldName('name');
      if (moduleName && mainNode.type === 'module_declaration') {
        extra.moduleName = moduleName.text;
      }
    }

    // 提取注解信息
    const annotations = this.extractAnnotations(mainNode);
    if (annotations.length > 0) {
      extra.annotations = annotations;
    }

    // 检查是否是Lambda表达式
    if (mainNode.type === 'lambda_expression') {
      extra.isLambda = true;
    }

    // 检查是否是记录类型
    if (mainNode.type === 'record_declaration') {
      extra.isRecord = true;
    }

    return extra;
  }

  mapQueryTypeToStandardType(queryType: string): 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' {
    const mapping: Record<string, 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression'> = {
      'classes-interfaces': 'class',
      'methods-variables': 'method',
      'control-flow-patterns': 'control-flow',
      'functions': 'function',
      'classes': 'class',
      'methods': 'method',
      'imports': 'import',
      'variables': 'variable',
      'control-flow': 'control-flow',
      'types': 'type',
      'interfaces': 'interface',
      'enums': 'type',
      'records': 'class',
      'annotations': 'type'
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
    if (nodeType.includes('class') || nodeType.includes('interface') || nodeType.includes('enum')) complexity += 2;
    if (nodeType.includes('method') || nodeType.includes('constructor')) complexity += 1;
    if (nodeType.includes('lambda')) complexity += 1;
    if (nodeType.includes('generic')) complexity += 1;

    // Java特定复杂度因素
    const text = this.extractContent(result);
    if (text.includes('@Override')) complexity += 1; // 重写方法
    if (text.includes('abstract')) complexity += 1; // 抽象类/方法
    if (text.includes('synchronized')) complexity += 1; // 同步方法
    if (text.includes('native')) complexity += 1; // 本地方法
    if (text.includes('volatile')) complexity += 1; // 易失变量
    if (text.includes('transient')) complexity += 1; // 瞬时变量
    if (text.includes('final')) complexity += 0.5; // 最终变量/类
    if (text.includes('static')) complexity += 0.5; // 静态成员
    if (text.includes('throws')) complexity += 1; // 异常声明
    if (text.includes('try') || text.includes('catch') || text.includes('finally')) complexity += 1; // 异常处理
    if (text.includes('stream') || text.includes('Stream')) complexity += 1; // 流式API
    if (text.includes('lambda') || text.includes('->')) complexity += 1; // Lambda表达式

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
        if (capture.name && (capture.name.includes('import') || capture.name.includes('super')) && capture.node?.text) {
          // 提取导入的标识符
          const importText = capture.node.text;
          // 例如从 "java.util.List" 提取标识符
          const identifierMatch = importText.match(/([A-Za-z_][A-Za-z0-9_.]*)/g);
          if (identifierMatch) {
            dependencies.push(...identifierMatch);
          }
        }
      }
    }

    // 查找类型引用
    this.findTypeReferences(mainNode, dependencies);
    
    // 查找方法调用引用
    this.findMethodCalls(mainNode, dependencies);

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    
    // 使用extractContent方法获取内容，这样可以正确处理mock的情况
    const text = this.extractContent(result);
    
    if (text.includes('public')) modifiers.push('public');
    if (text.includes('private')) modifiers.push('private');
    if (text.includes('protected')) modifiers.push('protected');
    if (text.includes('static')) modifiers.push('static');
    if (text.includes('final')) modifiers.push('final');
    if (text.includes('abstract')) modifiers.push('abstract');
    if (text.includes('synchronized')) modifiers.push('synchronized');
    if (text.includes('volatile')) modifiers.push('volatile');
    if (text.includes('transient')) modifiers.push('transient');
    if (text.includes('native')) modifiers.push('native');
    if (text.includes('strictfp')) modifiers.push('strictfp');
    if (text.includes('default')) modifiers.push('default'); // 接口默认方法

    // 检查注解
    if (text.includes('@Override')) modifiers.push('override');
    if (text.includes('@Deprecated')) modifiers.push('deprecated');
    if (text.includes('@SuppressWarnings')) modifiers.push('suppress-warnings');
    if (text.includes('@FunctionalInterface')) modifiers.push('functional-interface');

    return modifiers;
  }

  // Java特定的辅助方法

  private extractAnnotations(node: any): string[] {
    const annotations: string[] = [];
    
    if (!node || !node.children) {
      return annotations;
    }

    for (const child of node.children) {
      if (child.type === 'annotation' || child.type === 'marker_annotation') {
        annotations.push(child.text);
      }
      annotations.push(...this.extractAnnotations(child));
    }

    return annotations;
  }

  private findMethodCalls(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找方法调用
      if (child.type === 'method_invocation') {
        const methodNode = child.childForFieldName('name');
        if (methodNode?.text) {
          dependencies.push(methodNode.text);
        }
      }
      
      this.findMethodCalls(child, dependencies);
    }
  }

  // 重写isBlockNode方法以支持Java特定的块节点类型
  protected isBlockNode(node: any): boolean {
    const javaBlockTypes = [
      'block', 'class_body', 'interface_body', 'enum_body', 'annotation_type_body',
      'method_declaration', 'constructor_declaration', 'for_statement', 'enhanced_for_statement',
      'while_statement', 'do_statement', 'if_statement', 'switch_statement', 'switch_expression',
      'try_statement', 'catch_clause', 'finally_clause', 'synchronized_statement'
    ];
    return javaBlockTypes.includes(node.type) || super.isBlockNode(node);
  }
}