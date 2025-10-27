import { CodeChunk } from '../types/splitting-types';
import { IChunkPostProcessor, PostProcessingContext } from './IChunkPostProcessor';
import { BalancedChunker } from '../utils/chunking/BalancedChunker';
import { LoggerService } from '../../../utils/LoggerService';

/**
 * 符号平衡后处理器
 * 使用BalancedChunker算法来确保代码块在语法上是完整的
 */
export class SymbolBalancePostProcessor implements IChunkPostProcessor {
  private balancedChunker: BalancedChunker;
  private logger?: LoggerService;

  constructor(logger?: LoggerService) {
    this.balancedChunker = new BalancedChunker(logger);
    this.logger = logger;
  }

  getName(): string {
    return 'symbol-balance-post-processor';
  }

  shouldApply(chunks: CodeChunk[], context: PostProcessingContext): boolean {
    // 只在启用增强平衡时应用
    return context.options.enableEnhancedBalancing === true && chunks.length > 0;
  }

  async process(chunks: CodeChunk[], context: PostProcessingContext): Promise<CodeChunk[]> {
    if (!this.shouldApply(chunks, context)) {
      return chunks;
    }

    this.logger?.debug(`Applying symbol balance post-processing to ${chunks.length} chunks`);

    const balancedChunks: CodeChunk[] = [];

    for (const chunk of chunks) {
      const balancedChunk = await this.balanceChunk(chunk, context);
      balancedChunks.push(balancedChunk);
    }

    this.logger?.debug(`Symbol balance post-processing completed`);
    return balancedChunks;
  }

  private async balanceChunk(chunk: CodeChunk, context: PostProcessingContext): Promise<CodeChunk> {
    // 重置并分析代码块的符号平衡
    this.balancedChunker.reset();
    const lines = chunk.content.split('\n');
    
    // 分析每一行的符号变化
    for (const line of lines) {
      this.balancedChunker.analyzeLineSymbols(line);
    }

    // 检查代码块是否符号平衡
    const isBalanced = this.balancedChunker.canSafelySplit();
    
    if (!isBalanced) {
      // 如果代码块符号不平衡，尝试扩展内容以达到平衡
      const balancedContent = this.extendForBalance(chunk, context);
      if (balancedContent !== chunk.content) {
        this.logger?.debug(`Adjusted chunk for symbol balance`);
        return {
          ...chunk,
          content: balancedContent
        };
      }
    }

    return chunk;
 }

  private extendForBalance(chunk: CodeChunk, context: PostProcessingContext): string {
    // 这里实现扩展逻辑以达到符号平衡
    // 通过查看原始内容来扩展当前块，使其语法上完整
    const originalLines = context.originalContent.split('\n');
    const chunkStartLine = chunk.metadata.startLine - 1; // 转换为0基索引
    const chunkEndLine = chunk.metadata.endLine - 1; // 转换为0基索引

    let currentContent = chunk.content;
    let currentEndLine = chunkEndLine;
    
    // 重置并分析当前内容
    this.balancedChunker.reset();
    const initialLines = currentContent.split('\n');
    for (const line of initialLines) {
      this.balancedChunker.analyzeLineSymbols(line);
    }

    // 检查是否平衡，如果不平衡则尝试添加更多行
    while (!this.balancedChunker.canSafelySplit() && currentEndLine + 1 < originalLines.length) {
      currentEndLine++;
      const additionalLine = originalLines[currentEndLine];
      currentContent += '\n' + additionalLine;
      
      // 分析新增的行
      this.balancedChunker.analyzeLineSymbols(additionalLine);
      
      // 检查大小限制
      if (currentContent.length > context.options.maxChunkSize) {
        // 如果超过大小限制，则回退到平衡状态检查
        break;
      }
    }

    return currentContent;
  }
}