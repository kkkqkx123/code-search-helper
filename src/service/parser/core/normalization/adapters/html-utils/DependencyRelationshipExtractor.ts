import Parser from 'tree-sitter';
import { HtmlHelperMethods } from './HtmlHelperMethods';
import { DependencyRelationship, IRelationshipExtractor } from './HtmlRelationshipTypes';
import { LoggerService } from '../../../../../../utils/LoggerService';

/**
 * 依赖关系提取器
 * 提取HTML元素之间的资源依赖关系：脚本依赖、样式依赖、资源依赖
 */
export class DependencyRelationshipExtractor implements IRelationshipExtractor {
  private logger: LoggerService;

  constructor() {
    this.logger = new LoggerService();
  }

  /**
   * 提取所有依赖关系
   * @param ast AST根节点
   * @returns 依赖关系数组
   */
  extractRelationships(ast: Parser.SyntaxNode): DependencyRelationship[] {
    const relationships: DependencyRelationship[] = [];
    
    // 提取资源依赖
    this.extractResourceDependencies(ast, relationships);
    
    // 提取脚本依赖
    this.extractScriptDependencies(ast, relationships);
    
    // 提取样式依赖
    this.extractStyleDependencies(ast, relationships);
    
    this.logger.debug(`提取了 ${relationships.length} 个依赖关系`);
    return relationships;
  }

  /**
   * 提取资源依赖
   * @param node 当前节点
   * @param relationships 关系数组
   */
  private extractResourceDependencies(
    node: Parser.SyntaxNode,
    relationships: DependencyRelationship[]
  ): void {
    // 遍历所有元素节点
    HtmlHelperMethods.traverseAST(node, (currentNode) => {
      if (HtmlHelperMethods.isElementNode(currentNode)) {
        const elementId = HtmlHelperMethods.generateElementId(currentNode);
        const tagName = HtmlHelperMethods.getTagName(currentNode) || 'unknown';
        const attributes = HtmlHelperMethods.getAllAttributes(currentNode);

        // 检查各种资源依赖属性
        const resourceAttributes = ['src', 'href', 'data-src', 'poster', 'cite', 'data'];
        
        for (const attr of resourceAttributes) {
          const resourceUrl = attributes[attr];
          if (resourceUrl) {
            const resourceType = HtmlHelperMethods.getResourceType(resourceUrl, tagName);
            const isExternal = HtmlHelperMethods.isExternalResource(resourceUrl);

            relationships.push({
              type: 'resource-dependency',
              source: elementId,
              target: resourceUrl,
              dependencyType: this.mapAttributeToDependencyType(attr),
              resourceType,
              resourceUrl,
              isExternal,
              metadata: {
                attributeName: attr,
                tagName,
                elementAttributes: attributes,
                resourceSize: this.estimateResourceSize(resourceUrl, resourceType),
                loadPriority: this.calculateLoadPriority(tagName, attr, resourceType),
                isCritical: this.isCriticalResource(tagName, attr, resourceType),
                isLazy: this.isLazyLoaded(attributes),
                resourceProtocol: this.extractProtocol(resourceUrl),
                resourceDomain: this.extractDomain(resourceUrl)
              }
            });
          }
        }
      }
    });
  }

  /**
   * 提取脚本依赖
   * @param node 当前节点
   * @param relationships 关系数组
   */
  private extractScriptDependencies(
    node: Parser.SyntaxNode,
    relationships: DependencyRelationship[]
  ): void {
    // 查找所有script元素
    const scriptElements = HtmlHelperMethods.findNodesByType(node, 'script_element');
    
    for (const scriptElement of scriptElements) {
      const scriptId = HtmlHelperMethods.generateElementId(scriptElement);
      const attributes = HtmlHelperMethods.getAllAttributes(scriptElement);
      
      // 检查外部脚本依赖
      const src = attributes.src;
      if (src) {
        relationships.push({
          type: 'script-dependency',
          source: scriptId,
          target: src,
          dependencyType: 'src',
          resourceType: 'script',
          resourceUrl: src,
          isExternal: HtmlHelperMethods.isExternalResource(src),
          metadata: {
            scriptType: attributes.type || 'text/javascript',
            isAsync: attributes.async === 'true' || attributes.async === '',
            isDefer: attributes.defer === 'true' || attributes.defer === '',
            isModule: attributes.type === 'module',
            isNomodule: attributes.nomodule === 'true' || attributes.nomodule === '',
            hasIntegrity: !!attributes.integrity,
            hasCrossorigin: !!attributes.crossorigin,
            scriptAttributes: attributes,
            loadOrder: this.calculateScriptLoadOrder(attributes),
            executionTiming: this.getScriptExecutionTiming(attributes)
          }
        });
      }

      // 检查脚本内容中的导入依赖
      this.extractScriptImportDependencies(scriptElement, scriptId, relationships);
    }
  }

