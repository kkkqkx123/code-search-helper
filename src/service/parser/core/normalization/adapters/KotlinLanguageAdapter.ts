import { BaseLanguageAdapter, AdapterOptions } from './base/BaseLanguageAdapter';
import { StandardizedQueryResult } from '../types';
type StandardType = StandardizedQueryResult['type'];

/**
 * Kotlin语言适配器
 * 处理Kotlin特定的查询结果标准化
 */
export class KotlinLanguageAdapter extends BaseLanguageAdapter {
  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  getSupportedQueryTypes(): string[] {
    return [
      'classes-functions',
      'constructors-properties',
      'methods-variables',
      'control-flow-patterns'
    ];
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {
      // Kotlin specific
      'class_declaration': 'class',
      'object_declaration': 'class',
      'companion_object': 'class',
      'function_declaration': 'function',
      'property_declaration': 'variable',
      'type_alias': 'type',
      'primary_constructor': 'method',
      'class_parameter': 'variable',
      'variable_declaration': 'variable',

      // Modifiers
      'class_modifier': 'type',
      'function_modifier': 'type',
      'property_modifier': 'type',
      'inheritance_modifier': 'type',
      'parameter_modifier': 'type',
      'type_modifier': 'type',
      'visibility_modifier': 'type',

      // Types
      'type_identifier': 'type',
      'user_type': 'type',
      'simple_identifier': 'type',
      'type_parameters': 'type',
      'type_argument': 'type',

      // Expressions
      'call_expression': 'expression',
      'binary_expression': 'expression',
      'unary_expression': 'expression',
      'property_access_expression': 'expression',
      'safe_access_expression': 'expression',

      // Control flow
      'if_statement': 'control-flow',
      'when_statement': 'control-flow',
      'when_expression': 'control-flow',
      'for_statement': 'control-flow',
      'while_statement': 'control-flow',
      'do_while_statement': 'control-flow',
      'try_statement': 'control-flow',
      'catch_clause': 'control-flow',
      'finally_clause': 'control-flow'
    };

    return typeMapping[nodeType] || nodeType;
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      'name.definition.class',
      'name.definition.data_class',
      'name.definition.abstract_class',
      'name.definition.sealed_class',
      'name.definition.enum_class',
      'name.definition.interface',
      'name.definition.annotation_class',
      'name.definition.function',
      'name.definition.suspend_function',
      'name.definition.extension_function',
      'name.definition.object',
      'name.definition.property',
      'name.definition.val_property',
      'name.definition.var_property',
      'name.definition.lateinit_property',
      'name.definition.const_property',
      'name.definition.override_property',
      'name.definition.type_alias',
      'name.definition.parameter',
      'name.definition.lambda_parameter',
      'name.definition.variable',
      'name.definition.multi_variable',
      'name.definition.import_header',
      'name.definition.package_header'
    ];

    for (const captureName of nameCaptures) {
      const capture = result.captures?.find((c: any) => c.name === captureName);
      if (capture?.node?.text) {
        return capture.node.text;
      }
    }

