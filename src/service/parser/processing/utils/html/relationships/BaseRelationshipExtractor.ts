import Parser from 'tree-sitter';
import { LoggerService } from '../../../../../../utils/LoggerService';
import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';

/**
 * 基础关系提取器
 * 提供通用的辅助方法和工具函数
 */
export abstract class BaseRelationshipExtractor {
  protected logger: LoggerService;
  protected nodeCache: Map<string, string> = new Map();

  constructor() {
    this.logger = new LoggerService();
  }

  /**
   * 生成元素节点ID
   * @param node AST节点
   * @returns 节点ID
   */
  protected generateElementId(node: Parser.SyntaxNode): string {
    const cacheKey = `${node.id}_${node.startPosition.row}_${node.startPosition.column}`;
    
    if (this.nodeCache.has(cacheKey)) {
      return this.nodeCache.get(cacheKey)!;
    }

    const tagName = this.getTagName(node);
    const nodeId = NodeIdGenerator.safeForAstNode(node, 'html_element', tagName || 'unknown');
    
    this.nodeCache.set(cacheKey, nodeId);
    return nodeId;
  }

  /**
   * 获取标签名
   * @param node AST节点
   * @returns 标签名
   */
  protected getTagName(node: Parser.SyntaxNode): string | null {
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
  protected getAttributeValue(node: Parser.SyntaxNode, attributeName: string): string | null {
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
  protected getAllAttributes(node: Parser.SyntaxNode): Record<string, string> {
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
  protected isExternalResource(url: string): boolean {
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
  protected getResourceType(url: string, tagName: string): 'script' | 'stylesheet' | 'image' | 'video' | 'audio' | 'document' | 'font' | 'other' {
    // 基于标签名判断
    switch (tagName) {
      case 'script':
        return 'script';
      case 'link':
        const rel = this.getLinkRel(url);
        if (rel === 'stylesheet') return 'stylesheet';
        if (rel === 'preload') return this.getPreloadType(url);
        return 'other';
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
      case '.ogg':
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
  private getFileExtension(url: string): string {
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
   * 获取link标签的rel属性值
   * @param url URL（这里实际上是属性值，为了保持接口一致）
   * @returns rel值
   */
  private getLinkRel(url: string): string {
    // 这个方法需要在使用处传入实际的节点，这里简化处理
    return 'stylesheet'; // 默认值
  }

  /**
   * 获取preload资源的类型
   * @param url URL
   * @returns 资源类型
   */
  private getPreloadType(url: string): 'script' | 'stylesheet' | 'image' | 'video' | 'audio' | 'document' | 'font' | 'other' {
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
      case '.woff':
      case '.woff2':
      case '.ttf':
      case '.eot':
        return 'font';
      default:
        return this.getResourceType(url, 'img');
    }
  }

  /**
   * 遍历AST节点
   * @param node 根节点
   * @param callback 回调函数
   * @param maxDepth 最大深度
   * @param currentDepth 当前深度
   */
  protected traverseAST(
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
  protected findNodesByType(
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
   * 清理缓存
   */
  public clearCache(): void {
    this.nodeCache.clear();
  }

  /**
   * 获取缓存统计
   */
  public getCacheStats(): { size: number } {
    return {
      size: this.nodeCache.size
    };
  }
}