  /**
   * 提取样式依赖
   * @param node 当前节点
   * @param relationships 关系数组
   */
  private extractStyleDependencies(
    node: Parser.SyntaxNode,
    relationships: DependencyRelationship[]
  ): void {
    // 查找所有link元素（通常是样式表）
    const linkElements = HtmlHelperMethods.findNodesByType(node, 'element');
    
    for (const linkElement of linkElements) {
      const tagName = HtmlHelperMethods.getTagName(linkElement);
      if (tagName === 'link') {
        const linkId = HtmlHelperMethods.generateElementId(linkElement);
        const attributes = HtmlHelperMethods.getAllAttributes(linkElement);
        
        // 检查样式表依赖
        const href = attributes.href;
        const rel = attributes.rel;
        
        if (href && (rel === 'stylesheet' || rel === 'preload')) {
          const resourceType = rel === 'stylesheet' ? 'stylesheet' : 
            HtmlHelperMethods.getResourceType(href, 'link');
          
          relationships.push({
            type: 'style-dependency',
            source: linkId,
            target: href,
            dependencyType: 'href',
            resourceType,
            resourceUrl: href,
            isExternal: HtmlHelperMethods.isExternalResource(href),
            metadata: {
              rel,
              media: attributes.media || 'all',
              isDisabled: attributes.disabled === 'true' || attributes.disabled === '',
              isAlternate: false,
              isPreload: rel === 'preload',
              linkAttributes: attributes,
              loadPriority: this.calculateStyleLoadPriority(attributes),
              renderBlocking: this.isRenderBlockingStyle(attributes),
              cssIntegrity: !!attributes.integrity,
              cssCrossorigin: !!attributes.crossorigin
            }
          });
        }
      }
    }

    // 查找style元素中的@import依赖
    const styleElements = HtmlHelperMethods.findNodesByType(node, 'style_element');
    for (const styleElement of styleElements) {
      const styleId = HtmlHelperMethods.generateElementId(styleElement);
      this.extractStyleImportDependencies(styleElement, styleId, relationships);
    }
  }

  /**
   * 提取脚本内容中的导入依赖
   * @param scriptElement script元素
   * @param scriptId script元素ID
   * @param relationships 关系数组
   */
  private extractScriptImportDependencies(
    scriptElement: Parser.SyntaxNode,
    scriptId: string,
    relationships: DependencyRelationship[]
  ): void {
    // 获取script内容
    const rawTextNode = scriptElement.childForFieldName('raw_text');
    if (!rawTextNode) return;

    const scriptContent = rawTextNode.text;
    
    // 匹配import语句
    const importRegex = /import\s+(?:(?:\*\s+as\s+\w+)|(?:\w+)|(?:\{[^}]+\}))\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    
    while ((match = importRegex.exec(scriptContent)) !== null) {
      const importPath = match[1];
      const isExternal = HtmlHelperMethods.isExternalResource(importPath);
      
      relationships.push({
        type: 'script-dependency',
        source: scriptId,
        target: importPath,
        dependencyType: 'import',
        resourceType: 'script',
        resourceUrl: importPath,
        isExternal,
        metadata: {
          importType: 'es6-import',
          importStatement: match[0],
          isDynamic: false,
          isTypeOnly: false,
          importPosition: {
            line: rawTextNode.startPosition.row + this.getLineNumber(scriptContent, match.index),
            column: match.index
          }
        }
      });
    }

