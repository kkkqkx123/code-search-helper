import { StandardizedQueryResult, IEnhancedHtmlLanguageAdapter } from '../types';
import { ScriptBlock, StyleBlock } from '../../../processing/utils/html/LayeredHTMLConfig';
import { LoggerService } from '../../../../../utils/LoggerService';
import { ContentHashUtils } from '../../../../../utils/cache/ContentHashUtils';
import { NodeIdGenerator } from '../../../../../utils/deterministic-node-id';
import { HtmlRelationshipExtractor } from './html-utils/HtmlRelationshipExtractor';
import { HtmlRelationship } from './html-utils/HtmlRelationshipTypes';
import { RelationshipMetadata } from '../types/ExtensibleMetadata';
import { RelationshipCategory, RelationshipTypeMapping } from '../types/RelationshipTypes';
import Parser from 'tree-sitter';
type StandardType = StandardizedQueryResult['type'];

/**
 * HTML语言适配器
 * 处理HTML特定的查询结果标准化
 */
export class HtmlLanguageAdapter implements IEnhancedHtmlLanguageAdapter {
  private logger: LoggerService;
  private relationshipExtractor: HtmlRelationshipExtractor;

  constructor() {
    this.logger = new LoggerService();
    this.relationshipExtractor = new HtmlRelationshipExtractor();
  }

