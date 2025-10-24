import { injectable, inject } from 'inversify';
import { ISegmentationProcessor, SegmentationContext } from '../types/SegmentationTypes';
import { CodeChunk } from '../../splitting';
import { TYPES } from '../../../../types';
import { LoggerService } from '../../../../utils/LoggerService';
import { BLOCK_SIZE_LIMITS } from '../constants';

/**
 * 块过滤器
 * 职责：过滤掉小于最小块大小的无意义片段
 */
@injectable()
export class ChunkFilter implements ISegmentationProcessor {
  private logger?: LoggerService;
  
  constructor(@inject(TYPES.LoggerService) logger?: LoggerService) {
    this.logger = logger;
  }
  
  async process(chunks: CodeChunk[], context: SegmentationContext): Promise<CodeChunk[]> {
    if (!context.options.filterConfig.enableSmallChunkFilter) {
      return chunks;
    }
    
    const result: CodeChunk[] = [];
    const minChunkSize = context.options.filterConfig.minChunkSize;
    
    // 处理每个块
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkSize = chunk.content.length;
      
      // 如果块大小足够，直接添加
      if (chunkSize >= minChunkSize) {
        result.push(chunk);
        continue;
      }
      
      // 对于小块，检查是否应该被过滤
      // 使用更严格的阈值来确定哪些小块需要被过滤
      const verySmallThreshold = Math.min(minChunkSize * 0.3, 15); // 最多15个字符或minChunkSize的30%
      
      // 检查是否是"正常大小"的块（基于内容特征）
      const isNormalSized = chunkSize >= 20 || // 长度大于等于20
                           chunk.content.includes(' ') || // 包含空格（可能是句子）
                           chunkSize >= 12; // 长度大于等于12
      
      
      
      if (isNormalSized) {
        // 虽然小于minChunkSize，但基于内容特征认为是正常大小
        result.push(chunk);
        continue;
      }
      
      // 处理非常小的块
      const hasPrevChunk = result.length > 0;
      const hasNextChunk = i < chunks.length - 1;
      
      // 检查下一个块是否是正常大小的块
      const nextChunkIsNormalSized = hasNextChunk && (() => {
        const nextChunk = chunks[i + 1];
        const nextChunkSize = nextChunk.content.length;
        return nextChunkSize >= 20 || 
               nextChunk.content.includes(' ') || 
               nextChunkSize >= 12;
      })();
      
      if (hasPrevChunk && hasNextChunk && nextChunkIsNormalSized) {
        // 只有当小块位于两个正常大小的块之间时，才合并到前一个块
        const prevChunk = result[result.length - 1];
        prevChunk.content += '\n' + chunk.content;
        prevChunk.metadata.endLine = chunk.metadata.endLine;
        this.logger?.debug(`Merged small chunk (${chunkSize} chars) into previous chunk`);
      } else if (hasNextChunk && nextChunkIsNormalSized) {
        // 合并到后一个块
        const nextChunk = chunks[i + 1];
        const mergedChunk = {
          content: chunk.content + '\n' + nextChunk.content,
          metadata: {
            ...nextChunk.metadata,
            startLine: chunk.metadata.startLine
          }
        };
        result.push(mergedChunk);
        this.logger?.debug(`Merged small chunk (${chunkSize} chars) into next chunk`);
        i++; // 跳过下一个块，因为已经合并了
      } else {
        // 孤立的小块，丢弃
        this.logger?.warn(`Discarded small chunk (${chunkSize} chars): ${chunk.content.substring(0, 50)}...`);
      }
    }