    // 匹配动态import
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    while ((match = dynamicImportRegex.exec(scriptContent)) !== null) {
      const importPath = match[1];
      const isExternal = HtmlHelperMethods.isExternalResource(importPath);
      
      relationships.push({
        type: 'script-dependency',
        source: scriptId,
        target: importPath,
        dependencyType: 'import',
        resourceType: 'script',
        resourceUrl: importPath,
        isExternal,
        metadata: {
          importType: 'dynamic-import',
          importStatement: match[0],
          isDynamic: true,
          isTypeOnly: false,
          importPosition: {
            line: rawTextNode.startPosition.row + this.getLineNumber(scriptContent, match.index),
            column: match.index
          }
        }
      });
    }
  }

  /**
   * 提取样式内容中的@import依赖
   * @param styleElement style元素
   * @param styleId style元素ID
   * @param relationships 关系数组
   */
  private extractStyleImportDependencies(
    styleElement: Parser.SyntaxNode,
    styleId: string,
    relationships: DependencyRelationship[]
  ): void {
    // 获取style内容
    const rawTextNode = styleElement.childForFieldName('raw_text');
    if (!rawTextNode) return;

    const styleContent = rawTextNode.text;
    
    // 匹配@import规则
    const importRegex = /@import\s+(?:url\()?['"]?([^'")\s]+)['"]?\)?(?:\s+([^;]+))?;/g;
    let match;
    
    while ((match = importRegex.exec(styleContent)) !== null) {
      const importPath = match[1];
      const mediaQuery = match[2] || 'all';
      const isExternal = HtmlHelperMethods.isExternalResource(importPath);
      
      relationships.push({
        type: 'style-dependency',
        source: styleId,
        target: importPath,
        dependencyType: 'import',
        resourceType: 'stylesheet',
        resourceUrl: importPath,
        isExternal,
        metadata: {
          importType: 'css-import',
          mediaQuery,
          importStatement: match[0],
          importPosition: {
            line: rawTextNode.startPosition.row + this.getLineNumber(styleContent, match.index),
            column: match.index
          }
        }
      });
    }
  }

  /**
   * 映射属性名到依赖类型
   * @param attribute 属性名
   * @returns 依赖类型
   */
  private mapAttributeToDependencyType(attribute: string): 'src' | 'href' | 'data-src' | 'import' | 'link' {
    const mapping: Record<string, 'src' | 'href' | 'data-src' | 'import' | 'link'> = {
      'src': 'src',
      'href': 'href',
      'data-src': 'data-src',
      'poster': 'src',
      'cite': 'link',
      'data': 'link'
    };
    
    return mapping[attribute] || 'link';
  }

  /**
   * 估算资源大小
   * @param url 资源URL
   * @param resourceType 资源类型
   * @returns 估算大小（字节）
   */
  private estimateResourceSize(url: string, resourceType: string): number {
    // 基于文件扩展名的简单估算
    const extension = url.split('.').pop()?.toLowerCase();
    
    const sizeEstimates: Record<string, number> = {
      'js': 50000,      // 50KB
      'css': 20000,     // 20KB
      'png': 100000,    // 100KB
      'jpg': 80000,     // 80KB
      'gif': 50000,     // 50KB
      'svg': 10000,     // 10KB
      'woff': 50000,    // 50KB
      'woff2': 40000,   // 40KB
      'mp4': 1000000,   // 1MB
      'webm': 800000,   // 800KB
      'mp3': 3000000,   // 3MB
      'wav': 5000000    // 5MB
    };
    
    return sizeEstimates[extension || ''] || 25000; // 默认25KB
  }

  /**
   * 计算加载优先级
   * @param tagName 标签名
   * @param attribute 属性名
   * @param resourceType 资源类型
   * @returns 优先级（1-10，10最高）
   */
  private calculateLoadPriority(tagName: string, attribute: string, resourceType: string): number {
    // CSS样式表通常优先级最高
    if (resourceType === 'stylesheet') return 9;
    
    // 关键脚本
    if (tagName === 'script' && attribute === 'src') {
      return 8; // 同步脚本优先级高
    }
    
    // 图片资源
    if (resourceType === 'image') {
      return tagName === 'img' ? 7 : 5; // img标签优先级高于其他图片引用
    }
    
    // 字体资源
    if (resourceType === 'font') return 6;
    
    // 视频音频
    if (resourceType === 'video' || resourceType === 'audio') return 4;
    
    // 其他资源
    return 3;
  }

  /**
   * 判断是否为关键资源
   * @param tagName 标签名
   * @param attribute 属性名
   * @param resourceType 资源类型
   * @returns 是否为关键资源
   */
  private isCriticalResource(tagName: string, attribute: string, resourceType: string): boolean {
    // 阻塞渲染的CSS是关键资源
    if (resourceType === 'stylesheet') return true;
    
    // 同步脚本是关键资源
    if (tagName === 'script' && attribute === 'src') return true;
    
    // head中的资源通常是关键资源
    // 这里简化处理，实际应该检查元素是否在head中
    
    return false;
  }

  /**
   * 判断是否为延迟加载
   * @param attributes 属性映射
   * @returns 是否为延迟加载
   */
  private isLazyLoaded(attributes: Record<string, string>): boolean {
    return attributes.loading === 'lazy' || 
           attributes['data-src'] !== undefined ||
           attributes.srcset !== undefined;
  }

  /**
   * 提取协议
   * @param url URL
   * @returns 协议
   */
  private extractProtocol(url: string): string {
    if (url.startsWith('http://')) return 'http';
    if (url.startsWith('https://')) return 'https';
    if (url.startsWith('//')) return 'protocol-relative';
    if (url.startsWith('data:')) return 'data';
    if (url.startsWith('blob:')) return 'blob';
    return 'relative';
  }

  /**
   * 提取域名
   * @param url URL
   * @returns 域名
   */
  private extractDomain(url: string): string {
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return new URL(url).hostname;
      }
    } catch {
      // 忽略URL解析错误
    }
    return 'same-origin';
  }

  /**
   * 计算脚本加载顺序
   * @param attributes 属性映射
   * @returns 加载顺序
   */
  private calculateScriptLoadOrder(attributes: Record<string, string>): 'high' | 'normal' | 'low' {
    if (attributes.async === 'true' || attributes.async === '') return 'low';
    if (attributes.defer === 'true' || attributes.defer === '') return 'normal';
    return 'high'; // 同步脚本优先级最高
  }

  /**
   * 获取脚本执行时机
   * @param attributes 属性映射
   * @returns 执行时机
   */
  private getScriptExecutionTiming(attributes: Record<string, string>): 'immediate' | 'deferred' | 'async' {
    if (attributes.async === 'true' || attributes.async === '') return 'async';
    if (attributes.defer === 'true' || attributes.defer === '') return 'deferred';
    return 'immediate';
  }

  /**
   * 计算样式加载优先级
   * @param attributes 属性映射
   * @returns 优先级
   */
  private calculateStyleLoadPriority(attributes: Record<string, string>): 'high' | 'normal' | 'low' {
    if (attributes.disabled === 'true' || attributes.disabled === '') return 'low';
    if (attributes.media && attributes.media !== 'all') return 'normal';
    return 'high';
  }

  /**
   * 判断是否为阻塞渲染的样式
   * @param attributes 属性映射
   * @returns 是否阻塞渲染
   */
  private isRenderBlockingStyle(attributes: Record<string, string>): boolean {
    // 非禁用、非异步、非媒体查询的样式表会阻塞渲染
    return attributes.disabled !== 'true' && 
           attributes.async !== 'true' &&
           (!attributes.media || attributes.media === 'all');
  }

  /**
   * 获取文本中指定偏移量的行号
   * @param text 文本
   * @param offset 偏移量
   * @returns 行号
   */
  private getLineNumber(text: string, offset: number): number {
    const beforeOffset = text.substring(0, offset);
    return beforeOffset.split('\n').length;
  }

  /**
   * 获取依赖关系统计信息
   * @param relationships 关系数组
   * @returns 统计信息
   */
  public getRelationshipStats(relationships: DependencyRelationship[]): {
    resource: number;
    script: number;
    style: number;
    external: number;
    internal: number;
    total: number;
    resourceTypeDistribution: Record<string, number>;
    dependencyTypeDistribution: Record<string, number>;
  } {
    const stats = {
      resource: 0,
      script: 0,
      style: 0,
      external: 0,
      internal: 0,
      total: relationships.length,
      resourceTypeDistribution: {} as Record<string, number>,
      dependencyTypeDistribution: {} as Record<string, number>
    };

    for (const rel of relationships) {
      switch (rel.type) {
        case 'resource-dependency':
          stats.resource++;
          break;
        case 'script-dependency':
          stats.script++;
          break;
        case 'style-dependency':
          stats.style++;
          break;
      }

      if (rel.isExternal) {
        stats.external++;
      } else {
        stats.internal++;
      }

      // 统计资源类型分布
      stats.resourceTypeDistribution[rel.resourceType] = 
        (stats.resourceTypeDistribution[rel.resourceType] || 0) + 1;

      // 统计依赖类型分布
      stats.dependencyTypeDistribution[rel.dependencyType] = 
        (stats.dependencyTypeDistribution[rel.dependencyType] || 0) + 1;
    }

    return stats;
  }
}