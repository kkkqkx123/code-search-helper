import Parser from 'tree-sitter';
import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';
import { LoggerService } from '../../../../../../utils/LoggerService';

/**
 * HTML语言适配器辅助方法
 * 包含名称提取、属性处理、节点ID生成等通用方法
 */
export class HtmlHelperMethods {
  private static logger = new LoggerService();
  private static nodeCache: Map<string, string> = new Map();

  /**
   * 生成元素节点ID
   * @param node AST节点
   * @param queryType 查询类型
   * @param name 节点名称
   * @returns 节点ID
   */
  static generateElementId(node: Parser.SyntaxNode, queryType: string = 'html_element', name?: string): string {
    const cacheKey = `${node.id}_${node.startPosition.row}_${node.startPosition.column}`;
    
    if (this.nodeCache.has(cacheKey)) {
      return this.nodeCache.get(cacheKey)!;
    }

    const tagName = name || this.getTagName(node) || 'unknown';
    const nodeId = NodeIdGenerator.safeForAstNode(node, queryType, tagName);
    
    this.nodeCache.set(cacheKey, nodeId);
    return nodeId;
  }

  /**
   * 获取标签名
   * @param node AST节点
   * @returns 标签名
   */
  static getTagName(node: Parser.SyntaxNode): string | null {
    // 尝试从不同位置获取标签名
    if (node.type === 'tag_name') {
      return node.text;
    }

    if (node.type === 'element' || node.type === 'start_tag' || node.type === 'self_closing_tag') {
      const tagNameNode = node.childForFieldName('tag_name');
      if (tagNameNode) {
        return tagNameNode.text;
      }
    }

    if (node.type === 'script_element' || node.type === 'style_element') {
      const startTag = node.childForFieldName('start_tag');
      if (startTag) {
        const tagNameNode = startTag.childForFieldName('tag_name');
        if (tagNameNode) {
          return tagNameNode.text;
        }
      }
    }

    return null;
  }

