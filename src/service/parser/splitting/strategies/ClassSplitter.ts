import { ClassSplitter as ClassSplitterInterface } from './index';
import { SplitStrategy, CodeChunk, CodeChunkMetadata, ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from '../types';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';
import { ComplexityCalculator } from '../utils/ComplexityCalculator';

export class ClassSplitter implements ClassSplitterInterface {
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
      throw new Error('TreeSitterService is required for ClassSplitter');
    }

    const parseResult = await this.treeSitterService.parseCode(content, language);

    if (parseResult.success && parseResult.ast) {
      return this.extractClasses(content, parseResult.ast, language, filePath);
    } else {
      return [];
    }
  }

  /**
   * 提取类块
   * @param content 源代码
   * @param ast AST树
   * @param language 编程语言
   * @param filePath 文件路径
   */
  extractClasses(
    content: string,
    ast: any,
    language: string,
    filePath?: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    try {
      if (!this.treeSitterService) {
        throw new Error('TreeSitterService is required for ClassSplitter');
      }

      const classes = this.treeSitterService.extractClasses(ast);

      if (!classes || classes.length === 0) {
        return chunks;
      }

      for (const classNode of classes) {
        const classContent = this.treeSitterService.getNodeText(classNode, content);
        const location = this.treeSitterService.getNodeLocation(classNode);
        const className = this.treeSitterService.getNodeName(classNode);
        const complexity = this.complexityCalculator.calculate(classContent);

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

  getName(): string {
    return 'ClassSplitter';
  }

  supportsLanguage(language: string): boolean {
    return this.treeSitterService?.detectLanguage(language) !== null || false;
  }

  getPriority(): number {
    return 2; // 中等优先级
  }
}