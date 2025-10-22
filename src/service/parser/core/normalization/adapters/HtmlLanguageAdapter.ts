import { ILanguageAdapter, StandardizedQueryResult } from '../types';
import { LoggerService } from '../../../../../utils/LoggerService';

/**
 * HTML语言适配器
 * 处理HTML特定的查询结果标准化
 */
export class HtmlLanguageAdapter implements ILanguageAdapter {
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
        this.logger.warn(`Failed to normalize HTML result for ${queryType}:`, error);
      }
    }
    
    return results.filter((result): result is StandardizedQueryResult => result !== null);
  }

  getSupportedQueryTypes(): string[] {
    return [
      'elements',
      'tags',
      'attributes',
      'comments',
      'text',
      'ids',
      'classes'
    ];
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {
      'element': 'element',
      'start_tag': 'tag',
      'end_tag': 'tag',
      'attribute': 'attribute',
      'comment': 'comment',
      'text': 'text',
      'doctype': 'doctype',
      'erroneous_end_tag': 'error'
    };
    
    return typeMapping[nodeType] || nodeType;
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      'name.definition.tag',
      'name.definition.element',
      'name.definition.attribute',
      'name.definition.id',
      'name.definition.class'
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

    // 尝试从tag_name提取
    if (result.captures?.[0]?.node?.childForFieldName('tag_name')?.text) {
      return result.captures[0].node.childForFieldName('tag_name').text;
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
    if (nodeType.includes('element')) complexity += 1;
    if (nodeType.includes('tag')) complexity += 0.5;
    if (nodeType.includes('attribute')) complexity += 0.2;

    // 基于代码行数增加复杂度
    const lineCount = this.extractEndLine(result) - this.extractStartLine(result) + 1;
    complexity += Math.floor(lineCount / 5); // HTML通常比较简短

    // 基于嵌套深度增加复杂度
    const nestingDepth = this.calculateNestingDepth(mainNode);
    complexity += nestingDepth * 0.5;

    return complexity;
  }

  extractDependencies(result: any): string[] {
    const dependencies: string[] = [];
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return dependencies;
    }

    // 查找自定义元素（可能的组件依赖）
    if (mainNode.type === 'element' || mainNode.type === 'start_tag') {
      const tagNameNode = mainNode.childForFieldName('tag_name') || 
                          mainNode.childForFieldName('name');
      if (tagNameNode && tagNameNode.text) {
        const tagName = tagNameNode.text;
        // 检查是否是自定义元素（包含连字符或大写字母开头）
        if (tagName.includes('-') || (tagName[0] === tagName[0].toUpperCase() && tagName !== tagName.toUpperCase())) {
          dependencies.push(tagName);
        }
      }
    }

    // 查找src和href属性值（资源依赖）
    this.findResourceReferences(mainNode, dependencies);
    
    return [...new Set(dependencies)]; // 去重
  }

  extractModifiers(result: any): string[] {
    const modifiers: string[] = [];
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return modifiers;
    }

    // 检查常见的HTML属性
    const text = mainNode.text || '';
    
    if (text.includes('id=')) modifiers.push('has-id');
    if (text.includes('class=')) modifiers.push('has-class');
    if (text.includes('data-')) modifiers.push('has-data-attribute');
    if (text.includes('aria-')) modifiers.push('has-aria-attribute');
    if (text.includes('slot=')) modifiers.push('has-slot');

    return modifiers;
  }

  extractExtraInfo(result: any): Record<string, any> {
    const extra: Record<string, any> = {};
    const mainNode = result.captures?.[0]?.node;
    
    if (!mainNode) {
      return extra;
    }

    // 提取标签信息
    if (mainNode.type === 'element' || mainNode.type === 'start_tag') {
      const tagNameNode = mainNode.childForFieldName('tag_name');
      if (tagNameNode) {
        extra.tagName = tagNameNode.text;
      }
    }

    // 提取属性信息
    const attributes = this.extractAttributes(mainNode);
    if (attributes.length > 0) {
      extra.attributes = attributes;
      extra.attributeCount = attributes.length;
    }

    return extra;
  }

  private mapQueryTypeToStandardType(queryType: string): 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression' {
    const mapping: Record<string, 'function' | 'class' | 'method' | 'import' | 'variable' | 'interface' | 'type' | 'export' | 'control-flow' | 'expression'> = {
      'elements': 'variable',
      'tags': 'variable',
      'attributes': 'variable',
      'comments': 'expression',
      'text': 'expression',
      'ids': 'variable',
      'classes': 'variable'
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
    const blockTypes = ['element', 'script_element', 'style_element'];
    return blockTypes.includes(node.type);
  }

  private findResourceReferences(node: any, dependencies: string[]): void {
    if (!node || !node.children) {
      return;
    }

    for (const child of node.children) {
      // 查找src和href属性
      if (child.type === 'attribute' && child.children && child.children.length >= 2) {
        const attrName = child.children[0]?.text;
        const attrValue = child.children[1]?.text;
        
        if (attrName && attrValue && (attrName === 'src' || attrName === 'href' || attrName === 'data-src')) {
          // 提取路径或URL
          const pathMatch = attrValue.match(/["']([^"']+)["']/);
          if (pathMatch) {
            dependencies.push(pathMatch[1]);
          }
        }
      }
      
      this.findResourceReferences(child, dependencies);
    }
  }

  private extractAttributes(node: any): string[] {
    const attributes: string[] = [];
    
    if (!node || !node.children) {
      return attributes;
    }

    for (const child of node.children) {
      if (child.type === 'attribute' && child.children && child.children.length >= 1) {
        const attrName = child.children[0]?.text;
        if (attrName) {
          attributes.push(attrName);
        }
      } else if (child.children) {
        attributes.push(...this.extractAttributes(child));
      }
    }

    return attributes;
  }
}