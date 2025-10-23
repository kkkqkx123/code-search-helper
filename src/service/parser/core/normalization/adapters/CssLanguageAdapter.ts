import { ILanguageAdapter, StandardizedQueryResult } from '../types';
import { LoggerService } from '../../../../../utils/LoggerService';

/**
 * CSS语言适配器
 * 处理CSS特定的查询结果标准化
 */
export class CssLanguageAdapter implements ILanguageAdapter {
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
        this.logger.warn(`Failed to normalize CSS result for ${queryType}:`, error);
      }
    }
    
    return results.filter((result): result is StandardizedQueryResult => result !== null);
  }

  getSupportedQueryTypes(): string[] {
    return [
      'selectors',
      'properties',
      'rules'
    ];
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {
      'rule_set': 'class',
      'class_selector': 'class',
      'id_selector': 'class',
      'tag_name': 'class',
      'pseudo_class_selector': 'class',
      'pseudo_element_selector': 'class',
      'attribute_selector': 'class',
      'universal_selector': 'class',
      'child_selector': 'class',
      'sibling_selector': 'class',
      'adjacent_sibling_selector': 'class',
      'descendant_selector': 'class',
      'namespace_selector': 'class',
      'nesting_selector': 'class',
      'declaration': 'variable',
      'property_name': 'variable',
      'integer_value': 'expression',
      'float_value': 'expression',
      'color_value': 'expression',
      'string_value': 'expression',
      'plain_value': 'expression',
      'call_expression': 'function',
      'function_name': 'function',
      'binary_expression': 'expression',
      'integer_value_with_unit': 'expression',
      'float_value_with_unit': 'expression',
      'media_statement': 'control-flow',
      'keyframes_statement': 'control-flow',
      'import_statement': 'import',
      'at_rule': 'control-flow',
      'supports_statement': 'control-flow',
      'namespace_statement': 'control-flow',
      'comment': 'expression'
    };
    
    return typeMapping[nodeType] || nodeType;
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      'name.definition.ruleset',
      'name.definition.class',
      'name.definition.id',
      'name.definition.tag',
      'name.definition.pseudo_class',
      'name.definition.pseudo_element',
      'name.definition.attribute',
      'name.definition.keyframe',
      'name.definition.function',
      'name.definition.unit',
      'name.definition.at_rule',
      'name.definition.property',
      'definition.class_selector',
      'definition.id_selector',
      'definition.pseudo_class',
      'definition.pseudo_element',
      'definition.attribute_selector',
      'definition.universal_selector',
      'definition.child_selector',
      'definition.sibling_selector',
      'definition.adjacent_sibling_selector',
      'definition.descendant_selector',
      'definition.namespace_selector',
      'definition.nesting_selector',
      'definition.declaration',
      'definition.integer_value',
      'definition.float_value',
      'definition.color_value',
      'definition.string_value',
      'definition.plain_value',
      'definition.css_variable',
      'definition.important',
      'definition.function_call',
      'definition.binary_expression',
      'definition.unit_value',
      'definition.media',
      'definition.keyframe',
      'definition.import',
      'definition.font_face',
      'definition.supports',
      'definition.namespace',
      'definition.at_rule',
      'definition.comment',
      'definition.ruleset'
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

    // 尝试从第一个标识符节点提取
    const firstIdentifier = this.findFirstIdentifier(result.captures?.[0]?.node);
    if (firstIdentifier) {
      return firstIdentifier;
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
    if (nodeType.includes('rule_set')) complexity += 2;
    if (nodeType.includes('keyframes')) complexity += 2;
    if (nodeType.includes('media')) complexity += 1;
    if (nodeType.includes('at_rule')) complexity += 1;
    if (nodeType.includes('selector')) complexity += 1;
    if (nodeType.includes('declaration')) complexity += 1;

    // 基于代码行数增加复杂度
    const lineCount = this.extractEndLine(result) - this.extractStartLine(result) + 1;
    complexity += Math.floor(lineCount / 5); // CSS规则通常比编程语言更短

    return complexity;
  }

  extractDependencies(result: any): string[] {
    const dependencies: string[] = [];
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return dependencies;
    }

    // 查找CSS变量引用
    const text = mainNode.text || '';
    const cssVarRegex = /var\(--([a-zA-Z0-9-_]+)\)/g;
    let match;
    while ((match = cssVarRegex.exec(text)) !== null) {
      dependencies.push(`--${match[1]}`);
    }

    // 查找URL引用
    const urlRegex = /url\(['"]?([^'")]+)['"]?\)/g;
    while ((match = urlRegex.exec(text)) !== null) {
      dependencies.push(match[1]);
    }

    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return modifiers;
    }

    const text = mainNode.text || '';
    
    // CSS特定的修饰符检查
    if (text.includes('!important')) modifiers.push('important');
    if (text.includes('@media')) modifiers.push('media-query');
    if (text.includes('@keyframes')) modifiers.push('keyframes');
    if (text.includes('@import')) modifiers.push('import');
    if (text.includes('@supports')) modifiers.push('supports');

    return modifiers;
  }

  extractExtraInfo(result: any): Record<string, any> {
    const extra: Record<string, any> = {};
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return extra;
    }

    // 提取单位信息
    const unitMatch = mainNode.text?.match(/\d+(px|em|rem|%|vh|vw|vmin|vmax|pt|pc|in|mm|cm|ex|ch|fr|deg|rad|grad|turn|s|ms|Hz|kHz|dpi|dpcm|dppx)/);
    if (unitMatch) {
      extra.unit = unitMatch[1];
    }

    // 提取颜色信息
    const colorMatch = mainNode.text?.match(/(#([a-fA-F0-9]{3}|[a-fA-F0-9]{6})|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)|hsla\([^)]+\))/);
    if (colorMatch) {
      extra.color = colorMatch[1];
    }

    // 提取选择器特异性
    if (mainNode.type === 'rule_set') {
      extra.specificity = this.calculateSpecificity(mainNode);
    }

    return extra;
  }

  private mapQueryTypeToStandardType(queryType: string): 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' {
    const mapping: Record<string, 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression'> = {
      'selectors': 'class',  // 选择器映射为类
      'properties': 'variable',  // 属性映射为变量
      'rules': 'control-flow'  // 规则映射为控制流
    };
    
    return mapping[queryType] || 'expression';
  }

  private calculateSpecificity(node: any): { a: number; b: number; c: number } {
    // CSS特异性计算 (a, b, c) 分别代表 ID, 类/属性/伪类, 元素/伪元素 的数量
    let a = 0, b = 0, c = 0;
    
    // 这里简化实现，实际的特异性计算会更复杂
    // 在真实实现中，我们需要遍历选择器的所有部分
    
    return { a, b, c };
  }

  private findFirstIdentifier(node: any): string | null {
    if (!node) {
      return null;
    }

    if (node.type === 'class_name' && node.text) {
      return '.' + node.text;
    }
    
    if (node.type === 'id_name' && node.text) {
      return '#' + node.text;
    }
    
    if (node.type === 'tag_name' && node.text) {
      return node.text;
    }

    if (node.children) {
      for (const child of node.children) {
        const identifier = this.findFirstIdentifier(child);
        if (identifier) {
          return identifier;
        }
      }
    }

    return null;
  }
}