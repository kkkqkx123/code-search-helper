import { CodeChunk } from '../../../types';
import { CodeGraphNode } from '../../../../../graph/core/types';
import { HtmlRelationship } from './HtmlRelationshipTypes';
import { Logger } from '../../../../../../utils/logger';

/**
 * HTML图节点生成器
 * 负责将HTML代码块转换为图节点，支持图索引
 */
export class HtmlGraphNodeGenerator {
  private logger: Logger;
  private nodeCache: Map<string, CodeGraphNode> = new Map();

  constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * 为代码块和关系生成图节点
   * @param chunks 代码块数组
   * @param relationships HTML关系数组
   * @returns 生成的图节点数组
   */
  generateNodes(
    chunks: CodeChunk[], 
    relationships: HtmlRelationship[]
  ): CodeGraphNode[] {
    const nodes: CodeGraphNode[] = [];
    
    // 为每个代码块生成节点
    for (const chunk of chunks) {
      const node = this.createNodeFromChunk(chunk);
      if (node) {
        nodes.push(node);
        // 缓存节点以提高查找性能
        this.nodeCache.set(node.id, node);
      }
    }
    
    // 为关系中的外部资源生成节点
    const externalNodes = this.createExternalResourceNodes(relationships);
    nodes.push(...externalNodes);
    
    this.logger.debug(`Generated ${nodes.length} graph nodes from ${chunks.length} chunks`);
    
    return nodes;
  }

  /**
   * 从代码块创建图节点
   * @param chunk 代码块
   * @returns 图节点
   */
  private createNodeFromChunk(chunk: CodeChunk): CodeGraphNode | null {
    try {
      const nodeId = this.generateNodeId(chunk);
      const nodeType = this.mapChunkTypeToNodeType(chunk.metadata.type);
      const nodeName = this.generateNodeName(chunk);
      
      return {
        id: nodeId,
        type: nodeType,
        name: nodeName,
        properties: {
          content: chunk.content,
          language: chunk.metadata.language,
          filePath: chunk.metadata.filePath,
          startLine: chunk.metadata.startLine,
          endLine: chunk.metadata.endLine,
          complexity: chunk.metadata.complexity,
          nestingLevel: chunk.metadata.nestingLevel,
          // HTML特定属性
          chunkType: chunk.metadata.type,
          tagName: chunk.metadata.tagName,
          elementType: chunk.metadata.elementType,
          attributes: chunk.metadata.attributes,
          scriptId: chunk.metadata.scriptId,
          scriptLanguage: chunk.metadata.scriptLanguage,
          styleId: chunk.metadata.styleId,
          styleType: chunk.metadata.styleType,
          contentHash: chunk.metadata.contentHash,
          // 其他元数据
          ...this.extractAdditionalProperties(chunk)
        }
      };
    } catch (error) {
      this.logger.error(`Failed to create node from chunk: ${error}`);
      return null;
    }
  }

  /**
   * 为外部资源创建节点
   * @param relationships HTML关系数组
   * @returns 外部资源节点数组
   */
  private createExternalResourceNodes(relationships: HtmlRelationship[]): CodeGraphNode[] {
    const externalNodes: CodeGraphNode[] = [];
    const processedResources = new Set<string>();

    for (const rel of relationships) {
      if (rel.type === 'resource-dependency' && rel.metadata?.resourceType) {
        const resourceUrl = rel.target;
        
        // 避免重复创建相同资源的节点
        if (processedResources.has(resourceUrl)) {
          continue;
        }
        processedResources.add(resourceUrl);

        const node = this.createExternalResourceNode(resourceUrl, rel.metadata);
        if (node) {
          externalNodes.push(node);
          this.nodeCache.set(node.id, node);
        }
      }
    }

    return externalNodes;
  }

  /**
   * 创建单个外部资源节点
   * @param resourceUrl 资源URL
   * @param metadata 关系元数据
   * @returns 外部资源节点
   */
  private createExternalResourceNode(
    resourceUrl: string, 
    metadata: any
  ): CodeGraphNode | null {
    try {
      const resourceType = metadata.resourceType;
      const nodeType = this.mapResourceTypeToNodeType(resourceType);
      
      return {
        id: this.generateExternalNodeId(resourceUrl),
        type: nodeType,
        name: this.extractResourceName(resourceUrl),
        properties: {
          resourceUrl,
          resourceType,
          isExternal: true,
          attribute: metadata.attribute,
          // 尝试从URL提取更多信息
          fileExtension: this.extractFileExtension(resourceUrl),
          protocol: this.extractProtocol(resourceUrl),
          domain: this.extractDomain(resourceUrl)
        }
      };
    } catch (error) {
      this.logger.error(`Failed to create external resource node for ${resourceUrl}: ${error}`);
      return null;
    }
  }

