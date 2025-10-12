import { FunctionSplitter as FunctionSplitterInterface } from './index';
import { SplitStrategy, CodeChunk, CodeChunkMetadata, ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from '../types';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';
import { ComplexityCalculator } from '../utils/ComplexityCalculator';

export class FunctionSplitter implements FunctionSplitterInterface {
  private options: Required<ChunkingOptions>;
  private treeSitterService?: TreeSitterService;
  private logger?: LoggerService;
  private complexityCalculator: ComplexityCalculator;

  constructor(options?: ChunkingOptions) {
    this.options = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
    this.complexityCalculator = new ComplexityCalculator();
  }

  setTreeSitterService(treeSitterService: TreeSitterService): void {
    this.treeSitterService = treeSitterService;
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
    if (!this.treeSitterService) {
      throw new Error('TreeSitterService is required for FunctionSplitter');
    }

    const parseResult = await this.treeSitterService.parseCode(content, language);

    if (parseResult.success && parseResult.ast) {
      return this.extractFunctions(content, parseResult.ast, language, filePath);
    } else {
      return [];
    }
  }

  /**
   * 提取函数块
   * @param content 源代码
   * @param ast AST树
   * @param language 编程语言
   * @param filePath 文件路径
   */
  extractFunctions(
    content: string,
    ast: any,
    language: string,
    filePath?: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    try {
      if (!this.treeSitterService) {
        throw new Error('TreeSitterService is required for FunctionSplitter');
      }

      const functions = this.treeSitterService.extractFunctions(ast);

      if (!functions || functions.length === 0) {
        return chunks;
      }

      for (const funcNode of functions) {
        const funcContent = this.treeSitterService.getNodeText(funcNode, content);
        const location = this.treeSitterService.getNodeLocation(funcNode);
        const functionName = this.treeSitterService.getNodeName(funcNode);
        const complexity = this.complexityCalculator.calculate(funcContent);

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

  getName(): string {
    return 'FunctionSplitter';
  }

  supportsLanguage(language: string): boolean {
    return this.treeSitterService?.detectLanguage(language) !== null || false;
  }

  getPriority(): number {
    return 2; // 中等优先级
  }
}