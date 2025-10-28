import { ISplitStrategy, IOverlapCalculator } from '../../../interfaces/CoreISplitStrategy';
import { CodeChunk, ChunkingOptions } from '../../../types';

/**
 * 重叠装饰器 - 使用装饰器模式添加重叠功能
 */
export class OverlapDecorator implements ISplitStrategy {
  constructor(
    private strategy: ISplitStrategy,
    private overlapCalculator: IOverlapCalculator
  ) { }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]> {
    // 首先执行基础分割策略
    const chunks = await this.strategy.split(content, language, filePath, options, nodeTracker, ast);

    // 如果没有块或只有一个块，不需要重叠
    if (chunks.length <= 1) {
      return chunks;
    }

    // 检查是否为代码文件（非markdown）
    const isCodeFile = this.isCodeFile(language, filePath);

    // 代码文件：只有在块大小超过限制时才使用重叠
    if (isCodeFile) {
      // 检查是否有块超过最大大小限制
      const hasOversizedChunks = chunks.some(chunk => {
        const maxSize = options?.maxChunkSize || 2000;
        return chunk.content.length > maxSize;
      });

      // 如果有超大块，需要应用重叠策略进行重新处理
      if (hasOversizedChunks) {
        return this.overlapCalculator.addOverlap(chunks, content);
      }

      // 否则返回原始块（无重叠）
      return chunks;
    }

    // 非代码文件：添加重叠内容
    return this.overlapCalculator.addOverlap(chunks, content);
  }

  getName(): string {
    return `${this.strategy.getName()}_with_overlap`;
  }

  supportsLanguage(language: string): boolean {
    return this.strategy.supportsLanguage(language);
  }



  getDescription(): string {
    return `Overlap decorator for ${this.strategy.getDescription?.() || this.strategy.getName()}`;
  }

  extractNodesFromChunk(chunk: CodeChunk, ast: any): any[] {
    if (this.strategy.extractNodesFromChunk) {
      return this.strategy.extractNodesFromChunk(chunk, ast);
    }
    return [];
  }

  hasUsedNodes(chunk: CodeChunk, nodeTracker: any, ast: any): boolean {
    if (this.strategy.hasUsedNodes) {
      return this.strategy.hasUsedNodes(chunk, nodeTracker, ast);
    }
    return false;
  }

  /**
   * 检查是否为代码文件（非markdown）
   */
  private isCodeFile(language?: string, filePath?: string): boolean {
    if (language === 'markdown' || (filePath && filePath.endsWith('.md'))) {
      return false;
    }
    // 检查是否在代码语言列表中
    const codeLanguages = ['javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
      'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'shell',
      'html', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'json',
      'xml', 'yaml', 'sql', 'dockerfile', 'cmake', 'perl', 'r', 'matlab',
      'lua', 'dart', 'elixir', 'erlang', 'haskell', 'ocaml', 'fsharp',
      'visualbasic', 'powershell', 'batch'];

    return language ? codeLanguages.includes(language) : false;
  }
}