  /**
   * 生成节点ID
   * @param chunk 代码块
   * @returns 节点ID
   */
  private generateNodeId(chunk: CodeChunk): string {
    const filePath = chunk.metadata.filePath || 'unknown';
    const startLine = chunk.metadata.startLine;
    const chunkType = chunk.metadata.type || 'unknown';
    
    // 使用文件路径、行号和类型生成唯一ID
    return `${filePath}:${startLine}:${chunkType}`;
  }

  /**
   * 生成外部资源节点ID
   * @param resourceUrl 资源URL
   * @returns 节点ID
   */
  private generateExternalNodeId(resourceUrl: string): string {
    return `external:${resourceUrl}`;
  }

  /**
   * 生成节点名称
   * @param chunk 代码块
   * @returns 节点名称
   */
  private generateNodeName(chunk: CodeChunk): string {
    const metadata = chunk.metadata;
    
    // 优先使用tagName
    if (metadata.tagName) {
      return metadata.tagName;
    }
    
    // 使用scriptId或styleId
    if (metadata.scriptId) {
      return `script:${metadata.scriptId}`;
    }
    
    if (metadata.styleId) {
      return `style:${metadata.styleId}`;
    }
    
    // 使用类型和位置信息
    const type = metadata.type || 'unknown';
    const line = metadata.startLine;
    return `${type}:${line}`;
  }

  /**
   * 提取资源名称
   * @param resourceUrl 资源URL
   * @returns 资源名称
   */
  private extractResourceName(resourceUrl: string): string {
    // 从URL中提取文件名
    const parts = resourceUrl.split('/');
    const fileName = parts[parts.length - 1];
    
    if (fileName) {
      return fileName;
    }
    
    // 如果没有文件名，使用整个URL
    return resourceUrl;
  }

  /**
   * 将代码块类型映射到图节点类型
   * @param chunkType 代码块类型
   * @returns 图节点类型
   */
  private mapChunkTypeToNodeType(chunkType?: string): string {
    if (!chunkType) {
      return 'Element';
    }

    const typeMapping: Record<string, string> = {
      'document': 'Document',
      'element': 'Element',
      'script': 'Script',
      'style': 'Style',
      'text': 'Text',
      'attribute': 'Attribute',
      'html_fallback': 'Document',
      'structure': 'Element',
      'script_content': 'Script',
      'style_content': 'Style'
    };

    return typeMapping[chunkType] || 'Element';
  }

  /**
   * 将资源类型映射到图节点类型
   * @param resourceType 资源类型
   * @returns 图节点类型
   */
  private mapResourceTypeToNodeType(resourceType: string): string {
    const typeMapping: Record<string, string> = {
      'javascript': 'Script',
      'js': 'Script',
      'css': 'Style',
      'stylesheet': 'Style',
      'image': 'Image',
      'img': 'Image',
      'icon': 'Image',
      'font': 'Font',
      'document': 'Document',
      'html': 'Document',
      'json': 'Data',
      'api': 'API',
      'video': 'Media',
      'audio': 'Media'
    };

    return typeMapping[resourceType.toLowerCase()] || 'Resource';
  }

  /**
   * 提取文件扩展名
   * @param url URL
   * @returns 文件扩展名
   */
  private extractFileExtension(url: string): string | undefined {
    const parts = url.split('.');
    if (parts.length > 1) {
      return parts[parts.length - 1].split('?')[0]; // 移除查询参数
    }
    return undefined;
  }

  /**
   * 提取协议
   * @param url URL
   * @returns 协议
   */
  private extractProtocol(url: string): string | undefined {
    const match = url.match(/^([a-zA-Z]+):\/\//);
    return match ? match[1] : undefined;
  }

  /**
   * 提取域名
   * @param url URL
   * @returns 域名
   */
  private extractDomain(url: string): string | undefined {
    try {
      const match = url.match(/^[a-zA-Z]+:\/\/([^\/]+)/);
      return match ? match[1] : undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * 提取额外属性
   * @param chunk 代码块
   * @returns 额外属性对象
   */
  private extractAdditionalProperties(chunk: CodeChunk): Record<string, any> {
    const additionalProps: Record<string, any> = {};
    
    // 提取所有自定义属性
    for (const [key, value] of Object.entries(chunk.metadata)) {
      // 跳过已经处理的标准属性
      if (![
        'startLine', 'endLine', 'language', 'filePath', 'type', 'complexity',
        'nestingLevel', 'tagName', 'elementType', 'attributes', 'scriptId',
        'scriptLanguage', 'styleId', 'styleType', 'contentHash'
      ].includes(key)) {
        additionalProps[key] = value;
      }
    }
    
    return additionalProps;
  }

  /**
   * 根据ID查找节点
   * @param nodeId 节点ID
   * @returns 节点或undefined
   */
  findNodeById(nodeId: string): CodeGraphNode | undefined {
    return this.nodeCache.get(nodeId);
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.nodeCache.clear();
    this.logger.debug('Cleared HTML graph node cache');
  }

  /**
   * 获取缓存统计
   * @returns 缓存统计信息
   */
  getCacheStats(): { size: number } {
    return {
      size: this.nodeCache.size
    };
  }
}