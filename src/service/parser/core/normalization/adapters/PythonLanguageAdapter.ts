import { ILanguageAdapter, StandardizedQueryResult } from '../types';
import { LoggerService } from '../../../../../utils/LoggerService';

/**
 * Python语言适配器
 * 处理Python特定的查询结果标准化
 */
export class PythonLanguageAdapter implements ILanguageAdapter {
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
        this.logger.warn(`Failed to normalize Python result for ${queryType}:`, error);
      }
    }
    
    return results.filter((result): result is StandardizedQueryResult => result !== null);
  }

  getSupportedQueryTypes(): string[] {
    return [
      'functions',
      'classes',
      'methods',
      'imports',
      'variables',
      'control-flow',
      'data-structures',
      'types-decorators'
    ];
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {
      'function_definition': 'function',
      'async_function_definition': 'function',
      'decorated_definition': 'function', // 默认为函数，后续会根据内容调整
      'class_definition': 'class',
      'method_definition': 'method',
      'import_statement': 'import',
      'import_from_statement': 'import',
      'assignment': 'variable',
      'annotated_assignment': 'variable',
      'for_statement': 'control-flow',
      'while_statement': 'control-flow',
      'if_statement': 'control-flow',
      'try_statement': 'control-flow',
      'with_statement': 'control-flow'
    };
    
    return typeMapping[nodeType] || nodeType;
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      'name.definition.function',
      'name.definition.async_function',
      'name.definition.class',
      'name.definition.method',
      'name.definition.async_method',
      'name.definition.variable',
      'name.definition.property'
    ];

    for (const captureName of nameCaptures) {
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
    if (nodeType.includes('class')) complexity += 2;
    if (nodeType.includes('function')) complexity += 1;
    if (nodeType.includes('async')) complexity += 1;
    if (nodeType.includes('decorated')) complexity += 1;

    // 基于代码行数增加复杂度
    const lineCount = this.extractEndLine(result) - this.extractStartLine(result) + 1;
    complexity += Math.floor(lineCount / 10);

    // 基于嵌套深度增加复杂度
    const nestingDepth = this.calculateNestingDepth(mainNode);
    complexity += nestingDepth;

    // Python特有的复杂度因素
    const text = mainNode.text || '';
    if (text.includes('yield')) complexity += 1; // 生成器
    if (text.includes('await')) complexity += 1; // 异步等待
    if (text.includes('lambda')) complexity += 1; // Lambda表达式

    return complexity;
  }

  extractDependencies(result: any): string[] {
    const dependencies: string[] = [];
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return dependencies;
    }

    // 查找导入引用
    this.findImportReferences(mainNode, dependencies);
    
    // 查找函数调用
    this.findFunctionCalls(mainNode, dependencies);

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
    if (hasDecoratorCapture || this.hasDecorators(mainNode)) {
      modifiers.push('decorated');
    }

    // 检查异步
    const text = mainNode.text || '';
    if (text.includes('async')) {
      modifiers.push('async');
    }

    // 检查生成器
    if (text.includes('yield')) {
      modifiers.push('generator');
    }

    // 检查类方法修饰符
    if (this.isClassMethod(mainNode)) {
      if (this.isStaticMethod(mainNode)) {
        modifiers.push('static');
      }
      if (this.isClassMethod(mainNode)) {
        modifiers.push('classmethod');
      }
      if (this.isPropertyMethod(mainNode)) {
        modifiers.push('property');
      }
    }

    return modifiers;
  }

  extractExtraInfo(result: any): Record<string, any> {
    const extra: Record<string, any> = {};
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return extra;
    }

    // 提取装饰器信息 - 检查捕获中的装饰器
    const capturedDecorators = result.captures?.filter((capture: any) =>
      capture.name === 'decorator' && capture.node?.text
    ).map((capture: any) => capture.node.text) || [];
    
    const nodeDecorators = this.extractDecorators(mainNode);
    const allDecorators = [...new Set([...capturedDecorators, ...nodeDecorators])]; // 合并并去重
    
    if (allDecorators.length > 0) {
      extra.decorators = allDecorators;
    }

    // 提取参数信息（对于函数）
    const parameters = mainNode.childForFieldName('parameters');
    if (parameters) {
      extra.parameterCount = parameters.childCount;
      extra.hasTypeHints = this.hasTypeHints(parameters);
    }

    // 提取返回类型信息
    const returnType = mainNode.childForFieldName('return_type');
    if (returnType) {
      extra.hasReturnType = true;
      extra.returnType = returnType.text;
    }

    // 提取继承信息（对于类）
    const superclasses = mainNode.childForFieldName('superclasses');
    if (superclasses) {
      extra.hasInheritance = true;
      extra.superclasses = this.extractSuperclassNames(superclasses);
    }

    return extra;
  }

  private mapQueryTypeToStandardType(queryType: string): 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' {
    const mapping: Record<string, 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression'> = {
      'functions': 'function',
      'classes': 'class',
      'methods': 'method',
      'imports': 'import',
      'variables': 'variable',
      'control-flow': 'control-flow',
      'data-structures': 'class', // Python的数据结构通常映射为类
      'types-decorators': 'type'
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
    const blockTypes = ['block', 'suite'];
    return blockTypes.includes(node.type);
  }

  private findImportReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找导入引用
      if (child.type === 'identifier' || child.type === 'dotted_name') {
        dependencies.push(child.text);
      }
      
      this.findImportReferences(child, dependencies);
    }
  }

  private findFunctionCalls(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找函数调用
      if (child.type === 'call') {
        const functionNode = child.childForFieldName('function');
        if (functionNode?.text) {
          dependencies.push(functionNode.text);
        }
      }
      
      this.findFunctionCalls(child, dependencies);
    }
  }

  private hasDecorators(node: any): boolean {
    return node.children?.some((child: any) => child.type === 'decorators') || false;
  }

  private extractDecorators(node: any): string[] {
    const decorators: string[] = [];
    const decoratorsNode = node.children?.find((child: any) => child.type === 'decorators');
    
    if (decoratorsNode) {
      for (const child of decoratorsNode.children) {
        if (child.type === 'decorator' && child.text) {
          decorators.push(child.text.trim());
        }
      }
    }
    
    return decorators;
  }

  private isClassMethod(node: any): boolean {
    // 检查是否是类方法（通过检查父节点是否是类定义）
    let parent = node.parent;
    while (parent) {
      if (parent.type === 'class_definition') {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  private isStaticMethod(node: any): boolean {
    const text = node.text || '';
    return text.includes('@staticmethod') || text.includes('@classmethod');
  }

  private isPropertyMethod(node: any): boolean {
    const text = node.text || '';
    return text.includes('@property');
  }

  private hasTypeHints(parameters: any): boolean {
    if (!parameters || !parameters.children) {
      return false;
    }
    
    return parameters.children.some((child: any) => 
      child.type === 'typed_parameter' || child.type === 'type_annotation'
    );
  }

  private extractSuperclassNames(superclasses: any): string[] {
    const names: string[] = [];
    
    if (superclasses && superclasses.children) {
      for (const child of superclasses.children) {
        if (child.type === 'identifier' || child.type === 'dotted_name') {
          names.push(child.text);
        }
      }
    }
    
    return names;
  }
}