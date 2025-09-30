import { injectable, inject } from 'inversify';
import { Splitter, CodeChunk, CodeChunkMetadata } from './Splitter';
import { TreeSitterService } from '../core/parse/TreeSitterService';
import { TYPES } from '../../../types';
import { createHash } from 'crypto';
import { LoggerService } from '../../../utils/LoggerService';

// Simple fallback implementation for unsupported languages
class SimpleCodeSplitter {
  private chunkSize: number;
  private chunkOverlap: number;

  constructor(chunkSize: number = 2500, chunkOverlap: number = 300) {
    this.chunkSize = chunkSize;
    this.chunkOverlap = chunkOverlap;
  }

  split(code: string): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    let position = 0;

    while (position < code.length) {
      const endPosition = Math.min(position + this.chunkSize, code.length);
      const chunkContent = code.substring(position, endPosition);

      // Calculate line numbers
      // When splitting a string by \n, we get an array with one more element than the number of \n characters
      // So if we have "line1\nline2\nline3", we get ["line1", "line2", "line3"] - 3 elements, meaning we're at line 3
      // If we have "line1\nline2" (no trailing newline), we get ["line1", "line2"] - 2 elements, meaning we're at line 2
      const linesBefore = position === 0 ? 0 : code.substring(0, position).split('\n').length - 1;
      const startLine = linesBefore + 1; // Convert to 1-based line numbers
      const chunkLines = chunkContent.split('\n').length;

      chunks.push({
        content: chunkContent,
        metadata: {
          startLine: startLine,
          endLine: startLine + chunkLines - 1,
          language: 'unknown'
        }
      });

      // Move position with overlap
      position = endPosition - this.chunkOverlap;
      if (position <= 0 || position >= code.length) break;
    }

    return chunks;
  }

  setChunkSize(chunkSize: number): void {
    this.chunkSize = chunkSize;
  }

  setChunkOverlap(chunkOverlap: number): void {
    this.chunkOverlap = chunkOverlap;
  }
}

export interface ChunkingOptions {
  maxChunkSize?: number;
  overlapSize?: number;
  preserveFunctionBoundaries?: boolean;
  preserveClassBoundaries?: boolean;
  includeComments?: boolean;
  minChunkSize?: number;
  extractSnippets?: boolean;
  addOverlap?: boolean;
}

