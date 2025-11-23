import { BaseLanguageAdapter, AdapterOptions } from './base/BaseLanguageAdapter';
import { StandardizedQueryResult } from '../types';
import {
  JavaHelperMethods,
  JAVA_NODE_TYPE_MAPPING,
  JAVA_QUERY_TYPE_MAPPING,
  JAVA_SUPPORTED_QUERY_TYPES,
  JAVA_NAME_CAPTURES,
  JAVA_BLOCK_NODE_TYPES,
  JAVA_MODIFIERS,
  JAVA_COMPLEXITY_KEYWORDS
} from './java-utils';
type StandardType = StandardizedQueryResult['type'];

/**
 * Java语言适配器
 * 处理Java特定的查询结果标准化
 */
export class JavaLanguageAdapter extends BaseLanguageAdapter {
  
  constructor(options: AdapterOptions = {}) {
    super(options);
  }

  /**
   * 获取语言标识符
   */
  protected getLanguage(): string {
    return 'java';
  }

  /**
   * 获取语言扩展名
   */
  protected getLanguageExtension(): string {
    return 'java';
  }

  getSupportedQueryTypes(): string[] {
    return JAVA_SUPPORTED_QUERY_TYPES;
  }

  mapNodeType(nodeType: string): string {
    return JAVA_NODE_TYPE_MAPPING[nodeType] || nodeType;
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    for (const captureName of JAVA_NAME_CAPTURES) {
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
    const annotations = JavaHelperMethods.extractAnnotations(mainNode);
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

  mapQueryTypeToStandardType(queryType: string): StandardType {
    return JAVA_QUERY_TYPE_MAPPING[queryType] as StandardType || 'expression';
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
    for (const keyword of JAVA_COMPLEXITY_KEYWORDS) {
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

    // 使用辅助方法查找依赖
    JavaHelperMethods.findTypeReferences(mainNode, dependencies);
    JavaHelperMethods.findMethodCalls(mainNode, dependencies);
    JavaHelperMethods.findGenericDependencies(mainNode, dependencies);
    JavaHelperMethods.findDataFlowDependencies(mainNode, dependencies);
    JavaHelperMethods.findConcurrencyDependencies(mainNode, dependencies);
    JavaHelperMethods.findDependencies(mainNode, dependencies);

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];

    // 使用extractContent方法获取内容，这样可以正确处理mock的情况
    const text = this.extractContent(result);

    for (const modifier of JAVA_MODIFIERS) {
      if (text.includes(modifier)) {
        modifiers.push(modifier);
      }
    }

    return modifiers;
  }

  // 重写isBlockNode方法以支持Java特定的块节点类型
  protected isBlockNode(node: any): boolean {
    return JAVA_BLOCK_NODE_TYPES.includes(node.type) || super.isBlockNode(node);
  }

  // 重写作用域确定方法以支持Java特定的作用域类型
  protected isFunctionScope(node: any): boolean {
    const javaFunctionTypes = [
      'method_declaration', 'constructor_declaration'
    ];
    return javaFunctionTypes.includes(node.type) || super.isFunctionScope(node);
  }

  protected isClassScope(node: any): boolean {
    const javaClassTypes = [
      'class_declaration', 'interface_declaration', 'enum_declaration', 'record_declaration'
    ];
    return javaClassTypes.includes(node.type) || super.isClassScope(node);
  }

  // 重写导入路径提取以支持Java特定的导入语法
  protected extractImportPath(node: any): string | undefined {
    // Java特定的导入路径提取
    if (node.type === 'import_declaration') {
      const pathNode = node.childForFieldName('name');
      return pathNode ? pathNode.text : undefined;
    }
    
    return super.extractImportPath(node);
  }

  // 重写参数提取以支持Java特定的参数语法
  protected extractParameters(node: any): string[] {
    const parameters: string[] = [];
    const parameterList = node.childForFieldName?.('parameters');
    if (parameterList) {
      for (const child of parameterList.children) {
        if (child.type === 'formal_parameter') {
          const declarator = child.childForFieldName('declarator');
          if (declarator?.text) {
            parameters.push(declarator.text);
          }
        }
      }
    }
    return parameters;
  }
}