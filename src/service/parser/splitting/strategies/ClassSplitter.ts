import { ClassSplitter as ClassSplitterInterface } from './index';
import { SplitStrategy, CodeChunk, CodeChunkMetadata, ChunkingOptions, DEFAULT_CHUNKING_OPTIONS, ASTNode } from '../types';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';
import { ComplexityCalculator } from '../utils/ComplexityCalculator';
import { ContentHashIDGenerator } from '../utils/ContentHashIDGenerator';

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
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]> {
    if (!this.treeSitterService) {
      throw new Error('TreeSitterService is required for ClassSplitter');
    }

    // 使用传入的AST或重新解析
    let parseResult = ast;
    if (!parseResult) {
      parseResult = await this.treeSitterService.parseCode(content, language);
    }

    if (parseResult && parseResult.success && parseResult.ast) {
      return this.extractClasses(content, parseResult.ast, language, filePath, nodeTracker);
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
    filePath?: string,
    nodeTracker?: any
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
        // 创建增强的AST节点对象用于跟踪（支持内容哈希）
        const astNode: ASTNode = {
          id: ContentHashIDGenerator.generateNodeId({
            id: `${classNode.startIndex}-${classNode.endIndex}-class`,
            type: 'class',
            startByte: classNode.startIndex,
            endByte: classNode.endIndex,
            startLine: classNode.startPosition.row,
            endLine: classNode.endPosition.row,
            text: this.treeSitterService.getNodeText(classNode, content)
          }),
          type: 'class',
          startByte: classNode.startIndex,
          endByte: classNode.endIndex,
          startLine: classNode.startPosition.row,
          endLine: classNode.endPosition.row,
          text: this.treeSitterService.getNodeText(classNode, content),
          contentHash: ContentHashIDGenerator.getContentHashPrefix(this.treeSitterService.getNodeText(classNode, content))
        };

        // 检查节点是否已被使用
        if (nodeTracker && nodeTracker.isUsed(astNode)) {
          continue; // 跳过已使用的节点
        }

        const classContent = astNode.text;
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
          complexity,
          nodeIds: [astNode.id] // 关联AST节点ID
        };

        chunks.push({
          content: classContent,
          metadata
        });

        // 标记节点为已使用
        if (nodeTracker) {
          nodeTracker.markUsed(astNode);
        }
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
    return 2; // 类分段优先级（在导入之后，函数之前）
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