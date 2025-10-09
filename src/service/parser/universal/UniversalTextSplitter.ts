import { injectable } from 'inversify';
import { CodeChunk, CodeChunkMetadata } from '../splitting/Splitter';
import { LoggerService } from '../../../utils/LoggerService';

/**
 * 通用分段选项
 */
export interface UniversalChunkingOptions {
  maxChunkSize: number;        // 最大块大小
  overlapSize: number;         // 重叠大小
  maxLinesPerChunk: number;    // 每块最大行数
  errorThreshold: number;      // 错误阈值
  memoryLimitMB: number;       // 内存限制(MB)
  enableBracketBalance: boolean; // 启用括号平衡检测
  enableSemanticDetection: boolean; // 启用语义检测
}

/**
 * 通用文本分段器
 * 提供多种分段策略，适用于各种文件类型和内容
 */
@injectable()
export class UniversalTextSplitter {
  private options: UniversalChunkingOptions;
  private logger?: LoggerService;

  constructor(logger?: LoggerService) {
    this.logger = logger;
    this.options = {
      maxChunkSize: 2000,
      overlapSize: 200,
      maxLinesPerChunk: 50,
      errorThreshold: 5,
      memoryLimitMB: 500,
      enableBracketBalance: true,
      enableSemanticDetection: true
    };
  }

  /**
   * 设置分段选项
   */
  setOptions(options: Partial<UniversalChunkingOptions>): void {
    this.options = { ...this.options, ...options };
  }

  /**
   * 基于语义边界的分段
   * 优先在逻辑边界处分段，如函数、类、代码块等
   */
  chunkBySemanticBoundaries(content: string, filePath?: string, language?: string): CodeChunk[] {
    try {
      const chunks: CodeChunk[] = [];
      const lines = content.split('\n');
      let currentChunk: string[] = [];
      let currentLine = 1;
      let semanticScore = 0;

      // 内存保护：限制处理的行数
      const maxLines = Math.min(lines.length, 10000);

      for (let i = 0; i < maxLines; i++) {
        const line = lines[i];
        const trimmedLine = line.trim();
        
        // 计算语义分数
        const lineScore = this.calculateSemanticScore(trimmedLine, language);
        semanticScore += lineScore;

        // 决定是否分段
        const shouldSplit = this.shouldSplitAtSemanticBoundary(
          trimmedLine, 
          currentChunk, 
          semanticScore, 
          i, 
          maxLines
        );

        if (shouldSplit && currentChunk.length > 0) {
          const chunkContent = currentChunk.join('\n');
          const complexity = this.calculateComplexity(chunkContent);
          
          const metadata: CodeChunkMetadata = {
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            language: language || 'unknown',
            filePath,
            type: 'semantic',
            complexity
          };

          chunks.push({
            content: chunkContent,
            metadata
          });

          // 应用重叠
          const overlapLines = this.calculateOverlapLines(currentChunk);
          currentChunk = overlapLines;
          currentLine = i - overlapLines.length + 1;
          semanticScore = 0;
        }

        currentChunk.push(line);
        
        // 内存检查
        if (i > 0 && i % 1000 === 0) {
          if (this.isMemoryLimitExceeded()) {
            this.logger?.warn(`Memory limit exceeded during semantic chunking, stopping at line ${i}`);
            break;
          }
        }
      }

      // 处理最后的chunk
      if (currentChunk.length > 0) {
        const chunkContent = currentChunk.join('\n');
        const complexity = this.calculateComplexity(chunkContent);
        
        const metadata: CodeChunkMetadata = {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language: language || 'unknown',
          filePath,
          type: 'semantic',
          complexity
        };

        chunks.push({
          content: chunkContent,
          metadata
        });
      }

      return chunks;
    } catch (error) {
      this.logger?.error(`Error in semantic chunking: ${error}`);
      return this.chunkByLines(content, filePath, language);
    }
  }

