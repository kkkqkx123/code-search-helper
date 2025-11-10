import { injectable, inject } from 'inversify';
import { CodeChunk, ChunkMetadata, ChunkType } from '../../types/CodeChunk';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { SimilarityUtils } from '../../../../similarity/utils/SimilarityUtils';
import {
  XMLChunkingConfig,
  XMLBlockType,
  DEFAULT_XML_CONFIG,
  XML_SEMANTIC_WEIGHTS,
  XML_PATTERNS,
  isXMLFile,
  getXMLBlockType,
  getElementName,
  calculateXMLSemanticSimilarity,
  isOpeningTag,
  isClosingTag,
  isSelfClosingTag,
  isComment,
  isCDATA,
  isProcessingInstruction,
  isXMLDeclaration,
  isDOCTYPE
} from './xml-rules';

/**
 * XML 专用文本分段器
 * 针对 XML 文件的特殊结构和语义进行优化的分段策略
 */
@injectable()
export class XMLTextStrategy {
  private config: XMLChunkingConfig;
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject('unmanaged') config?: Partial<XMLChunkingConfig>
  ) {
    this.logger = logger;
    this.config = { ...DEFAULT_XML_CONFIG, ...config };
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<XMLChunkingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): XMLChunkingConfig {
    return { ...this.config };
  }

  /**
   * XML 专用分段方法
   */
  async chunkXML(content: string, filePath?: string): Promise<CodeChunk[]> {
    try {
      if (!isXMLFile(filePath || '')) {
        this.logger?.warn(`File ${filePath} is not recognized as XML, using generic XML processing`);
      }

      const blocks = this.parseXMLBlocks(content);
      const mergedBlocks = await this.mergeRelatedBlocks(blocks);
      const chunks = this.blocksToChunks(mergedBlocks, filePath);

      this.logger?.info(`XML chunking completed: ${blocks.length} blocks -> ${chunks.length} chunks`);
      return chunks;
    } catch (error) {
      this.logger?.error(`Error in XML chunking: ${error}`);
      // 降级到通用分段方法
      return this.fallbackChunking(content, filePath);
    }
  }

  /**
   * 解析 XML 块结构
   */
  private parseXMLBlocks(content: string): XMLBlock[] {
    const lines = content.split('\n');
    const blocks: XMLBlock[] = [];
    let currentBlock: XMLBlock | null = null;
    let elementStack: string[] = [];
    let inElement = false;
    let currentElementContent = '';
    let lineNumber = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // 确定块类型
      const blockType = getXMLBlockType(line, inElement, elementStack);

      // 处理元素嵌套
      if (isOpeningTag(trimmedLine) && !isSelfClosingTag(trimmedLine)) {
        const elementName = getElementName(trimmedLine);
        if (elementName) {
          elementStack.push(elementName);
          inElement = true;
        }
      } else if (isClosingTag(trimmedLine)) {
        const elementName = getElementName(trimmedLine);
        if (elementName && elementStack.length > 0 && elementStack[elementStack.length - 1] === elementName) {
          elementStack.pop();
          if (elementStack.length === 0) {
            inElement = false;
          }
        }
      }

      // 如果是空行，结束当前块（除非是元素内部）
      if (blockType === XMLBlockType.TEXT && !trimmedLine && !inElement) {
        if (currentBlock && currentBlock.content.trim().length > 0) {
          blocks.push(currentBlock);
          currentBlock = null;
        }
        lineNumber++;
        continue;
      }

      // 根据块类型和配置决定是否开始新块
      const shouldStartNewBlock = this.shouldStartNewBlock(blockType, currentBlock, line, i, lines, elementStack);

      if (shouldStartNewBlock) {
        if (currentBlock && currentBlock.content.trim().length > 0) {
          blocks.push(currentBlock);
        }
        currentBlock = {
          type: blockType,
          content: line,
          startLine: lineNumber,
          endLine: lineNumber,
          elementName: getElementName(trimmedLine),
          isSelfClosing: isSelfClosingTag(trimmedLine),
          attributes: this.extractAttributes(trimmedLine),
          elementStack: [...elementStack]
        };
      } else if (currentBlock) {
        // 继续当前块
        currentBlock.content += '\n' + line;
        currentBlock.endLine = lineNumber;
      } else {
        // 开始新块
        currentBlock = {
          type: blockType,
          content: line,
          startLine: lineNumber,
          endLine: lineNumber,
          elementName: getElementName(trimmedLine),
          isSelfClosing: isSelfClosingTag(trimmedLine),
          attributes: this.extractAttributes(trimmedLine),
          elementStack: [...elementStack]
        };
      }

      lineNumber++;
    }

    // 处理最后一个块
    if (currentBlock && currentBlock.content.trim().length > 0) {
      blocks.push(currentBlock);
    }

    return blocks;
  }

  /**
   * 判断是否开始新块
   */
  private shouldStartNewBlock(
    blockType: XMLBlockType,
    currentBlock: XMLBlock | null,
    line: string,
    lineIndex: number,
    allLines: string[],
    elementStack: string[]
  ): boolean {
    if (!currentBlock) return true;

    const currentType = currentBlock.type;

    // 特殊元素保持完整
    if (this.config.preserveComments && currentType === XMLBlockType.COMMENT) {
      return !isComment(line);
    }

    if (this.config.preserveCDATA && currentType === XMLBlockType.CDATA) {
      return !isCDATA(line);
    }

    if (this.config.preserveProcessingInstructions && currentType === XMLBlockType.PROCESSING_INSTRUCTION) {
      return !isProcessingInstruction(line);
    }

    // 根元素保持完整
    if (this.config.preserveRootElement && currentType === XMLBlockType.ROOT_ELEMENT) {
      return false;
    }

    // 复杂元素保持完整
    if (this.config.preserveComplexElements && this.isComplexElement(currentBlock)) {
      return false;
    }

    // 元素级别变化时开始新块
    if (blockType === XMLBlockType.ELEMENT && currentType === XMLBlockType.ELEMENT) {
      const currentLevel = currentBlock.elementStack.length;
      const newLevel = elementStack.length;

      // 同级或更高级别的元素开始新块
      if (newLevel <= currentLevel) {
        return true;
      }
    }

    // 不同块类型通常开始新块
    if (blockType !== currentType) {
      // 如果当前块太小，考虑不开始新块，让合并逻辑处理
      const currentSize = currentBlock.content.length;
      if (currentSize < this.config.minChunkSize) {
        return false;
      }
      return true;
    }

    // 同类型块的合并策略
    switch (blockType) {
      case XMLBlockType.ELEMENT:
        // 检查是否到达元素大小限制
        const currentSize = currentBlock.content.length;
        return currentSize > this.config.maxChunkSize * 0.8;

      case XMLBlockType.TEXT:
        // 文本内容可以合并，但不要太长
        const textSize = currentBlock.content.length;
        return textSize > this.config.maxChunkSize * 0.6;

      default:
        return false;
    }
  }

  /**
   * 合并相关块
   */
  private async mergeRelatedBlocks(blocks: XMLBlock[]): Promise<XMLBlock[]> {
    if (blocks.length === 0) return blocks;

    let currentBlocks = [...blocks];
    let merged = false;

    // 迭代合并直到没有更多块可以合并
    do {
      merged = false;
      const newBlocks: XMLBlock[] = [];
      let i = 0;

      while (i < currentBlocks.length) {
        if (i < currentBlocks.length - 1) {
          const currentBlock = currentBlocks[i];
          const nextBlock = currentBlocks[i + 1];

          // 检查是否可以合并当前块和下一个块
          if (await this.shouldMergeBlocks(currentBlock, nextBlock)) {
            // 合并块
            const mergedBlock: XMLBlock = {
              type: this.determineMergedBlockType(currentBlock, nextBlock),
              content: currentBlock.content + '\n' + nextBlock.content,
              startLine: currentBlock.startLine,
              endLine: nextBlock.endLine,
              elementName: currentBlock.elementName || nextBlock.elementName,
              isSelfClosing: currentBlock.isSelfClosing && nextBlock.isSelfClosing,
              attributes: { ...currentBlock.attributes, ...nextBlock.attributes },
              elementStack: currentBlock.elementStack.length > nextBlock.elementStack.length ?
                currentBlock.elementStack : nextBlock.elementStack
            };

            newBlocks.push(mergedBlock);
            i += 2; // 跳过下一个块，因为它已经被合并
            merged = true;
          } else {
            newBlocks.push(currentBlock);
            i++;
          }
        } else {
          // 最后一个块，无法合并，直接添加
          newBlocks.push(currentBlocks[i]);
          i++;
        }
      }

      currentBlocks = newBlocks;
    } while (merged); // 继续合并直到没有更多合并发生

    return currentBlocks;
  }

  /**
   * 确定合并后块的类型
   */
  private determineMergedBlockType(currentBlock: XMLBlock, nextBlock: XMLBlock): XMLBlockType {
    // 如果任一块是特殊类型，优先保留这些类型
    if (currentBlock.type === XMLBlockType.ROOT_ELEMENT || nextBlock.type === XMLBlockType.ROOT_ELEMENT) {
      return XMLBlockType.ROOT_ELEMENT;
    }
    if (currentBlock.type === XMLBlockType.XML_DECLARATION || nextBlock.type === XMLBlockType.XML_DECLARATION) {
      return XMLBlockType.XML_DECLARATION;
    }
    if (currentBlock.type === XMLBlockType.DOCTYPE || nextBlock.type === XMLBlockType.DOCTYPE) {
      return XMLBlockType.DOCTYPE;
    }
    // 否则使用当前块的类型
    return currentBlock.type;
  }

  /**
   * 判断是否应该合并块
   */
  private async shouldMergeBlocks(
    currentBlock: XMLBlock,
    nextBlock: XMLBlock
  ): Promise<boolean> {
    const currentType = currentBlock.type;
    const nextType = nextBlock.type;

    const currentSize = currentBlock.content.length;
    const nextSize = nextBlock.content.length;
    const totalSize = currentSize + nextSize;

    // 大小限制检查
    if (totalSize > this.config.maxChunkSize) return false;
    if (currentBlock.endLine - currentBlock.startLine + 1 +
      nextBlock.endLine - nextBlock.startLine + 1 > this.config.maxLinesPerChunk) return false;

    // 短元素合并
    if (this.config.mergeShortElements &&
      currentType === XMLBlockType.ELEMENT &&
      nextType === XMLBlockType.ELEMENT &&
      currentSize < this.config.minChunkSize) {
      return true;
    }

    // 兄弟元素合并
    if (this.config.mergeSiblingElements &&
      currentType === XMLBlockType.ELEMENT &&
      nextType === XMLBlockType.ELEMENT &&
      this.areSiblingElements(currentBlock, nextBlock)) {
      return true;
    }

    // 嵌套元素合并
    if (this.config.mergeNestedElements &&
      currentType === XMLBlockType.ELEMENT &&
      nextType === XMLBlockType.ELEMENT &&
      this.areNestedElements(currentBlock, nextBlock)) {
      return true;
    }

    // 特殊元素保持完整
    if (this.config.preserveComments && currentType === XMLBlockType.COMMENT) return false;
    if (this.config.preserveCDATA && currentType === XMLBlockType.CDATA) return false;
    if (this.config.preserveProcessingInstructions && currentType === XMLBlockType.PROCESSING_INSTRUCTION) return false;

    // 语义相似性合并
    if (this.config.enableSemanticMerge &&
      currentType === XMLBlockType.ELEMENT &&
      nextType === XMLBlockType.ELEMENT) {
      const similarity = await this.calculateXMLSemanticSimilarity(currentBlock.content, nextBlock.content);
      return similarity >= this.config.semanticSimilarityThreshold;
    }

    // 如果当前块太小，合并到下一个块
    if (currentSize < this.config.minChunkSize) {
      return true;
    }

    return false;
  }

  /**
   * 判断是否为复杂元素
   */
  private isComplexElement(block: XMLBlock): boolean {
    // 基于元素内容复杂度判断
    const content = block.content;

    // 检查是否有多个子元素
    const openingTags = content.match(XML_PATTERNS.OPENING_TAG);
    const closingTags = content.match(XML_PATTERNS.CLOSING_TAG);

    if (openingTags && closingTags && openingTags.length > 2) {
      return true;
    }

    // 检查是否有大量属性
    const attributes = content.match(XML_PATTERNS.ATTRIBUTE);
    if (attributes && attributes.length > 5) {
      return true;
    }

    // 检查内容长度
    if (content.length > this.config.maxChunkSize * 0.5) {
      return true;
    }

    return false;
  }

  /**
   * 判断是否为兄弟元素
   */
  private areSiblingElements(block1: XMLBlock, block2: XMLBlock): boolean {
    // 检查元素栈是否相同（在同一层级）
    if (block1.elementStack.length !== block2.elementStack.length) {
      return false;
    }

    // 检查父元素是否相同
    for (let i = 0; i < block1.elementStack.length; i++) {
      if (block1.elementStack[i] !== block2.elementStack[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * 判断是否为嵌套元素
   */
  private areNestedElements(block1: XMLBlock, block2: XMLBlock): boolean {
    // 检查 block1 是否是 block2 的父元素
    if (block1.elementStack.length >= block2.elementStack.length) {
      return false;
    }

    // 检查 block1 的元素栈是否是 block2 的前缀
    for (let i = 0; i < block1.elementStack.length; i++) {
      if (block1.elementStack[i] !== block2.elementStack[i]) {
        return false;
      }
    }

    return true;
  }

  /**
   * 提取属性
   */
  private extractAttributes(element: string): Record<string, string> {
    const attributes: Record<string, string> = {};
    const matches = element.match(XML_PATTERNS.ATTRIBUTE);

    if (matches) {
      matches.forEach(attr => {
        const match = attr.match(/\s([a-zA-Z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/);
        if (match) {
          const attrName = match[1];
          const attrValue = match[2].replace(/^["']|["']$/g, ''); // 移除引号
          attributes[attrName] = attrValue;
        }
      });
    }

    return attributes;
  }

  /**
   * 将块转换为分段
   */
  private blocksToChunks(blocks: XMLBlock[], filePath?: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    for (const block of blocks) {
      const complexity = this.calculateBlockComplexity(block);

      // 将 XMLBlockType 映射到 CodeChunkMetadata 的 type
      const chunkType = this.mapXMLTypeToChunkType(block.type);

      const metadata: ChunkMetadata = {
        startLine: block.startLine,
        endLine: block.endLine,
        language: 'xml',
        filePath,
        strategy: 'xml-strategy',
        timestamp: Date.now(),
        type: chunkType,
        size: block.content.length,
        lineCount: block.endLine - block.startLine + 1,
        complexity,
        elementName: block.elementName,
        attributes: block.attributes
      };

      chunks.push({
        content: block.content,
        metadata
      });
    }

    return chunks;
  }

  /**
   * 将 XML 块类型映射到 CodeChunk 类型
   */
  private mapXMLTypeToChunkType(xmlType: XMLBlockType): ChunkType {
    const typeMap: Record<XMLBlockType, ChunkType> = {
      [XMLBlockType.XML_DECLARATION]: ChunkType.GENERIC,
      [XMLBlockType.DOCTYPE]: ChunkType.GENERIC,
      [XMLBlockType.ROOT_ELEMENT]: ChunkType.GENERIC,
      [XMLBlockType.ELEMENT]: ChunkType.GENERIC,
      [XMLBlockType.SELF_CLOSING_ELEMENT]: ChunkType.GENERIC,
      [XMLBlockType.EMPTY_ELEMENT]: ChunkType.GENERIC,
      [XMLBlockType.PROCESSING_INSTRUCTION]: ChunkType.GENERIC,
      [XMLBlockType.COMMENT]: ChunkType.COMMENT,
      [XMLBlockType.CDATA]: ChunkType.GENERIC,
      [XMLBlockType.TEXT]: ChunkType.GENERIC
    };

    return typeMap[xmlType] || ChunkType.GENERIC;
  }

  /**
   * 计算块复杂度
   */
  private calculateBlockComplexity(block: XMLBlock): number {
    let complexity = XML_SEMANTIC_WEIGHTS[block.type] || 1;

    // 基于内容长度调整
    const contentLength = block.content.length;
    complexity += Math.log10(contentLength + 1);

    // 基于元素嵌套深度调整
    const nestingDepth = block.elementStack.length;
    complexity += nestingDepth * 2;

    // 基于属性数量调整
    const attributeCount = Object.keys(block.attributes).length;
    complexity += attributeCount;

    // 特殊元素加分
    if (block.type === XMLBlockType.ELEMENT && block.elementName) {
      // 常见元素降低复杂度
      if (this.isCommonElement(block.elementName)) {
        complexity -= 1;
      }
    }

    return Math.round(Math.max(1, complexity));
  }

  /**
   * 判断是否为常见元素
   */
  private isCommonElement(elementName: string): boolean {
    const commonElements = [
      'xml', 'root', 'config', 'configuration', 'settings', 'data',
      'item', 'entry', 'element', 'node', 'property', 'attribute',
      'header', 'body', 'footer', 'content', 'text', 'value',
      'name', 'id', 'type', 'class', 'style', 'href', 'src'
    ];

    return commonElements.includes(elementName.toLowerCase());
  }

  /**
   * 降级分段方法
   */
  private fallbackChunking(content: string, filePath?: string): CodeChunk[] {
    this.logger?.warn('Using fallback chunking for XML');

    // 简单的元素分段
    const elements = this.extractElements(content);
    const chunks: CodeChunk[] = [];
    let lineNumber = 1;

    for (const element of elements) {
      const lines = element.split('\n');
      const complexity = this.calculateFallbackComplexity(element);

      chunks.push({
        content: element,
        metadata: {
          startLine: lineNumber,
          endLine: lineNumber + lines.length - 1,
          language: 'xml',
          filePath: filePath,
          strategy: 'xml-strategy',
          timestamp: Date.now(),
          type: ChunkType.GENERIC,
          size: element.length,
          lineCount: lines.length,
          complexity
        }
      });

      lineNumber += lines.length;
    }

    return chunks;
  }

  /**
   * 提取元素（降级方法）
   */
  private extractElements(content: string): string[] {
    const elements: string[] = [];
    const lines = content.split('\n');
    let currentElement = '';
    let inElement = false;
    let elementStack = 0;

    for (const line of lines) {
      const trimmedLine = line.trim();

      if (isOpeningTag(trimmedLine) && !isSelfClosingTag(trimmedLine)) {
        elementStack++;
        inElement = true;
      }

      if (inElement) {
        currentElement += line + '\n';
      }

      if (isClosingTag(trimmedLine)) {
        elementStack--;
        if (elementStack === 0) {
          inElement = false;
          if (currentElement.trim()) {
            elements.push(currentElement.trim());
          }
          currentElement = '';
        }
      }

      if (!inElement && trimmedLine && !isOpeningTag(trimmedLine) && !isClosingTag(trimmedLine)) {
        // 非元素内容（如注释、处理指令等）
        if (trimmedLine) {
          elements.push(trimmedLine);
        }
      }
    }

    // 处理剩余内容
    if (currentElement.trim()) {
      elements.push(currentElement.trim());
    }

    return elements;
  }

  /**
   * 计算降级分段的复杂度
   */
  private calculateFallbackComplexity(content: string): number {
    let complexity = 1;

    // 基于长度
    complexity += Math.log10(content.length + 1);

    // 基于标签数量
    const tagMatches = content.match(XML_PATTERNS.OPENING_TAG);
    if (tagMatches) {
      complexity += tagMatches.length * 2;
    }

    // 基于属性数量
    const attrMatches = content.match(XML_PATTERNS.ATTRIBUTE);
    if (attrMatches) {
      complexity += attrMatches.length;
    }

    return Math.round(complexity);
  }

  /**
   * 计算XML语义相似度（使用新的相似度服务）
   */
  private async calculateXMLSemanticSimilarity(xml1: string, xml2: string): Promise<number> {
    try {
      // 使用新的相似度服务，指定文档类型
      const similarityUtils = SimilarityUtils.getInstance();
      if (!similarityUtils) {
        throw new Error('SimilarityUtils instance not available. Please ensure it has been properly initialized.');
      }
      return await similarityUtils.calculateSimilarity(xml1, xml2, {
        contentType: 'document',
        strategy: 'keyword' // 对于XML，使用关键词策略更合适
      });
    } catch (error) {
      // 如果新服务失败，回退到原始实现
      this.logger?.warn('Failed to use new similarity service, falling back to original implementation:', error);
      return calculateXMLSemanticSimilarity(xml1, xml2);
    }
  }
}

/**
 * XML 块结构
 */
interface XMLBlock {
  type: XMLBlockType;
  content: string;
  startLine: number;
  endLine: number;
  elementName?: string;
  isSelfClosing?: boolean;
  attributes: Record<string, string>;
  elementStack: string[];
}