    // 特殊处理没有名称捕获的查询类型
    const mainNode = result.captures?.[0]?.node;
    if (mainNode) {
      // 处理companion_object - 尝试从父类获取名称
      if (mainNode.type === 'companion_object') {
        const parentClass = mainNode.parent;
        if (parentClass?.childForFieldName?.('name')?.text) {
          return `${parentClass.childForFieldName('name').text}.Companion`;
        }
        return 'Companion';
      }

      // 处理primary_constructor - 尝试从父类获取名称
      if (mainNode.type === 'primary_constructor') {
        const parentClass = mainNode.parent;
        if (parentClass?.childForFieldName?.('name')?.text) {
          return `${parentClass.childForFieldName('name').text}.constructor`;
        }
        return 'constructor';
      }

      // 如果没有找到名称捕获，尝试从主节点提取
      if (mainNode.childForFieldName?.('name')?.text) {
        return mainNode.childForFieldName('name').text;
      }

      // 尝试获取标识符
      const identifier = mainNode.childForFieldName?.('identifier') ||
        mainNode.childForFieldName?.('type_identifier') ||
        mainNode.childForFieldName?.('simple_identifier');
      if (identifier?.text) {
        return identifier.text;
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

      // 提取参数信息（对于函数）
      const parameters = mainNode.childForFieldName('parameters');
      if (parameters) {
        extra.parameterCount = parameters.childCount;
      }

      // 提取返回类型
      const returnType = mainNode.childForFieldName('type');
      if (returnType) {
        extra.returnType = returnType.text;
      }

      // 提取类型约束
      const typeConstraints = mainNode.childForFieldName('type_constraints');
      if (typeConstraints) {
        extra.hasTypeConstraints = true;
        extra.typeConstraints = typeConstraints.text;
      }

      // 提取主构造函数
      const primaryConstructor = mainNode.childForFieldName('primary_constructor');
      if (primaryConstructor) {
        extra.hasPrimaryConstructor = true;
        extra.primaryConstructor = primaryConstructor.text;
      }

      // 提取函数体
      const functionBody = mainNode.childForFieldName('function_body');
      if (functionBody) {
        extra.hasFunctionBody = true;
        extra.functionBody = functionBody.text;
      }

      // 提取类体
      const classBody = mainNode.childForFieldName('class_body');
      if (classBody) {
        extra.hasClassBody = true;
        extra.classBody = classBody.text;
      }

      // 提取枚举类体
      const enumClassBody = mainNode.childForFieldName('enum_class_body');
      if (enumClassBody) {
        extra.hasEnumClassBody = true;
        extra.enumClassBody = enumClassBody.text;
      }
    }

    // 检查是否是挂起函数
    if (mainNode.type === 'suspend_function' ||
      (mainNode.text && mainNode.text.includes('suspend'))) {
      extra.isSuspend = true;
    }

    // 检查是否是扩展函数
    if (mainNode.type === 'extension_function' ||
      (mainNode.text && mainNode.text.includes('extension'))) {
      extra.isExtension = true;
    }

    return extra;
  }