  /**
   * 基于括号和行数的智能分段
   * 适用于代码文件，保持代码块的完整性
   */
  chunkByBracketsAndLines(content: string, filePath?: string, language?: string): CodeChunk[] {
    try {
      if (!this.options.enableBracketBalance) {
        return this.chunkByLines(content, filePath, language);
      }

      const chunks: CodeChunk[] = [];
      const lines = content.split('\n');
      let currentChunk: string[] = [];
      let currentLine = 1;
      let bracketDepth = 0;
      let xmlTagDepth = 0;

      // 内存保护：限制处理的行数
      const maxLines = Math.min(lines.length, 10000);

      for (let i = 0; i < maxLines; i++) {
        const line = lines[i];
        currentChunk.push(line);
        
        // 更新括号深度
        bracketDepth += this.countOpeningBrackets(line);
        bracketDepth -= this.countClosingBrackets(line);
        
        // 更新XML标签深度
        xmlTagDepth += this.countOpeningXmlTags(line);
        xmlTagDepth -= this.countClosingXmlTags(line);

        // 分段条件：括号平衡且达到最小块大小
        const shouldSplit = (bracketDepth === 0 && xmlTagDepth === 0 && currentChunk.length >= 5) ||
                           currentChunk.length >= this.options.maxLinesPerChunk;

        if (shouldSplit) {
          const chunkContent = currentChunk.join('\n');
          const complexity = this.calculateComplexity(chunkContent);
          
          const metadata: CodeChunkMetadata = {
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            language: language || 'unknown',
            filePath,
            type: 'bracket',
            complexity
          };

          chunks.push({
            content: chunkContent,
            metadata
          });

          // 应用重叠
          const overlapLines = this.calculateOverlapLines(currentChunk);
          currentChunk = overlapLines;
          currentLine = i - overlapLines.length + 1;
          bracketDepth = 0;
          xmlTagDepth = 0;
        }
        
        // 内存检查
        if (i > 0 && i % 1000 === 0) {
          if (this.isMemoryLimitExceeded()) {
            this.logger?.warn(`Memory limit exceeded during bracket chunking, stopping at line ${i}`);
            break;
          }
        }
      }

      // 处理剩余内容
      if (currentChunk.length > 0) {
        const chunkContent = currentChunk.join('\n');
        const complexity = this.calculateComplexity(chunkContent);
        
        const metadata: CodeChunkMetadata = {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language: language || 'unknown',
          filePath,
          type: 'bracket',
          complexity
        };

        chunks.push({
          content: chunkContent,
          metadata
        });
      }

      return chunks;
    } catch (error) {
      this.logger?.error(`Error in bracket chunking: ${error}`);
      return this.chunkByLines(content, filePath, language);
    }
  }

  /**
   * 简单的行数分段
   * 基于行数的简单分段，作为最终的降级方案
   */
  chunkByLines(content: string, filePath?: string, language?: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let currentLine = 1;

    // 内存保护：限制处理的行数
    const maxLines = Math.min(lines.length, 10000);

    for (let i = 0; i < maxLines; i++) {
      const line = lines[i];
      currentChunk.push(line);

      // 检查是否应该分段
      const currentSize = currentChunk.join('\n').length;
      const shouldSplit = currentChunk.length >= this.options.maxLinesPerChunk ||
                         currentSize >= this.options.maxChunkSize ||
                         i === maxLines - 1;

      if (shouldSplit) {
        const chunkContent = currentChunk.join('\n');
        const complexity = this.calculateComplexity(chunkContent);
        
        const metadata: CodeChunkMetadata = {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language: language || 'unknown',
          filePath,
          type: 'line',
          complexity
        };

        chunks.push({
          content: chunkContent,
          metadata
        });

        // 应用重叠
        const overlapLines = this.calculateOverlapLines(currentChunk);
        currentChunk = overlapLines;
        currentLine = i - overlapLines.length + 2;
      }
      
      // 内存检查
      if (i > 0 && i % 1000 === 0) {
        if (this.isMemoryLimitExceeded()) {
          this.logger?.warn(`Memory limit exceeded during line chunking, stopping at line ${i}`);
          break;
        }
      }
    }

    // 处理剩余内容
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      const complexity = this.calculateComplexity(chunkContent);
      
      const metadata: CodeChunkMetadata = {
        startLine: currentLine,
        endLine: currentLine + currentChunk.length - 1,
        language: language || 'unknown',
        filePath,
        type: 'line',
        complexity
      };

      chunks.push({
        content: chunkContent,
        metadata
      });
    }

