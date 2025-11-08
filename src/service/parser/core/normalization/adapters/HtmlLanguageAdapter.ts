import { StandardizedQueryResult, IEnhancedHtmlLanguageAdapter } from '../types';
import { ScriptBlock, StyleBlock } from '../../../processing/utils/html/LayeredHTMLConfig';
import { LoggerService } from '../../../../../utils/LoggerService';
import { ContentHashUtils } from '../../../../../utils/ContentHashUtils';
type StandardType = StandardizedQueryResult['type'];

/**
 * HTML语言适配器
 * 处理HTML特定的查询结果标准化
 */
export class HtmlLanguageAdapter implements IEnhancedHtmlLanguageAdapter {
  private logger: LoggerService;

  constructor() {
    this.logger = new LoggerService();
  }

  async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
    const results: (StandardizedQueryResult | null)[] = [];

    for (const result of queryResults) {
      try {
        const extraInfo = this.extractExtraInfo(result);
        const astNode = result.captures?.[0]?.node;
        const nodeId = astNode ? `${astNode.type}:${astNode.startPosition.row}:${astNode.startPosition.column}` : `fallback_${Date.now()}`;

        results.push({
          nodeId,
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
      'attributes-content'
    ];
  }

  mapNodeType(nodeType: string): string {
    const typeMapping: Record<string, string> = {
      'document': 'classDeclaration',
      'element': 'classDeclaration',
      'script_element': 'classDeclaration',
      'style_element': 'classDeclaration',
      'start_tag': 'classDeclaration',
      'end_tag': 'classDeclaration',
      'self_closing_tag': 'classDeclaration',
      'doctype': 'classDeclaration',
      'attribute': 'memberExpression',
      'attribute_name': 'propertyIdentifier',
      'attribute_value': 'variableDeclaration',
      'quoted_attribute_value': 'variableDeclaration',
      'comment': 'variableDeclaration',
      'text': 'variableDeclaration',
      'raw_text': 'variableDeclaration',
      'entity': 'variableDeclaration',
      'tag_name': 'propertyIdentifier',
      'erroneous_end_tag': 'variableDeclaration'
    };

    return typeMapping[nodeType] || 'classDeclaration';
  }

  extractName(result: any): string {
    // 尝试从不同的捕获中提取名称
    const nameCaptures = [
      'name.definition.tag',
      'name.definition.element',
      'name.definition.attribute',
      'name.definition.script',
      'name.definition.style',
      'name.definition.start_tag',
      'name.definition.end_tag',
      'name.definition.self_closing_tag',
      'name.definition.custom_element',
      'name.definition.form_element',
      'name.definition.table_element',
      'name.definition.list_element',
      'name.definition.semantic_element',
      'name.definition.anchor_element',
      'name.definition.image_element',
      'name.definition.meta_element',
      'name.definition.link_element',
      'name.definition.title_element',
      'name.definition.heading_element',
      'name.definition.section_element',
      'name.definition.void_element'
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

    // 尝试从attribute_name提取
    if (result.captures?.[0]?.node?.childForFieldName('attribute_name')?.text) {
      return result.captures[0].node.childForFieldName('attribute_name').text;
    }

    // 对于没有特定名称的类型，返回类型名称
    const queryType = result.type || 'unknown';
    if (['document', 'doctype', 'comment', 'text', 'raw_text', 'entity', 'nested_elements'].includes(queryType)) {
      return queryType;
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

  /**
   * 提取Script块
   * @param content HTML内容
   * @returns Script块数组
   */
  extractScripts(content: string): ScriptBlock[] {
    const scriptBlocks: ScriptBlock[] = [];

    // 使用正则表达式匹配script标签
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let index = 0;

    while ((match = scriptRegex.exec(content)) !== null) {
      const fullMatch = match[0];
      const scriptContent = match[1];
      const startPosition = match.index;
      const endPosition = startPosition + fullMatch.length;

      // 计算行号和列号
      const position = this.calculatePosition(content, startPosition);

      // 检测语言类型
      const language = this.detectScriptLanguage(fullMatch);

      // 提取script标签属性
      const attributes = this.extractScriptAttributes(fullMatch);

      // 生成内容哈希
      const contentHash = ContentHashUtils.generateContentHash(scriptContent.trim());

      const scriptBlock: ScriptBlock = {
        id: `script_${index}`,
        content: scriptContent.trim(),
        language,
        position: {
          start: startPosition,
          end: endPosition,
          line: position.line,
          column: position.column
        },
        attributes,
        contentHash
      };

      scriptBlocks.push(scriptBlock);
      index++;
    }

    return scriptBlocks;
  }

  /**
   * 提取Style块
   * @param content HTML内容
   * @returns Style块数组
   */
  extractStyles(content: string): StyleBlock[] {
    const styleBlocks: StyleBlock[] = [];

    // 使用正则表达式匹配style标签
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let match;
    let index = 0;

    while ((match = styleRegex.exec(content)) !== null) {
      const fullMatch = match[0];
      const styleContent = match[1];
      const startPosition = match.index;
      const endPosition = startPosition + fullMatch.length;

      // 计算行号和列号
      const position = this.calculatePosition(content, startPosition);

      // 检测样式类型
      const styleType = this.detectStyleType(fullMatch);

      // 提取style标签属性
      const attributes = this.extractStyleAttributes(fullMatch);

      // 生成内容哈希
      const contentHash = ContentHashUtils.generateContentHash(styleContent.trim());

      const styleBlock: StyleBlock = {
        id: `style_${index}`,
        content: styleContent.trim(),
        styleType,
        position: {
          start: startPosition,
          end: endPosition,
          line: position.line,
          column: position.column
        },
        attributes,
        contentHash
      };

      styleBlocks.push(styleBlock);
      index++;
    }

    return styleBlocks;
  }

  /**
   * 检测脚本语言类型
   * @param scriptTag Script标签内容
   * @returns 语言类型
   */
  detectScriptLanguage(scriptTag: string): string {
    // 检查type属性
    const typeMatch = scriptTag.match(/type=["']([^"']+)["']/i);
    if (typeMatch) {
      const type = typeMatch[1].toLowerCase();

      if (type.includes('javascript') || type.includes('babel')) {
        return 'javascript';
      }
      if (type.includes('typescript')) {
        return 'typescript';
      }
      if (type.includes('json')) {
        return 'json';
      }
    }

    // 检查lang属性
    const langMatch = scriptTag.match(/lang=["']([^"']+)["']/i);
    if (langMatch) {
      const lang = langMatch[1].toLowerCase();
      if (lang.includes('ts') || lang.includes('typescript')) {
        return 'typescript';
      }
    }

    // 检查src属性中的文件扩展名
    const srcMatch = scriptTag.match(/src=["']([^"']+)["']/i);
    if (srcMatch) {
      const src = srcMatch[1].toLowerCase();
      if (src.endsWith('.ts') || src.includes('typescript')) {
        return 'typescript';
      }
      if (src.endsWith('.mjs') || src.includes('module')) {
        return 'javascript';
      }
    }

    // 默认为JavaScript
    return 'javascript';
  }

  /**
   * 检测样式类型
   * @param styleTag Style标签内容
   * @returns 样式类型
   */
  detectStyleType(styleTag: string): string {
    // 检查type属性
    const typeMatch = styleTag.match(/type=["']([^"']+)["']/i);
    if (typeMatch) {
      const type = typeMatch[1].toLowerCase();

      if (type.includes('scss')) {
        return 'scss';
      }
      if (type.includes('less')) {
        return 'less';
      }
      if (type.includes('css') || type.includes('text/css')) {
        return 'css';
      }
    }

    // 检查lang属性
    const langMatch = styleTag.match(/lang=["']([^"']+)["']/i);
    if (langMatch) {
      const lang = langMatch[1].toLowerCase();
      if (lang.includes('scss')) {
        return 'scss';
      }
      if (lang.includes('less')) {
        return 'less';
      }
    }

    // 默认为CSS
    return 'css';
  }

  /**
   * 计算文本位置
   * @param content 完整内容
   * @param index 偏移量
   * @returns 位置信息
   */
  calculatePosition(content: string, index: number): { line: number; column: number } {
    const beforeOffset = content.substring(0, index);
    const lines = beforeOffset.split('\n');
    const line = lines.length;
    const column = lines[lines.length - 1].length + 1;

    return { line, column };
  }

  private mapQueryTypeToStandardType(queryType: string): StandardType {
    const mapping: Record<string, StandardType> = {
      'elements': 'variable',
      'attributes-content': 'variable'
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
    const blockTypes = [
      'element',
      'script_element',
      'style_element',
      'document',
      'nested_elements'
    ];
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

  /**
   * 提取script标签属性
   */
  private extractScriptAttributes(scriptTag: string): Record<string, string> {
    const attributes: Record<string, string> = {};

    // 匹配标签内的所有属性
    const attrRegex = /(\w+(?:-\w+)*)\s*=\s*["']([^"']*)["']/g;
    let match;

    while ((match = attrRegex.exec(scriptTag)) !== null) {
      const attrName = match[1];
      const attrValue = match[2];
      attributes[attrName] = attrValue;
    }

    // 处理布尔属性（如 async, defer）
    const booleanAttrRegex = /\b(async|defer|crossorigin|nomodule)\b(?!\s*=)/g;
    while ((match = booleanAttrRegex.exec(scriptTag)) !== null) {
      attributes[match[1]] = 'true';
    }

    return attributes;
  }

  /**
   * 提取style标签属性
   */
  private extractStyleAttributes(styleTag: string): Record<string, string> {
    const attributes: Record<string, string> = {};

    // 匹配标签内的所有属性
    const attrRegex = /(\w+(?:-\w+)*)\s*=\s*["']([^"']*)["']/g;
    let match;

    while ((match = attrRegex.exec(styleTag)) !== null) {
      const attrName = match[1];
      const attrValue = match[2];
      attributes[attrName] = attrValue;
    }

    // 处理布尔属性（如 scoped）
    const booleanAttrRegex = /\b(scoped)\b(?!\s*=)/g;
    while ((match = booleanAttrRegex.exec(styleTag)) !== null) {
      attributes[match[1]] = 'true';
    }

    return attributes;
  }
}