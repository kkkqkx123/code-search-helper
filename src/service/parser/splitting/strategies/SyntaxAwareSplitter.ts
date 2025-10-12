import { SyntaxAwareSplitter as SyntaxAwareSplitterInterface, SplitStrategy, CodeChunk, ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from '../types';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';
import { FunctionSplitter } from './FunctionSplitter';
import { ClassSplitter } from './ClassSplitter';
import { ImportSplitter } from './ImportSplitter';
import { ChunkOptimizer } from '../utils/ChunkOptimizer';

export class SyntaxAwareSplitter implements SyntaxAwareSplitterInterface {
  private options: Required<ChunkingOptions>;
  private treeSitterService?: TreeSitterService;
  private logger?: LoggerService;
  private functionSplitter?: FunctionSplitter;
  private classSplitter?: ClassSplitter;
  private importSplitter?: ImportSplitter;
  private chunkOptimizer?: ChunkOptimizer;

  constructor(options?: ChunkingOptions) {
    this.options = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
  }

  setTreeSitterService(treeSitterService: TreeSitterService): void {
    this.treeSitterService = treeSitterService;
    if (this.functionSplitter) this.functionSplitter.setTreeSitterService(treeSitterService);
    if (this.classSplitter) this.classSplitter.setTreeSitterService(treeSitterService);
    if (this.importSplitter) this.importSplitter.setTreeSitterService(treeSitterService);
  }

  setLogger(logger: LoggerService): void {
    this.logger = logger;
  }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions
  ): Promise<CodeChunk[]> {
    const mergedOptions = { ...this.options, ...options };

    if (!this.treeSitterService) {
      throw new Error('TreeSitterService is required for SyntaxAwareSplitter');
    }

    const parseResult = await this.treeSitterService.parseCode(content, language);

    if (parseResult.success && parseResult.ast) {
      return await this.createEnhancedSyntaxAwareChunks(
        content, parseResult, language, filePath, mergedOptions
      );
    } else {
      // 如果解析失败，返回空数组或使用备用方案
      return [];
    }
  }

  private async createEnhancedSyntaxAwareChunks(
    content: string,
    parseResult: any,
    language: string,
    filePath?: string,
    options: Required<ChunkingOptions>
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];

    // 初始化子分段器
    this.functionSplitter = this.functionSplitter || new FunctionSplitter(options);
    this.classSplitter = this.classSplitter || new ClassSplitter(options);
    this.importSplitter = this.importSplitter || new ImportSplitter(options);

    if (this.treeSitterService) {
      this.functionSplitter.setTreeSitterService(this.treeSitterService);
      this.classSplitter.setTreeSitterService(this.treeSitterService);
      this.importSplitter.setTreeSitterService(this.treeSitterService);
    }

    if (this.logger) {
      this.functionSplitter.setLogger(this.logger);
      this.classSplitter.setLogger(this.logger);
      this.importSplitter.setLogger(this.logger);
    }

    // 1. 函数和方法分段（包含嵌套函数）
    const functionChunks = this.functionSplitter.extractFunctions(content, parseResult.ast, language, filePath);
    chunks.push(...functionChunks);

    // 2. 类和接口分段
    const classChunks = this.classSplitter.extractClasses(content, parseResult.ast, language, filePath);
    chunks.push(...classChunks);

    // 3. 导入导出语句分段
    const importChunks = this.importSplitter.extractImports(content, parseResult.ast, language, filePath);
    chunks.push(...importChunks);

    // 4. 优化块大小
    this.chunkOptimizer = this.chunkOptimizer || new ChunkOptimizer(options);
    return this.chunkOptimizer.optimize(chunks, content);
  }

  getName(): string {
    return 'SyntaxAwareSplitter';
  }

  supportsLanguage(language: string): boolean {
    // 检查TreeSitterService是否支持该语言
    return this.treeSitterService?.isLanguageSupported(language) || false;
  }

  getPriority(): number {
    return 1; // 高优先级
  }
}