import { injectable, inject } from 'inversify';
import { Splitter, CodeChunk, CodeChunkMetadata } from './Splitter';
import { TreeSitterService } from '../core/parse/TreeSitterService';
import { TYPES } from '../../../types';
import { createHash } from 'crypto';
import { LoggerService } from '../../../utils/LoggerService';
import { BalancedChunker } from './BalancedChunker';

// 导入重构后的模块
import { SyntaxAwareSplitter } from './strategies/SyntaxAwareSplitter';
import { FunctionSplitter } from './strategies/FunctionSplitter';
import { ClassSplitter } from './strategies/ClassSplitter';
import { ImportSplitter } from './strategies/ImportSplitter';
import { IntelligentSplitter } from './strategies/IntelligentSplitter';
import { SemanticSplitter } from './strategies/SemanticSplitter';
import { ChunkOptimizer } from './utils/ChunkOptimizer';
import { ComplexityCalculator } from './utils/ComplexityCalculator';
import { OverlapCalculator } from './utils/OverlapCalculator';
import { PerformanceMonitor } from './utils/PerformanceMonitor';
import { ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from './types';

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

@injectable()
export class ASTCodeSplitter implements Splitter {
  private chunkSize: number = 250;
  private chunkOverlap: number = 300;
  private treeSitterService: TreeSitterService;
  private simpleFallback: SimpleCodeSplitter;
  private simpleChunker: SimpleCodeSplitter;
  private options: Required<ChunkingOptions>;
  private logger?: LoggerService;
  private balancedChunker: BalancedChunker;

  // 重构后的模块实例
  private syntaxAwareSplitter: SyntaxAwareSplitter;
  private functionSplitter: FunctionSplitter;
  private classSplitter: ClassSplitter;
  private importSplitter: ImportSplitter;
  private intelligentSplitter: IntelligentSplitter;
  private semanticSplitter: SemanticSplitter;
  private chunkOptimizer: ChunkOptimizer;
  private complexityCalculator: ComplexityCalculator;
  private overlapCalculator: OverlapCalculator;
  private performanceMonitor: PerformanceMonitor;

  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.treeSitterService = treeSitterService;
    this.logger = logger;
    this.simpleFallback = new SimpleCodeSplitter(this.chunkSize, this.chunkOverlap);
    this.simpleChunker = new SimpleCodeSplitter(this.chunkSize, this.chunkOverlap);
    this.balancedChunker = new BalancedChunker(logger);
    this.options = { ...DEFAULT_CHUNKING_OPTIONS };

    // 初始化重构后的模块
    this.syntaxAwareSplitter = new SyntaxAwareSplitter(this.options);
    this.functionSplitter = new FunctionSplitter(this.options);
    this.classSplitter = new ClassSplitter(this.options);
    this.importSplitter = new ImportSplitter(this.options);
    this.intelligentSplitter = new IntelligentSplitter(this.options);
    this.semanticSplitter = new SemanticSplitter(this.options);
    this.chunkOptimizer = new ChunkOptimizer(this.options);
    this.complexityCalculator = new ComplexityCalculator();
    this.overlapCalculator = new OverlapCalculator(this.options);
    this.performanceMonitor = new PerformanceMonitor(logger);

    // 设置依赖关系
    this.syntaxAwareSplitter.setTreeSitterService(treeSitterService);
    this.functionSplitter.setTreeSitterService(treeSitterService);
    this.classSplitter.setTreeSitterService(treeSitterService);
    this.importSplitter.setTreeSitterService(treeSitterService);
    this.intelligentSplitter.setBalancedChunker(this.balancedChunker);

    // 设置日志服务
    if (logger) {
      this.syntaxAwareSplitter.setLogger(logger);
      this.functionSplitter.setLogger(logger);
      this.classSplitter.setLogger(logger);
      this.importSplitter.setLogger(logger);
      this.intelligentSplitter.setLogger(logger);
    }
  }

  async split(code: string, language: string, filePath?: string): Promise<CodeChunk[]> {
    // 处理空代码
    if (!code || code.trim() === '') {
      return [];
    }
    
    try {
      const parseResult = await this.treeSitterService.parseCode(code, language);

      if (parseResult.success && parseResult.ast) {
        // 使用语法感知分段器
        return await this.syntaxAwareSplitter.split(code, language, filePath, this.options);
      } else {
        this.logger?.warn(`TreeSitterService failed for language ${language}, falling back to intelligent splitting`);
        return await this.intelligentSplitter.split(code, language, filePath, this.options);
      }
    } catch (error) {
      this.logger?.warn(`TreeSitterService failed with error: ${error}, using intelligent fallback`);
      // 如果智能分段失败，使用语义分段作为后备
      try {
        return await this.intelligentSplitter.split(code, language, filePath, this.options);
      } catch (intelligentError) {
        this.logger?.warn(`Intelligent splitter failed, using semantic fallback: ${intelligentError}`);
        return await this.semanticSplitter.split(code, language, filePath, this.options);
      }
    }
  }

  setChunkSize(chunkSize: number): void {
    this.chunkSize = chunkSize;
    this.simpleFallback.setChunkSize(chunkSize);
    this.options.maxChunkSize = chunkSize;
    // 更新相关模块的配置
    this.chunkOptimizer = new ChunkOptimizer(this.options);
    this.intelligentSplitter = new IntelligentSplitter(this.options);
    this.overlapCalculator = new OverlapCalculator(this.options);
  }

  setChunkOverlap(chunkOverlap: number): void {
    this.chunkOverlap = chunkOverlap;
    this.simpleFallback.setChunkOverlap(chunkOverlap);
    this.options.overlapSize = chunkOverlap;
    // 更新相关模块的配置
    this.overlapCalculator = new OverlapCalculator(this.options);
  }
}