  async normalize(queryResults: any[], queryType: string, language: string): Promise<StandardizedQueryResult[]> {
    const results: (StandardizedQueryResult | null)[] = [];

    for (const result of queryResults) {
      try {
        const extraInfo = this.extractExtraInfo(result);
        const astNode = result.captures?.[0]?.node;
        const nodeId = NodeIdGenerator.safeForAstNode(astNode, queryType, this.extractName(result) || 'unknown');

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

  /**
   * 带关系提取的标准化方法
   * @param queryResults 查询结果
   * @param queryType 查询类型
   * @param language 语言
   * @param ast AST节点
   * @returns 标准化查询结果数组
   */
  async normalizeWithRelationships(
    queryResults: any[], 
    queryType: string, 
    language: string,
    ast: Parser.SyntaxNode
  ): Promise<StandardizedQueryResult[]> {
    const results = await this.normalize(queryResults, queryType, language);
    
    // 提取关系
    const relationshipResult = await this.relationshipExtractor.extractAllRelationships(ast);
    const relationships = relationshipResult.relationships;
    
    // 将HTML关系转换为RelationshipMetadata格式
    const relationshipMetadata = this.convertToRelationshipMetadata(relationships);
    
    // 将关系附加到相关结果
    return results.map(result => ({
      ...result,
      metadata: {
        ...result.metadata,
        relationships: relationshipMetadata.filter((rel: RelationshipMetadata) => 
          this.isRelationshipRelevant(rel, result)
        )
      }
    }));
  }

  /**
   * 将HTML关系转换为RelationshipMetadata格式
   * @param htmlRelationships HTML关系数组
   * @returns RelationshipMetadata数组
   */
  private convertToRelationshipMetadata(htmlRelationships: HtmlRelationship[]): RelationshipMetadata[] {
    return htmlRelationships.map(rel => {
      const relationshipType = this.mapHtmlRelationshipType(rel.type);
      const category = RelationshipTypeMapping.getCategory(relationshipType);
      
      return {
        type: relationshipType,
        category,
        fromNodeId: rel.source,
        toNodeId: rel.target,
        strength: this.calculateRelationshipStrength(rel),
        weight: this.calculateRelationshipWeight(rel),
        ...rel.metadata
      };
    });
  }

  /**
   * 映射HTML关系类型到标准关系类型
   * @param htmlType HTML关系类型
   * @returns 标准关系类型
   */
  private mapHtmlRelationshipType(htmlType: string): any {
    const mapping: Record<string, any> = {
      // 结构关系映射到语义关系
      'parent-child': 'composes',
      'sibling': 'composes',
      'ancestor': 'composes',
      
      // 依赖关系映射到依赖关系
      'resource-dependency': 'import',
      'script-dependency': 'import',
      'style-dependency': 'import',
      
      // 引用关系映射到引用关系
      'id-reference': 'usage',
      'class-reference': 'usage',
      'name-reference': 'usage',
      'for-reference': 'usage',
      
      // 语义关系保持原样
      'form-relationship': 'configures',
      'table-relationship': 'configures',
      'navigation-relationship': 'configures',
      'list-relationship': 'configures'
    };
    
    return mapping[htmlType] || 'usage';
  }

  /**
   * 计算关系强度
   * @param relationship HTML关系
   * @returns 关系强度（0-1）
   */
  private calculateRelationshipStrength(relationship: HtmlRelationship): number {
    // 基于关系类型设置基础强度
    const baseStrength: Record<string, number> = {
      'parent-child': 0.9,
      'sibling': 0.5,
      'ancestor': 0.7,
      'resource-dependency': 0.8,
      'script-dependency': 0.8,
      'style-dependency': 0.8,
      'id-reference': 0.9,
      'class-reference': 0.6,
      'name-reference': 0.7,
      'for-reference': 0.9,
      'form-relationship': 0.8,
      'table-relationship': 0.8,
      'navigation-relationship': 0.7,
      'list-relationship': 0.7
    };
    
    return baseStrength[relationship.type] || 0.5;
  }

  /**
   * 计算关系权重
   * @param relationship HTML关系
   * @returns 关系权重
   */
  private calculateRelationshipWeight(relationship: HtmlRelationship): number {
    // 基于关系类型和元数据计算权重
    let weight = 1.0;
    
    // 根据关系类型调整权重
    switch (relationship.type) {
      case 'parent-child':
        weight = 2.0;
        break;
      case 'resource-dependency':
        weight = 1.8;
        break;
      case 'id-reference':
        weight = 1.5;
        break;
      default:
        weight = 1.0;
    }
    
    // 根据元数据调整权重
    if (relationship.metadata) {
      if (relationship.metadata.isExternal) {
        weight += 0.5; // 外部资源权重更高
      }
      if (relationship.metadata.isCritical) {
        weight += 0.3; // 关键资源权重更高
      }
    }
    
    return weight;
  }

  /**
   * 检查关系是否与结果相关
   * @param relationship 关系元数据
   * @param result 标准化查询结果
   * @returns 是否相关
   */
  private isRelationshipRelevant(
    relationship: RelationshipMetadata, 
    result: StandardizedQueryResult
  ): boolean {
    // 判断关系是否与当前结果相关
    return relationship.fromNodeId === result.nodeId || 
           relationship.toNodeId === result.nodeId;
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
   * 提取HTML关系
   * @param ast AST节点
   * @returns HTML关系数组
   */
  async extractRelationships(ast: Parser.SyntaxNode): Promise<HtmlRelationship[]> {
    const result = await this.relationshipExtractor.extractAllRelationships(ast);
    return result.relationships;
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

    // 检查内容中的TypeScript特征
    const contentMatch = scriptTag.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
    if (contentMatch && contentMatch[1]) {
      const content = contentMatch[1];
      if (this.hasTypeScriptFeatures(content)) {
        return 'typescript';
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

    // 检查内容中的预处理器特征
    const contentMatch = styleTag.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    if (contentMatch && contentMatch[1]) {
      const content = contentMatch[1];
      if (this.hasSCSSFeatures(content)) {
        return 'scss';
      }
      if (this.hasLESSFeatures(content)) {
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

  /**
   * 检查是否包含TypeScript特征
   */
  private hasTypeScriptFeatures(content: string): boolean {
    const tsFeatures = [
      /:\s*(string|number|boolean|void|any|unknown|never)/g,  // 类型注解
      /interface\s+\w+/g,                                      // 接口
      /type\s+\w+\s*=/g,                                       // 类型别名
      /enum\s+\w+/g,                                           // 枚举
      /import\s+.*\s+from\s+['"][^'"]*['"]\s*;/g,              // ES6导入
      /export\s+(default\s+)?(class|interface|type|enum)/g,    // 导出
      /<\w+>/g,                                                // 泛型
      /\?\s*:/g,                                               // 可选属性
      /\.\.\.\w+/g                                             // 展开操作符
    ];

    return tsFeatures.some(feature => feature.test(content));
  }

  /**
   * 检查是否包含SCSS特征
   */
  private hasSCSSFeatures(content: string): boolean {
    const scssFeatures = [
      /@mixin\s+\w+/g,                                         // 混入
      /@include\s+\w+/g,                                       // 包含混入
      /\$\w+:/g,                                               // 变量
      /@extend\s+\w+/g,                                        // 继承
      /@if\s+/g,                                               // 条件语句
      /@for\s+/g,                                              // 循环
      /@each\s+/g,                                             // 遍历
      /@while\s+/g,                                            // while循环
      /%\w+/g,                                                 // 占位符选择器
      /&:\w+/g                                                 // 嵌套伪类
    ];

    return scssFeatures.some(feature => feature.test(content));
  }

  /**
   * 检查是否包含LESS特征
   */
  private hasLESSFeatures(content: string): boolean {
    const lessFeatures = [
      /@\w+:\s*[^;]+;/g,                                       // 变量
      /\.mixin\(\)/g,                                          // 混入
      /#\{.*\}/g,                                              // 变量插值
      /&\s*>\s*\w+/g,                                          // 直接子选择器
      /&\s*\+\s*\w+/g,                                         // 相邻兄弟选择器
      /&\s*~\s*\w+/g,                                          // 通用兄弟选择器
      /@import\s+['"][^'"]*['"]\s*;/g,                         // 导入
      /when\s*\(/g                                             // when条件
    ];

    return lessFeatures.some(feature => feature.test(content));
  }
}