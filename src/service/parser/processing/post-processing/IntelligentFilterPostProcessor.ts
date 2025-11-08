import { CodeChunk } from '../types/CodeChunk';
import { IChunkPostProcessor, PostProcessingContext } from './IChunkPostProcessor';
import { ChunkFilter } from '../utils/chunking/ChunkFilter';
import { LoggerService } from '../../../../utils/LoggerService';

/**
 * 智能过滤后处理器
 * 使用ChunkFilter的高级过滤逻辑来移除无意义的小块并智能合并相邻块
 */
export class IntelligentFilterPostProcessor implements IChunkPostProcessor {
  private chunkFilter: ChunkFilter;
  private logger?: LoggerService;

  constructor(logger?: LoggerService) {
    this.chunkFilter = new ChunkFilter();
    this.logger = logger;
  }

  getName(): string {
    return 'intelligent-filter-post-processor';
  }

  shouldApply(chunks: CodeChunk[], context: PostProcessingContext): boolean {
    // 只在启用智能过滤时应用
    return context.options.advanced?.enableIntelligentFiltering === true && chunks.length > 0;
  }

  async process(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]> {
    if (!this.shouldApply(chunks, context)) {
      return chunks;
    }

    this.logger?.debug(`Applying intelligent filter post-processing to ${chunks.length} chunks`);

    // 创建ChunkFilter需要的上下文格式
    const filterContext: any = {
      options: {
        filterConfig: {
          enableSmallChunkFilter: true,
          minChunkSize: context.options.advanced?.minChunkSizeThreshold || context.options.basic?.minChunkSize || 100,
          maxChunkSize: context.options.advanced?.maxChunkSizeThreshold || context.options.basic?.maxChunkSize || 1000
        }
      },
      metadata: {
        isCodeFile: this.isCodeFile(context.language),
        language: context.language
      }
    };

    // 使用ChunkFilter的智能过滤功能
    const filteredChunks = await this.chunkFilter.process(chunks, filterContext);

    // 如果启用了高级合并，应用智能合并
    if (context.options.advanced?.enableIntelligentFiltering) {
      const mergedChunks = await this.chunkFilter.intelligentMerge(filteredChunks, filterContext);
      this.logger?.debug(`Intelligent filter: ${chunks.length} -> ${filteredChunks.length} -> ${mergedChunks.length} chunks`);
      return mergedChunks;
    }

    this.logger?.debug(`Intelligent filter: ${chunks.length} -> ${filteredChunks.length} chunks`);
    return filteredChunks;
  }

  /**
   * 判断是否为代码文件
   */
  private isCodeFile(language: string): boolean {
    const codeLanguages = [
      'javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'c++',
      'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin',
      'scala', 'haskell', 'lua', 'perl', 'r', 'matlab', 'sql',
      'html', 'css', 'scss', 'sass', 'less', 'xml', 'json',
      'yaml', 'yml', 'toml', 'ini', 'dockerfile', 'shell',
      'bash', 'zsh', 'fish', 'powershell', 'batch'
    ];
    
    return codeLanguages.includes(language?.toLowerCase() || '');
  }

  /**
   * 高级质量评估
   */
  private async advancedQualityAssessment(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]> {
    const highQualityChunks: CodeChunk[] = [];

    for (const chunk of chunks) {
      if (this.isHighQualityChunk(chunk, context)) {
        highQualityChunks.push(chunk);
      } else {
        this.logger?.debug(`Filtered low-quality chunk: ${chunk.content.substring(0, 50)}...`);
      }
    }

    return highQualityChunks;
  }

  /**
   * 判断是否为高质量分块
   */
  private isHighQualityChunk(chunk: CodeChunk, context: PostProcessingContext): boolean {
    const content = chunk.content.trim();
    const minChunkSize = context.options.advanced?.minChunkSizeThreshold || context.options.basic?.minChunkSize || 100;
    const verySmallThreshold = Math.min(minChunkSize * 0.3, 15);

    // 基本长度检查
    if (content.length < verySmallThreshold) {
      return false;
    }

    // 内容质量检查
    const qualityScore = this.calculateContentQuality(content, context.language);
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
}