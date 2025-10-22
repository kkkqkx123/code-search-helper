import { ILanguageAdapter, StandardizedQueryResult } from '../types';
import { LoggerService } from '../../../../../utils/LoggerService';

/**
 * TypeScript语言适配器
 * 处理TypeScript特定的查询结果标准化
 */
export class TypeScriptLanguageAdapter implements ILanguageAdapter {
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
        this.logger.warn(`Failed to normalize TypeScript result for ${queryType}:`, error);
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
      'exports',
      'interfaces',
      'types',
      'properties',
      'variables'
    ];
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {
      'function_declaration': 'function',
      'arrow_function': 'function',
      'method_definition': 'method',
      'class_declaration': 'class',
      'abstract_class_declaration': 'class',
      'interface_declaration': 'interface',
      'type_alias_declaration': 'type',
      'import_statement': 'import',
      'export_statement': 'export',
      'variable_declaration': 'variable',
      'property_definition': 'property'
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
    if (nodeType.includes('interface')) complexity += 1;
    if (nodeType.includes('generic')) complexity += 1;

    // 基于代码行数增加复杂度
    const lineCount = this.extractEndLine(result) - this.extractStartLine(result) + 1;
    complexity += Math.floor(lineCount / 10);

    // 基于嵌套深度增加复杂度
    const nestingDepth = this.calculateNestingDepth(mainNode);
    complexity += nestingDepth;

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
    
    // 查找导入引用
    this.findImportReferences(mainNode, dependencies);

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
    
    if (text.includes('async')) modifiers.push('async');
    if (text.includes('export')) modifiers.push('export');
    if (text.includes('default')) modifiers.push('default');
    if (text.includes('static')) modifiers.push('static');
    if (text.includes('public')) modifiers.push('public');
    if (text.includes('private')) modifiers.push('private');
    if (text.includes('protected')) modifiers.push('protected');
    if (text.includes('readonly')) modifiers.push('readonly');
    if (text.includes('abstract')) modifiers.push('abstract');

    return modifiers;
  }

  extractExtraInfo(result: any): Record<string, any> {
    const extra: Record<string, any> = {};
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return extra;
    }

    // 提取泛型信息
    const typeParameters = mainNode.childForFieldName('type_parameters');
    if (typeParameters) {
      extra.hasGenerics = true;
      extra.typeParameters = typeParameters.text;
    }

    // 提取继承信息
    const heritageClause = mainNode.childForFieldName('heritage_clause');
    if (heritageClause) {
      extra.hasInheritance = true;
      extra.extends = heritageClause.text;
    }

    // 提取参数信息（对于函数）
    const parameters = mainNode.childForFieldName('parameters');
    if (parameters) {
      extra.parameterCount = parameters.childCount;
    }

    return extra;
  }

  private mapQueryTypeToStandardType(queryType: string): 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' {
    const mapping: Record<string, 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression'> = {
      'functions': 'function',
      'classes': 'class',
      'methods': 'method',
      'imports': 'import',
      'exports': 'export',
      'interfaces': 'interface',
      'types': 'type',
      'properties': 'variable',  // 将properties映射到variable，因为StandardizedQueryResult不支持property类型
      'variables': 'variable'
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
    const blockTypes = ['block', 'statement_block', 'class_body', 'interface_body'];
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
          dependencies.push(text);
        }
      }
      
      this.findTypeReferences(child, dependencies);
    }
  }

  private findImportReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找导入引用
      if (child.type === 'identifier') {
        dependencies.push(child.text);
      }
      
      this.findImportReferences(child, dependencies);
    }
  }
}