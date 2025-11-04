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
      'data-flow',
      'semantic-relationships',
      'lifecycle-relationships'
    ];
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {
      // Java specific - 映射到图映射中定义的类别
      'class_declaration': 'classDeclaration',
      'interface_declaration': 'interfaceDeclaration',
      'enum_declaration': 'enumDeclaration',
      'record_declaration': 'classDeclaration',
      'annotation_type_declaration': 'interfaceDeclaration',
      'module_declaration': 'classDeclaration',
      'package_declaration': 'importDeclaration',
      
      // Methods and constructors
      'method_declaration': 'methodDeclaration',
      'constructor_declaration': 'functionDeclaration',
      'lambda_expression': 'lambdaExpression',
      
      // Variables and fields
      'field_declaration': 'variableDeclaration',
      'local_variable_declaration': 'variableDeclaration',
      'variable_declarator': 'variableDeclaration',
      'formal_parameter': 'variableDeclaration',
      
      // Imports
      'import_declaration': 'importDeclaration',
      
      // Control flow
      'if_statement': 'controlFlow',
      'for_statement': 'controlFlow',
      'enhanced_for_statement': 'controlFlow',
      'while_statement': 'controlFlow',
      'do_statement': 'controlFlow',
      'switch_statement': 'controlFlow',
      'switch_expression': 'controlFlow',
      'try_statement': 'controlFlow',
      'catch_clause': 'controlFlow',
      'finally_clause': 'controlFlow',
      'return_statement': 'controlFlow',
      'yield_statement': 'controlFlow',
      'break_statement': 'controlFlow',
      'continue_statement': 'controlFlow',
      'throw_statement': 'controlFlow',
      'assert_statement': 'controlFlow',
      'synchronized_statement': 'controlFlow',
      'labeled_statement': 'controlFlow',
      
      // Expressions
      'assignment_expression': 'expression',
      'binary_expression': 'expression',
      'unary_expression': 'expression',
      'instanceof_expression': 'expression',
      'method_invocation': 'callExpression',
      'object_creation_expression': 'expression',
      'update_expression': 'expression',
      
      // Types
      'type_identifier': 'typeAnnotation',
      'generic_type': 'genericTypes',
      'array_type': 'typeAnnotation',
      'integral_type': 'typeAnnotation',
      'floating_point_type': 'typeAnnotation',
      'boolean_type': 'typeAnnotation',
      'void_type': 'typeAnnotation',
      
      // Annotations
      'annotation': 'decorator',
      'marker_annotation': 'decorator',
      
      // Modifiers
      'modifiers': 'modifier',
      
      // Type system
      'superclass': 'typeSystem',
      'super_interfaces': 'typeSystem',
      'type_arguments': 'typeSystem',
      'type_parameters': 'typeSystem',
      'dimensions': 'typeSystem',
      'formal_parameters': 'typeSystem',
      'class_literal': 'typeSystem',
      'this': 'typeSystem',
      'super': 'typeSystem',
      
      // Pattern matching
      'record_pattern': 'pattern',
      'type_pattern': 'pattern',
      'underscore_pattern': 'pattern',
      'guard': 'pattern',
      'switch_rule': 'pattern',
      'switch_label': 'pattern',
      'switch_block_statement_group': 'pattern',
      'record_pattern_component': 'pattern',
      'catch_formal_parameter': 'pattern',
      
      // Blocks
      'class_body': 'block',
      'interface_body': 'block',
      'enum_body': 'block',
      'annotation_type_body': 'block',
      'switch_block': 'block',
      'record_pattern_body': 'block',
      'block': 'block',
      'expression_statement': 'block',
      
      // Literals
      'string_literal': 'literal',
      'string_fragment': 'literal',
      'escape_sequence': 'literal',
      'character_literal': 'literal',
      'decimal_integer_literal': 'literal',
      'hex_integer_literal': 'literal',
      'octal_integer_literal': 'literal',
      'binary_integer_literal': 'literal',
      'decimal_floating_point_literal': 'literal',
      'hex_floating_point_literal': 'literal',
      'true': 'literal',
      'false': 'literal',
      'null_literal': 'literal',
      
      // Special statements
      'try_with_resources_statement': 'specialStatement',
      
      // Comments
      'line_comment': 'comment',
      'block_comment': 'comment',
      
      // Member expressions
      'field_access': 'memberExpression',
      'scoped_identifier': 'memberExpression',
      'scoped_type_identifier': 'memberExpression',
      
      // Property identifiers
      'identifier': 'propertyIdentifier',
      'enum_constant': 'propertyIdentifier'
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

  mapQueryTypeToStandardType(queryType: string): 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' | 'data-flow' | 'parameter-flow' | 'return-flow' | 'exception-flow' | 'callback-flow' | 'semantic-relationship' | 'lifecycle-event' | 'concurrency-primitive' {
    const mapping: Record<string, 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' | 'data-flow' | 'parameter-flow' | 'return-flow' | 'exception-flow' | 'callback-flow' | 'semantic-relationship' | 'lifecycle-event' | 'concurrency-primitive'> = {
      'classes-interfaces': 'class',
      'methods-variables': 'method',
      'control-flow-patterns': 'control-flow',
      'data-flow': 'data-flow',
      'semantic-relationships': 'semantic-relationship',
      'lifecycle-relationships': 'lifecycle-event'
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
    if (mainNode.type === 'method_invocation') {
      const args = mainNode.childForFieldName('arguments');
      const method = mainNode.childForFieldName('name');
      
      if (args && method?.text) {
        for (const arg of args.children || []) {
          if (arg.type === 'identifier' && arg.text) {
            relationships.push({
              source: arg.text,
              target: method.text,
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
    if (mainNode.type === 'for_statement' || mainNode.type === 'while_statement' || 
        mainNode.type === 'enhanced_for_statement' || mainNode.type === 'do_statement') {
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
        target: 'catch-block',
        type: 'exception'
      });
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

    // 提取Java中的语义关系
    const text = mainNode.text || '';
    
    // 检查是否是重写方法（包含@Overide注解）
    if (text.includes('@Override')) {
      relationships.push({
        source: 'base-method',
        target: 'overriding-method',
        type: 'overrides'
      });
    }

    // 检查是否是配置或观察者模式（通过注解）
    if (text.includes('@Configuration') || text.includes('@Bean')) {
      relationships.push({
        source: 'configuration',
        target: 'configurable',
        type: 'configures'
      });
    }

    if (text.includes('@EventListener') || text.includes('@Subscribe')) {
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
    if (mainNode.type === 'object_creation_expression') {
      const type = mainNode.childForFieldName('type');
      if (type?.text) {
        relationships.push({
          source: 'new-instance',
          target: type.text,
          type: 'instantiates'
        });
      }
    }

    // 提取初始化关系
    if (mainNode.type === 'constructor_declaration') {
      relationships.push({
        source: 'constructor',
        target: 'instance',
        type: 'initializes'
      });
    }

    // 提取析构关系（finalizer）
    if (mainNode.type === 'method_declaration' && mainNode.text?.includes('finalize')) {
      relationships.push({
        source: 'instance',
        target: 'finalize',
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

    // 提取Java中的并发关系
    const text = mainNode.text || '';
    
    // 检查同步机制
    if (text.includes('synchronized') || text.includes('ReentrantLock') || text.includes('synchronized_statement')) {
      relationships.push({
        source: 'lock',
        target: 'critical-section',
        type: 'synchronizes'
      });
    }

    // 检查线程间通信
    if (text.includes('.wait()') || text.includes('.notify()') || text.includes('.notifyAll()')) {
      relationships.push({
        source: 'thread',
        target: 'communication-point',
        type: 'communicates'
      });
    }

    return relationships;
  }
}