@injectable()
export class ASTCodeSplitter implements Splitter {
  private chunkSize: number = 2500;
  private chunkOverlap: number = 300;
  private treeSitterService: TreeSitterService;
  private simpleFallback: SimpleCodeSplitter;
  private simpleChunker: SimpleCodeSplitter;
  private options: Required<ChunkingOptions>;
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.treeSitterService = treeSitterService;
    this.logger = logger;
    this.simpleFallback = new SimpleCodeSplitter(this.chunkSize, this.chunkOverlap);
    this.simpleChunker = new SimpleCodeSplitter(this.chunkSize, this.chunkOverlap);
    this.options = {
      maxChunkSize: 1000,
      overlapSize: 200,
      preserveFunctionBoundaries: true,
      preserveClassBoundaries: true,
      includeComments: false,
      minChunkSize: 100,
      extractSnippets: true,
      addOverlap: false,
    };
  }

  async split(code: string, language: string, filePath?: string): Promise<CodeChunk[]> {
    // 处理空代码
    if (!code || code.trim() === '') {
      return [];
    }
    
    try {
      const parseResult = await this.treeSitterService.parseCode(code, language);

      if (parseResult.success && parseResult.ast) {
        // 增强的语法感知分段
        const chunks = await this.createEnhancedSyntaxAwareChunks(
          code, parseResult, language, filePath
        );
        
        // 智能块大小调整
        return this.optimizeChunkSizes(chunks, code);
      } else {
        this.logger?.warn(`TreeSitterService failed for language ${language}, falling back to intelligent splitting`);
        return this.intelligentFallback(code, language, filePath);
      }
    } catch (error) {
      this.logger?.warn(`TreeSitterService failed with error: ${error}, using intelligent fallback`);
      return this.intelligentFallback(code, language, filePath);
    }
  }

  setChunkSize(chunkSize: number): void {
    this.chunkSize = chunkSize;
    this.simpleFallback.setChunkSize(chunkSize);
  }

  setChunkOverlap(chunkOverlap: number): void {
    this.chunkOverlap = chunkOverlap;
    this.simpleFallback.setChunkOverlap(chunkOverlap);
  }

  private async createEnhancedSyntaxAwareChunks(
    content: string,
    parseResult: any,
    language: string,
    filePath?: string
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];

    // 1. 函数和方法分段（包含嵌套函数）
    const functionChunks = this.extractFunctionChunks(content, parseResult.ast, language, filePath);
    chunks.push(...functionChunks);

    // 2. 类和接口分段
    const classChunks = this.extractClassChunks(content, parseResult.ast, language, filePath);
    chunks.push(...classChunks);

    // 3. 导入导出语句分段
    const importChunks = this.extractImportExportChunks(content, parseResult.ast, language, filePath);
    chunks.push(...importChunks);

    // 4. 剩余代码的智能分段
    if (chunks.length === 0) {
      const remainingChunks = this.createIntelligentChunks(content, language, filePath);
      chunks.push(...remainingChunks);
    }

    // 5. 优化块大小
    return this.optimizeChunkSizes(chunks, content);
  }

  private async optimizeChunkSizes(chunks: CodeChunk[], originalCode: string): Promise<CodeChunk[]> {
    if (chunks.length <= 1) return chunks;

    const optimizedChunks: CodeChunk[] = [];
    let currentChunk = chunks[0];

    for (let i = 1; i < chunks.length; i++) {
      const nextChunk = chunks[i];
      
      // 检查是否应该合并
      const shouldMerge = this.shouldMergeChunks(currentChunk, nextChunk);
      
      if (shouldMerge) {
        // 合并chunks
        currentChunk = this.mergeChunks(currentChunk, nextChunk);
      } else {
        // 添加当前chunk并开始新的
        optimizedChunks.push(currentChunk);
        currentChunk = nextChunk;
      }
    }

    // 添加最后一个chunk
    optimizedChunks.push(currentChunk);

    // 应用重叠
    if (this.options.addOverlap) {
      return this.addOverlapToChunks(optimizedChunks, originalCode);
    }

    return optimizedChunks;
  }

  private shouldMergeChunks(chunk1: CodeChunk, chunk2: CodeChunk): boolean {
    const totalSize = chunk1.content.length + chunk2.content.length;
    
    // 大小检查
    if (totalSize > this.options.maxChunkSize) {
      return false;
    }

    // 类型兼容性检查
    if (chunk1.metadata.type !== chunk2.metadata.type) {
      // 不同类型通常不合并，除非是特殊组合
      const compatibleTypes = [
        ['function', 'generic'],
        ['class', 'generic'],
        ['import', 'generic']
      ];
      
      const typePair = [chunk1.metadata.type, chunk2.metadata.type].sort();
      const isCompatible = compatibleTypes.some(pair => 
        pair[0] === typePair[0] && pair[1] === typePair[1]
      );
      
      if (!isCompatible) {
        return false;
      }
    }

    // 对于函数和类类型，不进行合并以保持语义完整性
    if (chunk1.metadata.type === 'function' || chunk1.metadata.type === 'class') {
      return false;
    }

    // 复杂度检查
    const combinedComplexity = (chunk1.metadata.complexity || 0) + (chunk2.metadata.complexity || 0);
    if (combinedComplexity > 50) { // 复杂度阈值
      return false;
    }

    return true;
  }

  private mergeChunks(chunk1: CodeChunk, chunk2: CodeChunk): CodeChunk {
    return {
      content: chunk1.content + '\n' + chunk2.content,
      metadata: {
        ...chunk1.metadata,
        endLine: chunk2.metadata.endLine,
        complexity: (chunk1.metadata.complexity || 0) + (chunk2.metadata.complexity || 0)
      }
    };
  }

  private addOverlapToChunks(chunks: CodeChunk[], originalCode: string): CodeChunk[] {
    if (chunks.length <= 1) return chunks;

    const overlappedChunks: CodeChunk[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];

      // 为除最后一个外的所有chunks添加重叠
      if (i < chunks.length - 1) {
        const nextChunk = chunks[i + 1];
        const overlapContent = this.extractOverlapContent(chunk, nextChunk, originalCode);
        
        if (overlapContent) {
          overlappedChunks.push({
            ...chunk,
            content: chunk.content + '\n' + overlapContent
          });
        } else {
          overlappedChunks.push(chunk);
        }
      } else {
        overlappedChunks.push(chunk);
      }
    }

    return overlappedChunks;
  }

  private extractOverlapContent(currentChunk: CodeChunk, nextChunk: CodeChunk, originalCode: string): string {
    try {
      const lines = originalCode.split('\n');
      // Calculate the actual character position for overlap
      // Get the start position of the next chunk in the original code
      const linesUntilNextChunk = lines.slice(0, nextChunk.metadata.startLine - 1);
      // Calculate the character position where next chunk starts (subtract 1 for the newline that's not at the end)
      const charsUntilNextChunk = linesUntilNextChunk.join('\n').length + (linesUntilNextChunk.length > 0 ? 1 : 0) - 1;
      
      // Calculate the starting position for overlap in the original code
      const overlapStartPosition = Math.max(0, charsUntilNextChunk - this.options.overlapSize);
      
      // Find which line this overlap position corresponds to
      let currentPos = 0;
      let overlapStartLine = 1;
      for (let i = 0; i < lines.length; i++) {
        const lineEndPos = currentPos + lines[i].length + 1; // +1 for newline
        if (currentPos <= overlapStartPosition && overlapStartPosition < lineEndPos) {
          overlapStartLine = i + 1;
          break;
        }
        currentPos = lineEndPos;
      }
      
      // Ensure overlapStartLine is within valid range
      overlapStartLine = Math.max(1, Math.min(overlapStartLine, nextChunk.metadata.startLine));
      
      if (overlapStartLine < nextChunk.metadata.startLine) {
        const overlapLines = lines.slice(overlapStartLine - 1, nextChunk.metadata.startLine - 1);
        return overlapLines.join('\n');
      }
    } catch (error) {
      this.logger?.warn(`Failed to extract overlap content: ${error}`);
    }
    
    return '';
  }

  private extractFunctionChunks(
    content: string,
    ast: any,
    language: string,
    filePath?: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    try {
      const functions = this.treeSitterService.extractFunctions(ast);
      
      if (!functions || functions.length === 0) {
        return chunks;
      }

      for (const funcNode of functions) {
        const funcContent = this.treeSitterService.getNodeText(funcNode, content);
        const location = this.treeSitterService.getNodeLocation(funcNode);
        const functionName = this.treeSitterService.getNodeName(funcNode);
        const complexity = this.calculateComplexity(funcContent);

        const metadata: CodeChunkMetadata = {
          startLine: location.startLine,
          endLine: location.endLine,
          language,
          filePath,
          type: 'function',
          functionName,
          complexity
        };

        chunks.push({
          content: funcContent,
          metadata
        });
      }
    } catch (error) {
      this.logger?.warn(`Failed to extract function chunks: ${error}`);
    }

    return chunks;
  }

  private extractClassChunks(
    content: string,
    ast: any,
    language: string,
    filePath?: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    try {
      const classes = this.treeSitterService.extractClasses(ast);
      
      if (!classes || classes.length === 0) {
        return chunks;
      }

      for (const classNode of classes) {
        const classContent = this.treeSitterService.getNodeText(classNode, content);
        const location = this.treeSitterService.getNodeLocation(classNode);
        const className = this.treeSitterService.getNodeName(classNode);
        const complexity = this.calculateComplexity(classContent);

        const metadata: CodeChunkMetadata = {
          startLine: location.startLine,
          endLine: location.endLine,
          language,
          filePath,
          type: 'class',
          className,
          complexity
        };

        chunks.push({
          content: classContent,
          metadata
        });
      }
    } catch (error) {
      this.logger?.warn(`Failed to extract class chunks: ${error}`);
    }

    return chunks;
  }

  private extractImportExportChunks(
    content: string,
    ast: any,
    language: string,
    filePath?: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    
    try {
      const imports = this.treeSitterService.extractImports(ast);
      
      if (!imports || imports.length === 0) {
        return chunks;
      }

      for (const importNode of imports) {
        const importContent = this.treeSitterService.getNodeText(importNode, content);
        const location = this.treeSitterService.getNodeLocation(importNode);

        const metadata: CodeChunkMetadata = {
          startLine: location.startLine,
          endLine: location.endLine,
          language,
          filePath,
          type: 'import'
        };

        chunks.push({
          content: importContent,
          metadata
        });
      }
    } catch (error) {
      this.logger?.warn(`Failed to extract import chunks: ${error}`);
    }

    return chunks;
  }

  private createIntelligentChunks(
    content: string,
    language: string,
    filePath?: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let currentLine = 1;
    let currentSize = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineSize = line.length + 1; // +1 for newline

      // 检查是否需要在逻辑边界处分段
      const shouldSplit = this.shouldSplitAtLine(line, currentChunk, currentSize, lineSize);
      
      if (shouldSplit && currentChunk.length > 0) {
        const chunkContent = currentChunk.join('\n');
        const complexity = this.calculateComplexity(chunkContent);
        
        const metadata: CodeChunkMetadata = {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language,
          filePath,
          type: 'generic',
          complexity
        };

        chunks.push({
          content: chunkContent,
          metadata
        });

        // 应用重叠
        const overlapLines = this.calculateOverlap(currentChunk);
        currentChunk = overlapLines;
        currentLine = i - overlapLines.length + 1;
        currentSize = overlapLines.join('\n').length;
      }

      currentChunk.push(line);
      currentSize += lineSize;
    }

    // 处理最后的chunk
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      const complexity = this.calculateComplexity(chunkContent);
      
      const metadata: CodeChunkMetadata = {
        startLine: currentLine,
        endLine: currentLine + currentChunk.length - 1,
        language,
        filePath,
        type: 'generic',
        complexity
      };

      chunks.push({
        content: chunkContent,
        metadata
      });
    }

    return chunks;
  }

  private shouldSplitAtLine(
    line: string,
    currentChunk: string[],
    currentSize: number,
    lineSize: number
  ): boolean {
    // 大小限制检查
    if (currentSize + lineSize > this.options.maxChunkSize) {
      return true;
    }

    // 逻辑边界检查
    const trimmedLine = line.trim();
    
    // 函数/类定义结束
    if (trimmedLine.match(/^[}\)]\s*$/) && currentChunk.length > 0) {
      return currentSize > this.options.maxChunkSize * 0.3; // 只在chunk足够大时分割
    }

    // 控制结构结束
    if (trimmedLine.match(/^\s*(}|\)|\]|;)\s*$/)) {
      return currentSize > this.options.maxChunkSize * 0.5;
    }

    // 空行作为潜在分割点
    if (trimmedLine === '' && currentChunk.length > 5) {
      return currentSize > this.options.maxChunkSize * 0.4;
    }

    // 注释行
    if (trimmedLine.match(/^\s*\/\//) || trimmedLine.match(/^\s*\/\*/) || trimmedLine.match(/^\s*\*/)) {
      return currentSize > this.options.maxChunkSize * 0.6;
    }

    return false;
  }

  private calculateOverlap(lines: string[]): string[] {
    const overlapSize = this.options.overlapSize;
    let overlapLines: string[] = [];
    let size = 0;

    // 从后往前计算重叠
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      const lineSize = line.length + 1;

      if (size + lineSize <= overlapSize) {
        overlapLines.unshift(line);
        size += lineSize;
      } else {
        break;
      }
    }

    return overlapLines;
  }

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

  private async intelligentFallback(content: string, language: string, filePath?: string): Promise<CodeChunk[]> {
    try {
      // 使用简单分块器
      const simpleChunks = this.simpleChunker.split(content);
      
      // 如果简单分块产生太多小块，使用语义降级
      if (simpleChunks.length > 10 && simpleChunks.every(chunk => chunk.content.length < this.options.maxChunkSize * 0.3)) {
        return this.createSemanticFallbackChunks(content, language, filePath);
      }
      
      return simpleChunks;
    } catch (error) {
      // 如果简单分块失败，使用语义降级
      return this.createSemanticFallbackChunks(content, language, filePath);
    }
  }

  private createSemanticFallbackChunks(
    content: string,
    language: string,
    filePath?: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];
    const lines = content.split('\n');
    let currentChunk: string[] = [];
    let currentLine = 1;
    let semanticScore = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();
      
      // 计算语义分数
      const lineScore = this.calculateSemanticScore(trimmedLine);
      semanticScore += lineScore;

      // 决定是否分段
      const shouldSplit = semanticScore > this.options.maxChunkSize * 0.8 || 
                         (trimmedLine === '' && currentChunk.length > 3) ||
                         i === lines.length - 1;

      if (shouldSplit && currentChunk.length > 0) {
        const chunkContent = currentChunk.join('\n');
        const complexity = this.calculateComplexity(chunkContent);
        
        const metadata: CodeChunkMetadata = {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          language,
          filePath,
          type: 'semantic',
          complexity
        };

        chunks.push({
          content: chunkContent,
          metadata
        });

        currentChunk = [];
        currentLine = i + 1;
        semanticScore = 0;
      }

      currentChunk.push(line);
    }

    return chunks;
  }

  private calculateSemanticScore(line: string): number {
    let score = line.length; // 基础分数

    // 语义关键字权重
    if (line.match(/\b(function|class|interface|const|let|var)\b/)) score += 10;
    if (line.match(/\b(if|else|while|for|switch|case)\b/)) score += 5;
    if (line.match(/\b(import|export|require|from)\b/)) score += 8;
    if (line.match(/\b(try|catch|finally|throw)\b/)) score += 6;
    if (line.match(/\b(return|break|continue)\b/)) score += 4;
    
    // 结构复杂度
    score += (line.match(/[{}]/g) || []).length * 3;
    score += (line.match(/[()]/g) || []).length * 2;
    score += (line.match(/[\[\]]/g) || []).length * 1.5;
    
    // 注释和空行降低语义密度
    if (line.match(/^\s*\/\//) || line.match(/^\s*\/\*/) || line.match(/^\s*\*/)) score *= 0.3;
    if (line.trim() === '') score = 1;

    return score;
  }
}