  /**
   * 获取属性值
   * @param node AST节点
   * @param attributeName 属性名
   * @returns 属性值
   */
  static getAttributeValue(node: Parser.SyntaxNode, attributeName: string): string | null {
    if (!node.children) {
      return null;
    }

    for (const child of node.children) {
      if (child.type === 'attribute') {
        const attrNameNode = child.childForFieldName('attribute_name');
        const attrValueNode = child.childForFieldName('attribute_value');

        if (attrNameNode && attrNameNode.text === attributeName && attrValueNode) {
          // 移除引号
          return attrValueNode.text.replace(/^["']|["']$/g, '');
        }
      }
    }

    return null;
  }

  /**
   * 获取所有属性
   * @param node AST节点
   * @returns 属性映射
   */
  static getAllAttributes(node: Parser.SyntaxNode): Record<string, string> {
    const attributes: Record<string, string> = {};

    if (!node.children) {
      return attributes;
    }

    for (const child of node.children) {
      if (child.type === 'attribute') {
        const attrNameNode = child.childForFieldName('attribute_name');
        const attrValueNode = child.childForFieldName('attribute_value');

        if (attrNameNode) {
          const attrName = attrNameNode.text;
          const attrValue = attrValueNode ? 
            attrValueNode.text.replace(/^["']|["']$/g, '') : 'true';
          attributes[attrName] = attrValue;
        }
      }
    }

    return attributes;
  }

  /**
   * 检查是否为外部资源
   * @param url 资源URL
   * @returns 是否为外部资源
   */
  static isExternalResource(url: string): boolean {
    if (!url) return false;
    
    // 检查协议
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return true;
    }

    // 检查协议相对URL
    if (url.startsWith('//')) {
      return true;
    }

    // 检查data URL
    if (url.startsWith('data:')) {
      return false; // data URL不是外部资源
    }

    return false;
  }

  /**
   * 获取资源类型
   * @param url 资源URL
   * @param tagName 标签名
   * @returns 资源类型
   */
  static getResourceType(url: string, tagName: string): 'script' | 'stylesheet' | 'image' | 'video' | 'audio' | 'document' | 'font' | 'other' {
    // 基于标签名判断
    switch (tagName) {
      case 'script':
        return 'script';
      case 'link':
        return 'stylesheet'; // 默认假设link是样式表
      case 'img':
        return 'image';
      case 'video':
        return 'video';
      case 'audio':
        return 'audio';
      case 'iframe':
      case 'frame':
        return 'document';
      default:
        break;
    }

    // 基于文件扩展名判断
    const extension = this.getFileExtension(url);
    switch (extension) {
      case '.js':
      case '.mjs':
      case '.ts':
        return 'script';
      case '.css':
      case '.scss':
      case '.less':
        return 'stylesheet';
      case '.jpg':
      case '.jpeg':
      case '.png':
      case '.gif':
      case '.svg':
      case '.webp':
      case '.ico':
        return 'image';
      case '.mp4':
      case '.webm':
      case '.ogg':
        return 'video';
      case '.mp3':
      case '.wav':
        return 'audio';
      case '.woff':
      case '.woff2':
      case '.ttf':
      case '.eot':
        return 'font';
      case '.html':
      case '.htm':
        return 'document';
      default:
        return 'other';
    }
  }

  /**
   * 获取文件扩展名
   * @param url URL
   * @returns 扩展名
   */
  private static getFileExtension(url: string): string {
    const lastSlash = url.lastIndexOf('/');
    const lastQuestion = url.lastIndexOf('?');
    const lastHash = url.lastIndexOf('#');
    
    let filename = url.substring(lastSlash + 1);
    filename = filename.substring(0, Math.min(
      lastQuestion > -1 ? lastQuestion : filename.length,
      lastHash > -1 ? lastHash : filename.length
    ));
    
    const lastDot = filename.lastIndexOf('.');
    return lastDot > -1 ? filename.substring(lastDot) : '';
  }

  /**
   * 判断节点是否为元素节点
   * @param node AST节点
   * @returns 是否为元素节点
   */
  static isElementNode(node: Parser.SyntaxNode): boolean {
    const elementTypes = [
      'element',
      'script_element',
      'style_element',
      'start_tag',
      'end_tag',
      'self_closing_tag'
    ];
    
    return elementTypes.includes(node.type);
  }

  /**
   * 判断是否为表单元素
   * @param tagName 标签名
   * @returns 是否为表单元素
   */
  static isFormElement(tagName: string): boolean {
    const formElements = [
      'form', 'input', 'select', 'option', 'textarea', 'button', 
      'label', 'fieldset', 'legend', 'datalist', 'output'
    ];
    return formElements.includes(tagName.toLowerCase());
  }

  /**
   * 判断是否为表格元素
   * @param tagName 标签名
   * @returns 是否为表格元素
   */
  static isTableElement(tagName: string): boolean {
    const tableElements = [
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 
      'caption', 'colgroup', 'col'
    ];
    return tableElements.includes(tagName.toLowerCase());
  }

  /**
   * 判断是否为列表元素
   * @param tagName 标签名
   * @returns 是否为列表元素
   */
  static isListElement(tagName: string): boolean {
    const listElements = ['ul', 'ol', 'li', 'dl', 'dt', 'dd'];
    return listElements.includes(tagName.toLowerCase());
  }

  /**
   * 判断是否为语义元素
   * @param tagName 标签名
   * @returns 是否为语义元素
   */
  static isSemanticElement(tagName: string): boolean {
    const semanticElements = [
      'header', 'nav', 'main', 'article', 'section', 'aside', 'footer',
      'figure', 'figcaption', 'details', 'summary', 'time', 'mark'
    ];
    return semanticElements.includes(tagName.toLowerCase());
  }

  /**
   * 判断是否为自定义元素
   * @param tagName 标签名
   * @returns 是否为自定义元素
   */
  static isCustomElement(tagName: string): boolean {
    // 自定义元素包含连字符或以大写字母开头
    return tagName.includes('-') || 
           (tagName[0] === tagName[0].toUpperCase() && tagName !== tagName.toUpperCase());
  }

  /**
   * 遍历AST节点
   * @param node 根节点
   * @param callback 回调函数
   * @param maxDepth 最大深度
   * @param currentDepth 当前深度
   */
  static traverseAST(
    node: Parser.SyntaxNode,
    callback: (node: Parser.SyntaxNode, depth: number) => void,
    maxDepth: number = 50,
    currentDepth: number = 0
  ): void {
    if (currentDepth > maxDepth) {
      return;
    }

    callback(node, currentDepth);

    if (node.children) {
      for (const child of node.children) {
        this.traverseAST(child, callback, maxDepth, currentDepth + 1);
      }
    }
  }

  /**
   * 查找特定类型的节点
   * @param node 根节点
   * @param nodeType 节点类型
   * @param maxDepth 最大深度
   * @returns 节点数组
   */
  static findNodesByType(
    node: Parser.SyntaxNode,
    nodeType: string,
    maxDepth: number = 50
  ): Parser.SyntaxNode[] {
    const results: Parser.SyntaxNode[] = [];

    this.traverseAST(node, (currentNode) => {
      if (currentNode.type === nodeType) {
        results.push(currentNode);
      }
    }, maxDepth);

    return results;
  }

  /**
   * 查找具有特定属性的元素
   * @param node 根节点
   * @param attributeName 属性名
   * @param attributeValue 属性值（可选）
   * @returns 节点数组
   */
  static findElementsByAttribute(
    node: Parser.SyntaxNode,
    attributeName: string,
    attributeValue?: string
  ): Parser.SyntaxNode[] {
    const results: Parser.SyntaxNode[] = [];

    this.traverseAST(node, (currentNode) => {
      if (this.isElementNode(currentNode)) {
        const attrValue = this.getAttributeValue(currentNode, attributeName);
        if (attrValue !== null) {
          if (attributeValue === undefined || attrValue === attributeValue) {
            results.push(currentNode);
          }
        }
      }
    });

    return results;
  }

  /**
   * 查找具有特定ID的元素
   * @param node 根节点
   * @param id ID值
   * @returns 节点或null
   */
  static findElementById(node: Parser.SyntaxNode, id: string): Parser.SyntaxNode | null {
    const elements = this.findElementsByAttribute(node, 'id', id);
    return elements.length > 0 ? elements[0] : null;
  }

  /**
   * 查找具有特定类名的元素
   * @param node 根节点
   * @param className 类名
   * @returns 节点数组
   */
  static findElementsByClassName(node: Parser.SyntaxNode, className: string): Parser.SyntaxNode[] {
    const results: Parser.SyntaxNode[] = [];

    this.traverseAST(node, (currentNode) => {
      if (this.isElementNode(currentNode)) {
        const classAttr = this.getAttributeValue(currentNode, 'class');
        if (classAttr) {
          const classes = classAttr.split(/\s+/);
          if (classes.includes(className)) {
            results.push(currentNode);
          }
        }
      }
    });

    return results;
  }

  /**
   * 计算节点在文档中的位置权重
   * @param node AST节点
   * @returns 位置权重（0-1之间，越靠前权重越高）
   */
  static calculatePositionWeight(node: Parser.SyntaxNode): number {
    // 简单实现：基于行号计算权重
    // 实际应用中可以考虑更多因素，如节点类型、嵌套深度等
    const maxLines = 10000; // 假设文档最大行数
    const currentLine = node.startPosition.row;
    return Math.max(0, 1 - (currentLine / maxLines));
  }

  /**
   * 清理缓存
   */
  static clearCache(): void {
    this.nodeCache.clear();
    this.logger.debug('HTML helper methods cache cleared');
  }

  /**
   * 获取缓存统计
   */
  static getCacheStats(): { size: number } {
    return {
      size: this.nodeCache.size
    };
  }
}