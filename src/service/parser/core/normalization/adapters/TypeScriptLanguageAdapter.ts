import { BaseLanguageAdapter, AdapterOptions } from '../BaseLanguageAdapter';
import { StandardizedQueryResult } from '../types';

/**
 * TypeScript语言适配器
 * 处理TypeScript特定的查询结果标准化
 */
export class TypeScriptLanguageAdapter extends BaseLanguageAdapter {
  constructor(options: AdapterOptions = {}) {
    super(options);
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

  extractLanguageSpecificMetadata(result: any): Record<string, any> {
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

    // 提取装饰器信息
    const decorators = this.extractDecorators(mainNode);
    if (decorators.length > 0) {
      extra.decorators = decorators;
    }

    // 提取JSX相关信息
    if (this.isJSXElement(mainNode)) {
      extra.isJSX = true;
      extra.jsxType = mainNode.type;
    }

    return extra;
  }

  mapQueryTypeToStandardType(queryType: string): 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' {
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
    if (nodeType.includes('interface')) complexity += 1;
    if (nodeType.includes('generic')) complexity += 1;

    // TypeScript特有的复杂度因素
    const text = mainNode.text || '';
    if (text.includes('async')) complexity += 1; // 异步函数
    if (text.includes('await')) complexity += 1; // 异步等待
    if (text.includes('decorator') || text.includes('@')) complexity += 1; // 装饰器
    if (text.includes('extends')) complexity += 1; // 继承
    if (text.includes('implements')) complexity += 1; // 接口实现
    if (text.includes('generic') || text.includes('<')) complexity += 1; // 泛型
    if (text.includes('JSX') || text.includes('jsx')) complexity += 1; // JSX

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

    // 检查装饰器
    if (text.includes('@')) {
      modifiers.push('decorated');
    }

    return modifiers;
  }

  // TypeScript特定的辅助方法

  private extractDecorators(node: any): string[] {
    const decorators: string[] = [];
    
    if (!node || !node.children) {
      return decorators;
    }

    for (const child of node.children) {
      if (child.type === 'decorator' && child.text) {
        decorators.push(child.text.trim());
      }
      decorators.push(...this.extractDecorators(child));
    }

    return decorators;
  }

  private isJSXElement(node: any): boolean {
    if (!node) {
      return false;
    }

    const jsxTypes = [
      'jsx_element',
      'jsx_self_closing_element',
      'jsx_fragment',
      'jsx_opening_element',
      'jsx_closing_element',
      'jsx_attribute'
    ];

    return jsxTypes.includes(node.type);
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

  // 重写isBlockNode方法以支持TypeScript特定的块节点类型
  protected isBlockNode(node: any): boolean {
    const tsBlockTypes = ['block', 'statement_block', 'class_body', 'interface_body', 'object'];
    return tsBlockTypes.includes(node.type) || super.isBlockNode(node);
  }
}