import { BaseLanguageAdapter, AdapterOptions } from './base/BaseLanguageAdapter';
import { StandardizedQueryResult } from '../types';
import {
  PythonHelperMethods,
  PYTHON_NODE_TYPE_MAPPING,
  PYTHON_QUERY_TYPE_MAPPING,
  PYTHON_SUPPORTED_QUERY_TYPES,
  PYTHON_NAME_CAPTURES,
  PYTHON_BLOCK_NODE_TYPES,
  PYTHON_MODIFIERS,
  PYTHON_COMPLEXITY_KEYWORDS
} from './python-utils';
type StandardType = StandardizedQueryResult['type'];

/**
 * Python语言适配器
 * 处理Python特定的查询结果标准化
 */
export class PythonLanguageAdapter extends BaseLanguageAdapter {
  
  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  /**
   * 获取语言标识符
   */
  protected getLanguage(): string {
    return 'python';
  }

  /**
   * 获取语言扩展名
   */
  protected getLanguageExtension(): string {
    return 'py';
  }

  getSupportedQueryTypes(): string[] {
    return PYTHON_SUPPORTED_QUERY_TYPES;
  }

  mapNodeType(nodeType: string): string {
    return PYTHON_NODE_TYPE_MAPPING[nodeType] || 'expression';
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    for (const captureName of PYTHON_NAME_CAPTURES) {
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

    const nodeDecorators = PythonHelperMethods.extractDecorators(mainNode);
    const allDecorators = [...new Set([...capturedDecorators, ...nodeDecorators])]; // 合并并去重

    if (allDecorators.length > 0) {
      extra.decorators = allDecorators;
    }

    // 提取参数信息（对于函数）
    const parameters = mainNode.childForFieldName('parameters');
    if (parameters) {
      extra.parameterCount = parameters.childCount;
      extra.hasTypeHints = PythonHelperMethods.hasTypeHints(mainNode);
    }

    // 提取返回类型信息
    const returnType = PythonHelperMethods.extractReturnType(mainNode);
    if (returnType) {
      extra.hasReturnType = true;
      extra.returnType = returnType;
    }

    // 提取继承信息（对于类）
    const superclasses = PythonHelperMethods.extractSuperclasses(mainNode);
    if (superclasses.length > 0) {
      extra.hasInheritance = true;
      extra.superclasses = superclasses;
    }

    // 检查是否是异步函数
    if (PythonHelperMethods.isAsyncFunction(mainNode)) {
      extra.isAsync = true;
    }

    // 检查是否是生成器函数
    if (PythonHelperMethods.isGeneratorFunction(mainNode)) {
      extra.isGenerator = true;
    }

    return extra;
  }

  mapQueryTypeToStandardType(queryType: string): StandardType {
    return PYTHON_QUERY_TYPE_MAPPING[queryType] as StandardType || 'expression';
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
    for (const keyword of PYTHON_COMPLEXITY_KEYWORDS) {
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
    PythonHelperMethods.findImportDependencies(mainNode, dependencies);
    PythonHelperMethods.findFunctionCalls(mainNode, dependencies);
    PythonHelperMethods.findTypeReferences(mainNode, dependencies);
    PythonHelperMethods.findDataFlowDependencies(mainNode, dependencies);
    PythonHelperMethods.findConcurrencyDependencies(mainNode, dependencies);

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
    if (hasDecoratorCapture || PythonHelperMethods.hasDecorators(mainNode)) {
      modifiers.push('decorated');
    }

    // 检查常见的修饰符
    const text = mainNode.text || '';
    for (const modifier of PYTHON_MODIFIERS) {
      if (text.includes(modifier)) {
        modifiers.push(modifier);
      }
    }

    // 检查类方法修饰符
    if (PythonHelperMethods.isClassMethod(mainNode)) {
      if (PythonHelperMethods.isStaticMethod(mainNode)) {
        modifiers.push('static');
      }
      if (PythonHelperMethods.isClassMethodDecorator(mainNode)) {
        modifiers.push('classmethod');
      }
      if (PythonHelperMethods.isPropertyMethod(mainNode)) {
        modifiers.push('property');
      }
    }

    return modifiers;
  }

  // 重写isBlockNode方法以支持Python特定的块节点类型
  protected isBlockNode(node: any): boolean {
    return PYTHON_BLOCK_NODE_TYPES.includes(node.type) || super.isBlockNode(node);
  }

  // 重写作用域确定方法以支持Python特定的作用域类型
  protected isFunctionScope(node: any): boolean {
    const pythonFunctionTypes = [
      'function_definition', 'async_function_definition', 'lambda'
    ];
    return pythonFunctionTypes.includes(node.type) || super.isFunctionScope(node);
  }

  protected isClassScope(node: any): boolean {
    const pythonClassTypes = [
      'class_definition'
    ];
    return pythonClassTypes.includes(node.type) || super.isClassScope(node);
  }

  // 重写导入路径提取以支持Python特定的导入语法
  protected extractImportPath(node: any): string | undefined {
    // Python特定的导入路径提取
    if (node.type === 'import_from_statement') {
      const moduleNode = node.childForFieldName('module_name');
      return moduleNode ? moduleNode.text : undefined;
    } else if (node.type === 'import_statement') {
      const moduleNode = node.childForFieldName('name');
      return moduleNode ? moduleNode.text : undefined;
    }
    
    return super.extractImportPath(node);
  }

  // 重写参数提取以支持Python特定的参数语法
  protected extractParameters(node: any): string[] {
    const parameters: string[] = [];
    const parameterList = node.childForFieldName?.('parameters');
    if (parameterList) {
      for (const child of parameterList.children) {
        if (child.type === 'identifier' || child.type === 'typed_parameter') {
          const identifier = child.childForFieldName('name') || child;
          if (identifier?.text) {
            parameters.push(identifier.text);
          }
        }
      }
    }
    return parameters;
  }
}