  mapQueryTypeToStandardType(queryType: string): StandardType {
    const mapping: Record<string, StandardType> = {
      'classes-functions': 'class',
      'constructors-properties': 'method',
      'methods-variables': 'function',
      'control-flow-patterns': 'control-flow'
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
    if (nodeType.includes('class') || nodeType.includes('interface')) complexity += 2;
    if (nodeType.includes('function')) complexity += 1;
    if (nodeType.includes('extension')) complexity += 1;
    if (nodeType.includes('generic')) complexity += 1;

    // Kotlin特定复杂度因素
    const text = this.extractContent(result);
    if (text.includes('suspend')) complexity += 1; // 挂起函数
    if (text.includes('inline')) complexity += 1; // 内联函数
    if (text.includes('reified')) complexity += 1; // 具体化类型参数
    if (text.includes('crossinline')) complexity += 1; // 交叉内联
    if (text.includes('noinline')) complexity += 1; // 非内联
    if (text.includes('tailrec')) complexity += 1; // 尾递归
    if (text.includes('operator')) complexity += 1; // 操作符重载
    if (text.includes('infix')) complexity += 1; // 中缀函数
    if (text.includes('external')) complexity += 1; // 外部函数
    if (text.includes('expect')) complexity += 1; // 期望声明
    if (text.includes('actual')) complexity += 1; // 实际声明
    if (text.includes('data')) complexity += 1; // 数据类
    if (text.includes('sealed')) complexity += 1; // 密封类
    if (text.includes('abstract')) complexity += 1; // 抽象类
    if (text.includes('open')) complexity += 0.5; // 开放类/函数
    if (text.includes('override')) complexity += 0.5; // 重写
    if (text.includes('lateinit')) complexity += 0.5; // 延迟初始化
    if (text.includes('const')) complexity += 0.5; // 常量
    if (text.includes('companion')) complexity += 0.5; // 伴生对象
    if (text.includes('inner')) complexity += 0.5; // 内部类
    if (text.includes('enum')) complexity += 1; // 枚举类
    if (text.includes('annotation')) complexity += 1; // 注解类
    if (text.includes('when')) complexity += 1; // when表达式
    if (text.includes('let')) complexity += 0.5; // let表达式
    if (text.includes('also')) complexity += 0.5; // also表达式
    if (text.includes('apply')) complexity += 0.5; // apply表达式
    if (text.includes('run')) complexity += 0.5; // run表达式
    if (text.includes('with')) complexity += 0.5; // with表达式
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
        if (capture.name && capture.name.includes('import') && capture.node?.text) {
          // 提取导入的标识符
          const importText = capture.node.text;
          // 例如从 "kotlin.collections.List" 提取标识符
          const identifierMatch = importText.match(/([A-Za-z_][A-Za-z0-9_.]*)/g);
          if (identifierMatch) {
            dependencies.push(...identifierMatch);
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

    // 检查常见的修饰符
    if (text.includes('public')) modifiers.push('public');
    if (text.includes('private')) modifiers.push('private');
    if (text.includes('protected')) modifiers.push('protected');
    if (text.includes('internal')) modifiers.push('internal');

    // Kotlin特定修饰符
    if (text.includes('suspend')) modifiers.push('suspend');
    if (text.includes('inline')) modifiers.push('inline');
    if (text.includes('reified')) modifiers.push('reified');
    if (text.includes('crossinline')) modifiers.push('crossinline');
    if (text.includes('noinline')) modifiers.push('noinline');
    if (text.includes('tailrec')) modifiers.push('tailrec');
    if (text.includes('operator')) modifiers.push('operator');
    if (text.includes('infix')) modifiers.push('infix');
    if (text.includes('external')) modifiers.push('external');
    if (text.includes('expect')) modifiers.push('expect');
    if (text.includes('actual')) modifiers.push('actual');

    // 类修饰符
    if (text.includes('data')) modifiers.push('data');
    if (text.includes('sealed')) modifiers.push('sealed');
    if (text.includes('abstract')) modifiers.push('abstract');
    if (text.includes('open')) modifiers.push('open');
    if (text.includes('final')) modifiers.push('final');
    if (text.includes('enum')) modifiers.push('enum');
    if (text.includes('annotation')) modifiers.push('annotation');
    if (text.includes('inner')) modifiers.push('inner');
    if (text.includes('value')) modifiers.push('value'); // Value class

    // 成员修饰符
    if (text.includes('override')) modifiers.push('override');
    if (text.includes('lateinit')) modifiers.push('lateinit');
    if (text.includes('const')) modifiers.push('const');

    // 参数修饰符
    if (text.includes('vararg')) modifiers.push('vararg');
    if (text.includes('noinline')) modifiers.push('noinline');
    if (text.includes('crossinline')) modifiers.push('crossinline');

    // 其他修饰符
    if (text.includes('companion')) modifiers.push('companion');

    // 注解
    if (text.includes('@Override')) modifiers.push('override');
    if (text.includes('@Deprecated')) modifiers.push('deprecated');
    if (text.includes('@Suppress')) modifiers.push('suppress');

    return modifiers;
  }

  // Kotlin特定的辅助方法

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

  // 重写isBlockNode方法以支持Kotlin特定的块节点类型
  protected isBlockNode(node: any): boolean {
    const kotlinBlockTypes = [
      'function_body', 'class_body', 'enum_class_body', 'when_statement', 'when_expression',
      'if_statement', 'for_statement', 'while_statement', 'do_while_statement', 'try_statement',
      'catch_clause', 'finally_clause', 'lambda_literal'
    ];
    return kotlinBlockTypes.includes(node.type) || super.isBlockNode(node);
  }
}