    this.logger?.debug(`Filtered ${chunks.length} chunks to ${result.length} valid chunks`);
    return result;
  }
  
  getName(): string {
    return 'chunk-filter';
  }
  
  shouldApply(chunks: CodeChunk[], context: SegmentationContext): boolean {
    if (!context.options.filterConfig.enableSmallChunkFilter || chunks.length === 0) {
      return false;
    }
    
    // 检查是否有需要过滤的小块
    return chunks.some(chunk => {
      const chunkSize = chunk.content.length;
      const minChunkSize = context.options.filterConfig.minChunkSize;
      
      // 检查是否是"正常大小"的块（基于内容特征）
      const isNormalSized = chunkSize >= 20 || // 长度大于等于20
                           chunk.content.includes(' ') || // 包含空格（可能是句子）
                           chunkSize >= 12; // 长度大于等于12
      
      // 如果不是正常大小且小于minChunkSize，则需要过滤
      return !isNormalSized && chunkSize < minChunkSize;
    });
  }
  
  /**
   * 高级过滤：基于内容质量的过滤
   */
  async advancedFilter(chunks: CodeChunk[], context: SegmentationContext): Promise<CodeChunk[]> {
    const filteredChunks: CodeChunk[] = [];
    
    for (const chunk of chunks) {
      if (this.isHighQualityChunk(chunk, context)) {
        filteredChunks.push(chunk);
      } else {
        this.logger?.debug(`Filtered low-quality chunk: ${chunk.content.substring(0, 50)}...`);
      }
    }
    
    return filteredChunks;
  }
  
  /**
   * 判断是否为高质量分块
   */
  private isHighQualityChunk(chunk: CodeChunk, context: SegmentationContext): boolean {
    const content = chunk.content.trim();
    
    // 基本长度检查 - 恢复最小长度要求，但使用更宽松的阈值
    const minChunkSize = context.options.filterConfig.minChunkSize;
    const verySmallThreshold = Math.min(minChunkSize * 0.3, 15); // 与process方法保持一致
    
    if (content.length < verySmallThreshold) {
      return false;
    }
    
    // 内容质量检查
    const qualityScore = this.calculateContentQuality(content, chunk.metadata.language);
    return qualityScore >= 0.1; // 降低质量阈值，使简单函数也能通过
  }
  
  /**
   * 计算内容质量分数
   */
  private calculateContentQuality(content: string, language?: string): number {
    let score = 0;
    const lines = content.split('\n');
    
    // 基础分数：基于行数
    score += Math.min(lines.length / 10, 0.3); // 最多0.3分
    
    // 代码结构分数
    if (language && language !== 'markdown') {
      // 函数/类定义
      const functionMatches = content.match(/\b(function|class|def|interface|struct)\b/g);
      if (functionMatches) {
        score += Math.min(functionMatches.length * 0.1, 0.2);
      }
      
      // 控制结构
      const controlMatches = content.match(/\b(if|else|while|for|switch|case|try|catch)\b/g);
      if (controlMatches) {
        score += Math.min(controlMatches.length * 0.05, 0.2);
      }
      
      // 变量声明
      const variableMatches = content.match(/\b(let|const|var|int|string|bool|float|double)\b/g);
      if (variableMatches) {
        score += Math.min(variableMatches.length * 0.03, 0.1);
      }
    } else {
      // Markdown特定评分
      const headers = content.match(/^#{1,6}\s+/gm);
      if (headers) {
        score += Math.min(headers.length * 0.1, 0.2);
      }
      
      const codeBlocks = content.match(/```[\s\S]*?```/g);
      if (codeBlocks) {
        score += Math.min(codeBlocks.length * 0.15, 0.3);
      }
      
      const lists = content.match(/^[-*+]\s+/gm);
      if (lists) {
        score += Math.min(lists.length * 0.05, 0.1);
      }
    }
    
    // 惩罚分数：过多的空行或注释
    const emptyLines = lines.filter(line => line.trim() === '').length;
    const commentLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed.startsWith('//') || trimmed.startsWith('#') || 
             trimmed.startsWith('/*') || trimmed.startsWith('*') || trimmed.startsWith('<!--');
    }).length;
    
    const totalLines = lines.length;
    const emptyRatio = emptyLines / totalLines;
    const commentRatio = commentLines / totalLines;
    
    // 如果空行或注释比例过高，降低分数
    if (emptyRatio > 0.5) {
      score -= 0.2;
    }
    
    if (commentRatio > 0.8) {
      score -= 0.3;
    }
    
    return Math.max(0, Math.min(1, score));
  }
  
  /**
   * 智能合并：基于内容相似性合并小块
   */
  async intelligentMerge(chunks: CodeChunk[], context: SegmentationContext): Promise<CodeChunk[]> {
    if (chunks.length <= 1) {
      return chunks;
    }
    
    const mergedChunks: CodeChunk[] = [];
    let currentGroup: CodeChunk[] = [chunks[0]];
    
    for (let i = 1; i < chunks.length; i++) {
      const currentChunk = chunks[i];
      const lastChunk = currentGroup[currentGroup.length - 1];
      
      // 计算相似性
      const similarity = this.calculateSimilarity(lastChunk, currentChunk);
      const combinedSize = this.calculateGroupSize(currentGroup) + currentChunk.content.length;
      
      // 如果相似性高且合并后大小不超过限制，则合并
      if (similarity > 0.6 && combinedSize < context.options.filterConfig.maxChunkSize) {
        currentGroup.push(currentChunk);
      } else {
        // 完成当前组，开始新组
        mergedChunks.push(this.mergeChunkGroup(currentGroup));
        currentGroup = [currentChunk];
      }
    }
    
    // 处理最后一组
    if (currentGroup.length > 0) {
      mergedChunks.push(this.mergeChunkGroup(currentGroup));
    }
    
    this.logger?.debug(`Intelligently merged ${chunks.length} chunks into ${mergedChunks.length} groups`);
    return mergedChunks;
  }
  
  /**
   * 计算两个分块的相似性
   */
  private calculateSimilarity(chunk1: CodeChunk, chunk2: CodeChunk): number {
    // 基于类型相似性
    const typeSimilarity = chunk1.metadata.type === chunk2.metadata.type ? 0.5 : 0;
    
    // 基于语言相似性
    const languageSimilarity = chunk1.metadata.language === chunk2.metadata.language ? 0.3 : 0;
    
    // 基于内容相似性（简单的词汇重叠）
    const contentSimilarity = this.calculateContentSimilarity(chunk1.content, chunk2.content);
    
    return typeSimilarity + languageSimilarity + contentSimilarity;
  }
  
  /**
   * 计算内容相似性
   */
  private calculateContentSimilarity(content1: string, content2: string): number {
    const words1 = this.extractKeywords(content1);
    const words2 = this.extractKeywords(content2);
    
    if (words1.length === 0 || words2.length === 0) {
      return 0;
    }
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }
  
  /**
   * 提取关键词
   */
  private extractKeywords(content: string): string[] {
    // 简单的关键词提取，移除常见停用词
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);
    
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 20); // 限制关键词数量
  }
  
  /**
   * 计算组的大小
   */
  private calculateGroupSize(group: CodeChunk[]): number {
    return group.reduce((total, chunk) => total + chunk.content.length, 0);
  }
  
  /**
   * 合并分块组
   */
  private mergeChunkGroup(group: CodeChunk[]): CodeChunk {
    if (group.length === 1) {
      return group[0];
    }
    
    const firstChunk = group[0];
    const lastChunk = group[group.length - 1];
    
    return {
      content: group.map(chunk => chunk.content).join('\n\n'),
      metadata: {
        startLine: firstChunk.metadata.startLine,
        endLine: lastChunk.metadata.endLine,
        language: firstChunk.metadata.language,
        filePath: firstChunk.metadata.filePath,
        type: firstChunk.metadata.type,
        complexity: group.reduce((sum, chunk) => sum + (chunk.metadata.complexity || 0), 0)
      }
    };
  }
  
  /**
   * 设置过滤配置
   */
  setFilterConfig(config: {
    enableSmallChunkFilter?: boolean;
    minChunkSize?: number;
    maxChunkSize?: number;
    enableIntelligentMerge?: boolean;
  }): void {
    this.logger?.debug('Filter configuration updated', config);
  }
}