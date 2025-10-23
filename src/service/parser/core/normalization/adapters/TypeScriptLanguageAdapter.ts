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
      'variables',
      'control-flow',
      'expressions'
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
      'name.definition.property',
      'name.definition.constant',
      'name.definition.let_variable',
      'name.assignment',
      'name.import',
      'name.namespace',
      'name.default',
      'name.export',
      // Support for definition.xxx format (used in both TS and JS queries)
      'definition.function',
      'definition.method',
      'definition.class',
      'definition.interface',
      'definition.type',
      'definition.variable',
      'definition.property',
      'definition.constant',
      'definition.constructor',
      'definition.getter',
      'definition.setter',
      'definition.static',
      'definition.private_property',
      'definition.private_method',
      'definition.async_function',
      'definition.async_method',
      'definition.generator_function',
      'definition.generator_method',
      'definition.arrow_function',
      'definition.function_expression',
      'definition.import',
      'definition.export',
      'definition.if',
      'definition.for',
      'definition.for_in',
      'definition.for_of',
      'definition.while',
      'definition.do_while',
      'definition.switch',
      'definition.switch_case',
      'definition.switch_default',
      'definition.try',
      'definition.catch',
      'definition.finally',
      'definition.throw',
      'definition.return',
      'definition.break',
      'definition.continue',
      'definition.labeled',
      'definition.debugger',
      'definition.yield',
      'definition.await',
      'definition.ternary',
      'definition.call',
      'definition.new_expression',
      'definition.member_expression',
      'definition.optional_chain',
      'definition.type_assertion',
      'definition.as_expression',
      'definition.satisfies_expression',
      'definition.non_null_expression',
      'definition.binary_expression',
      'definition.unary_expression',
      'definition.update_expression',
      'definition.logical_expression',
      'definition.assignment',
      'definition.augmented_assignment',
      'definition.subscript_expression',
      'definition.template_string',
      'definition.regex',
      'definition.type_alias',
      'definition.enum',
      'definition.namespace',
      'definition.type_parameters',
      'definition.type_arguments',
      'definition.jsx_element',
      'definition.hook',
      'definition.component',
      'definition.jsdoc_type',
      'definition.pattern_type',
      'definition.array_pattern_type',
      'definition.function_type',
      'definition.class_type',
      'definition.generic_type',
      'definition.type_predicate',
      // Additional JavaScript-specific captures
      'definition.accessor',
      'definition.private_field',
      'definition.test',
      'definition.lexical_declaration',
      'definition.variable_declaration',
      'definition.computed_method',
      'definition.static_property',
      'definition.object_property',
      'definition.computed_property',
      'definition.object_method',
      'definition.object_getter',
      'definition.object_setter',
      'definition.typed_property',
      'definition.pattern_property',
      'definition.function_type_parameters',
      'definition.with',
      'definition.expression',
      'definition.conditional',
      'definition.sequence',
      'definition.async_function_expression',
      'definition.async_arrow_function',
      'definition.array_pattern',
      'definition.object_pattern',
      'definition.assignment_pattern',
      'definition.spread_element',
      'definition.jsx_self_closing_element',
      'definition.jsx_fragment',
      'definition.jsx_attribute',
      'definition.jsx_expression',
      'definition.comment',
      'definition.jsdoc',
      'definition.public_api',
      'definition.error_handling',
      'definition.promise_method',
      // Additional captures
      'export',
      'default',
      'definition.type_annotation'
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

    // 首先检查捕获中的依赖项
    if (result.captures && Array.isArray(result.captures)) {
      for (const capture of result.captures) {
        if (capture.name && capture.name.includes('import') && capture.node?.text) {
          // 提取导入的标识符
          const importText = capture.node.text;
          // 例如从 "Component" 提取标识符
          const identifierMatch = importText.match(/[A-Za-z_][A-Za-z0-9_]*/g);
          if (identifierMatch) {
            dependencies.push(...identifierMatch);
          }
        }
      }
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
      'variables': 'variable',
      'control-flow': 'control-flow',
      'expressions': 'expression'
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
      if (child.type === 'identifier' && child.text) {
        dependencies.push(child.text);
      } else if (child.type === 'import_specifier') {
        // 处理import { Component } from 'react'这类导入
        const importedName = child.childForFieldName('name');
        if (importedName && importedName.text) {
          dependencies.push(importedName.text);
        }
      }
      
      this.findImportReferences(child, dependencies);
    }
  }
}