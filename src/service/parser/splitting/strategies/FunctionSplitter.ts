import { FunctionSplitter as FunctionSplitterInterface } from './index';
import { SplitStrategy, CodeChunk, CodeChunkMetadata, ChunkingOptions, DEFAULT_CHUNKING_OPTIONS, ASTNode } from '../types';
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
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]> {
    if (!this.treeSitterService) {
      throw new Error('TreeSitterService is required for FunctionSplitter');
    }

    // 使用传入的AST或重新解析
    let parseResult = ast;
    if (!parseResult) {
      parseResult = await this.treeSitterService.parseCode(content, language);
    }

    if (parseResult && parseResult.success && parseResult.ast) {
      return this.extractFunctions(content, parseResult.ast, language, filePath, nodeTracker);
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
    filePath?: string,
    nodeTracker?: any
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
        // 创建AST节点对象用于跟踪
        const astNode: ASTNode = {
          id: `${funcNode.startIndex}-${funcNode.endIndex}-function`,
          type: 'function',
          startByte: funcNode.startIndex,
          endByte: funcNode.endIndex,
          startLine: funcNode.startPosition.row,
          endLine: funcNode.endPosition.row,
          text: this.treeSitterService.getNodeText(funcNode, content)
        };

        // 检查节点是否已被使用
        if (nodeTracker && nodeTracker.isUsed(astNode)) {
          continue; // 跳过已使用的节点
        }

        const funcContent = astNode.text;
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
          complexity,
          nodeIds: [astNode.id] // 关联AST节点ID
        };

        chunks.push({
          content: funcContent,
          metadata
        });

        // 标记节点为已使用
        if (nodeTracker) {
          nodeTracker.markUsed(astNode);
        }
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
    return 3; // 函数分段优先级（在类和导入之后）
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