    return chunks;
  }

  /**
   * 计算语义分数
   */
  private calculateSemanticScore(line: string, language?: string): number {
    let score = line.length; // 基础分数

    // 语言特定的关键字权重
    if (language === 'typescript' || language === 'javascript') {
      if (line.match(/\b(function|class|interface|const|let|var|import|export)\b/)) score += 10;
      if (line.match(/\b(if|else|while|for|switch|case|try|catch|finally)\b/)) score += 5;
      if (line.match(/\b(return|break|continue|throw|new)\b/)) score += 4;
    } else if (language === 'python') {
      if (line.match(/\b(def|class|import|from|if|else|elif|for|while|try|except|finally)\b/)) score += 8;
      if (line.match(/\b(return|break|continue|raise|yield|async|await)\b/)) score += 4;
    } else if (language === 'java') {
      if (line.match(/\b(public|private|protected|static|final|class|interface)\b/)) score += 10;
      if (line.match(/\b(if|else|while|for|switch|case|try|catch|finally)\b/)) score += 5;
    }
    
    // 通用结构复杂度
    score += (line.match(/[{}]/g) || []).length * 3;
    score += (line.match(/[()]/g) || []).length * 2;
    score += (line.match(/[\[\]]/g) || []).length * 1.5;
    
    // 注释和空行降低语义密度
    if (line.match(/^\s*\/\//) || line.match(/^\s*\/\*/) || line.match(/^\s*\*/)) score *= 0.3;
    if (line.trim() === '') score = 1;

    return score;
  }

  /**
   * 判断是否应该在语义边界处分段
   */
  private shouldSplitAtSemanticBoundary(
    line: string, 
    currentChunk: string[], 
    semanticScore: number, 
    currentIndex: number, 
    maxLines: number
  ): boolean {
    // 大小限制检查
    if (semanticScore > this.options.maxChunkSize * 0.8) {
      return true;
    }

    // 逻辑边界检查
    const trimmedLine = line.trim();
    
    // 函数/类定义结束
    if (trimmedLine.match(/^[}\)]\s*$/) && currentChunk.length > 5) {
      return true;
    }

    // 控制结构结束
    if (trimmedLine.match(/^\s*(}|\)|\]|;)\s*$/) && currentChunk.length > 3) {
      return true;
    }

    // 空行作为潜在分割点
    if (trimmedLine === '' && currentChunk.length > 5) {
      return true;
    }

    // 注释行作为分割点
    if (trimmedLine.match(/^\s*\/\//) || trimmedLine.match(/^\s*\/\*/) || 
        trimmedLine.match(/^\s*\*/) || trimmedLine.match(/^\s*#/)) {
      return currentChunk.length > 3;
    }

    // 到达文件末尾
    if (currentIndex === maxLines - 1) {
      return true;
    }

    return false;
  }

  /**
   * 计算开括号数量
   */
  private countOpeningBrackets(line: string): number {
    return (line.match(/\(/g) || []).length + 
           (line.match(/\{/g) || []).length + 
           (line.match(/\[/g) || []).length;
  }

  /**
   * 计算闭括号数量
   */
  private countClosingBrackets(line: string): number {
    return (line.match(/\)/g) || []).length + 
           (line.match(/\}/g) || []).length + 
           (line.match(/\]/g) || []).length;
  }

  /**
   * 计算开XML标签数量
   */
  private countOpeningXmlTags(line: string): number {
    const matches = line.match(/<[^\/][^>]*>/g);
    return matches ? matches.length : 0;
  }

  /**
   * 计算闭XML标签数量
   */
  private countClosingXmlTags(line: string): number {
    const matches = line.match(/<\/[^>]*>/g);
    return matches ? matches.length : 0;
  }

  /**
   * 计算重叠行数
   */
  private calculateOverlapLines(lines: string[]): string[] {
    const overlapSize = this.options.overlapSize;
    let overlapLines: string[] = [];
    let size = 0;

    // 从后往前计算重叠
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const lineSize = line.length + 1; // +1 for newline

      if (size + lineSize <= overlapSize) {
        overlapLines.unshift(line);
        size += lineSize;
      } else {
        break;
      }
    }

    return overlapLines;
  }

  /**
   * 计算代码复杂度
   */
  private calculateComplexity(content: string): number {
    let complexity = 0;
    
    // 基于代码结构计算复杂度
    complexity += (content.match(/\b(if|else|while|for|switch|case|try|catch|finally)\b/g) || []).length * 2;
    complexity += (content.match(/\b(function|method|class|interface)\b/g) || []).length * 3;
    complexity += (content.match(/[{}]/g) || []).length;
    complexity += (content.match(/[()]/g) || []).length * 0.5;
    
    // 基于代码长度调整
    const lines = content.split('\n').length;
    complexity += Math.log10(lines + 1) * 2;
    
    return Math.round(complexity);
  }

  /**
   * 检查内存限制是否超出
   */
  private isMemoryLimitExceeded(): boolean {
    try {
      const currentMemory = process.memoryUsage();
      const memoryUsageMB = currentMemory.heapUsed / 1024 / 1024;
      return memoryUsageMB > this.options.memoryLimitMB;
    } catch (error) {
      this.logger?.warn(`Failed to check memory usage: ${error}`);
      return false;
    }
  }
}