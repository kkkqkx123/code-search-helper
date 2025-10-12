import { ImportSplitter as ImportSplitterInterface } from './index';
import { SplitStrategy, CodeChunk, CodeChunkMetadata, ChunkingOptions, DEFAULT_CHUNKING_OPTIONS } from '../types';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';

export class ImportSplitter implements ImportSplitterInterface {
  private options: Required<ChunkingOptions>;
  private treeSitterService?: TreeSitterService;
  private logger?: LoggerService;

  constructor(options?: ChunkingOptions) {
    this.options = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
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
      throw new Error('TreeSitterService is required for ImportSplitter');
    }

    const parseResult = await this.treeSitterService.parseCode(content, language);

    if (parseResult.success && parseResult.ast) {
      return this.extractImports(content, parseResult.ast, language, filePath);
    } else {
      return [];
    }
  }

  /**
   * 提取导入语句块
   * @param content 源代码
   * @param ast AST树
   * @param language 编程语言
   * @param filePath 文件路径
   */
  extractImports(
    content: string,
    ast: any,
    language: string,
    filePath?: string
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    try {
      if (!this.treeSitterService) {
        throw new Error('TreeSitterService is required for ImportSplitter');
      }

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

  getName(): string {
    return 'ImportSplitter';
  }

  supportsLanguage(language: string): boolean {
    return this.treeSitterService?.detectLanguage(language) !== null || false;
  }

  getPriority(): number {
    return 3; // 较低优先级
  }
}