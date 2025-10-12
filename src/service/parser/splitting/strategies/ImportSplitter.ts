import { ImportSplitter as ImportSplitterInterface } from './index';
import { SplitStrategy, CodeChunk, CodeChunkMetadata, ChunkingOptions, DEFAULT_CHUNKING_OPTIONS, ASTNode } from '../types';
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
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]> {
    if (!this.treeSitterService) {
      throw new Error('TreeSitterService is required for ImportSplitter');
    }

    // 使用传入的AST或重新解析
    let parseResult = ast;
    if (!parseResult) {
      parseResult = await this.treeSitterService.parseCode(content, language);
    }

    if (parseResult && parseResult.success && parseResult.ast) {
      return this.extractImports(content, parseResult.ast, language, filePath, nodeTracker);
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
    filePath?: string,
    nodeTracker?: any
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
        // 创建AST节点对象用于跟踪
        const astNode: ASTNode = {
          id: `${importNode.startIndex}-${importNode.endIndex}-import`,
          type: 'import',
          startByte: importNode.startIndex,
          endByte: importNode.endIndex,
          startLine: importNode.startPosition.row,
          endLine: importNode.endPosition.row,
          text: this.treeSitterService.getNodeText(importNode, content)
        };

        // 检查节点是否已被使用
        if (nodeTracker && nodeTracker.isUsed(astNode)) {
          continue; // 跳过已使用的节点
        }

        const importContent = astNode.text;
        const location = this.treeSitterService.getNodeLocation(importNode);

        const metadata: CodeChunkMetadata = {
          startLine: location.startLine,
          endLine: location.endLine,
          language,
          filePath,
          type: 'import',
          nodeIds: [astNode.id] // 关联AST节点ID
        };

        chunks.push({
          content: importContent,
          metadata
        });

        // 标记节点为已使用
        if (nodeTracker) {
          nodeTracker.markUsed(astNode);
        }
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
    return 1; // 导入分段最高优先级
  }

  /**
   * 提取代码块关联的AST节点
   */
  extractNodesFromChunk(chunk: CodeChunk, ast: any): ASTNode[] {
    if (!chunk.metadata.nodeIds || !ast) {
      return [];
    }

    const nodes: ASTNode[] = [];
    
    // 从AST中查找与节点ID匹配的节点
    // 这里需要根据实际的AST结构实现节点查找逻辑
    // 暂时返回空数组，实际实现需要根据Tree-sitter的AST结构来提取
    
    return nodes;
  }

  /**
   * 检查代码块是否包含已使用的节点
   */
  hasUsedNodes(chunk: CodeChunk, nodeTracker: any, ast: any): boolean {
    if (!nodeTracker || !chunk.metadata.nodeIds) {
      return false;
    }

    const nodes = this.extractNodesFromChunk(chunk, ast);
    return nodes.some(node => nodeTracker.isUsed(node));
  }
}