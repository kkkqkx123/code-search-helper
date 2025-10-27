import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions } from '../../../interfaces/ISplitStrategy';
import { CodeChunk, ASTNode, DEFAULT_CHUNKING_OPTIONS } from '../../../processing';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { ContentHashIDGenerator } from '../../utils/ContentHashIDGenerator';
import { ComplexityCalculator } from '../../utils/calculation/ComplexityCalculator';
import { ASTNodeExtractor } from '../../utils/AST/ASTNodeExtractor';
import { BaseSplitStrategy } from './base/BaseASTStrategy';

/**
 * 导入语句分割策略
 * 专注于提取和分割导入/引入语句
 */
@injectable()
export class ImportStrategy extends BaseSplitStrategy {
  private complexityCalculator: ComplexityCalculator;
  private astNodeExtractor?: ASTNodeExtractor;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.TreeSitterService) treeSitterService?: TreeSitterService
  ) {
    super({ ...DEFAULT_CHUNKING_OPTIONS });
    this.complexityCalculator = new ComplexityCalculator();
    if (logger) {
      this.setLogger(logger);
    }
    if (treeSitterService) {
      this.setTreeSitterService(treeSitterService);
    }
  }

  // 设置 TreeSitterService 并初始化 ASTNodeExtractor
  setTreeSitterService(treeSitterService: TreeSitterService): void {
    super.setTreeSitterService(treeSitterService);
    this.astNodeExtractor = new ASTNodeExtractor(treeSitterService);
  }

  async split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions,
    nodeTracker?: any,
    ast?: any
  ): Promise<CodeChunk[]> {
    // 验证输入
    if (!this.validateInput(content, language)) {
      return [];
    }

    if (!this.treeSitterService) {
      this.logger?.warn('TreeSitterService is required for ImportStrategy');
      return [];
    }

    try {
      // 使用传入的AST或重新解析
      let parseResult = ast;
      if (!parseResult) {
        parseResult = await this.treeSitterService.parseCode(content, language);
      }

      if (parseResult && parseResult.success && parseResult.ast) {
        return this.extractImports(content, parseResult.ast, language, filePath, nodeTracker);
      } else {
        this.logger?.warn('Failed to parse code for import extraction');
        return [];
      }
    } catch (error) {
      this.logger?.warn(`Import splitting failed: ${error}`);
      return [];
    }
  }

  getName(): string {
    return 'ImportStrategy';
  }

  getDescription(): string {
    return 'Import Strategy that extracts import/require statements';
  }

  supportsLanguage(language: string): boolean {
    return this.treeSitterService?.detectLanguage(language) !== null || false;
  }

  getPriority(): number {
    return 3; // 低优先级，在其他分割策略之前处理
  }

  /**
   * 提取导入块 - 改为public以便测试
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
      const imports = this.treeSitterService!.extractImportNodes(ast);

      if (!imports || imports.length === 0) {
        return chunks;
      }

      this.logger?.debug(`Found ${imports.length} imports to process`);

      for (const importNode of imports) {
        const importChunks = this.processImportNode(importNode, content, language, filePath, nodeTracker);
        chunks.push(...importChunks);
      }

    } catch (error) {
      this.logger?.warn(`Failed to extract import chunks: ${error}`);
    }

    return chunks;
  }

  /**
   * 处理单个导入节点
   */
  private processImportNode(
    importNode: any,
    content: string,
    language: string,
    filePath?: string,
    nodeTracker?: any
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    // 获取导入文本和位置信息
    const importText = this.treeSitterService!.getNodeText(importNode, content);
    const location = this.treeSitterService!.getNodeLocation(importNode);

    // 验证基本信息
    if (!location) {
      this.logger?.warn('Failed to get import location');
      return chunks;
    }

    const lineCount = location.endLine - location.startLine + 1;
    const complexity = this.complexityCalculator.calculate(importText);

    // 创建AST节点对象
    const astNode: ASTNode = this.createASTNode(importNode, importText, 'import');

    // 检查节点是否已被使用
    if (nodeTracker && nodeTracker.isUsed(astNode)) {
      return chunks;
    }

    // 创建导入块的元数据
    const metadata = {
      startLine: location.startLine,
      endLine: location.endLine,
      language,
      filePath,
      type: 'import' as const,
      complexity,
      nodeIds: [astNode.id],
      lineCount
    };

    // 创建代码块
    chunks.push(this.createChunk(importText, metadata));

    // 标记节点为已使用
    if (nodeTracker) {
      nodeTracker.markUsed(astNode);
    }

    return chunks;
  }

  /**
   * 创建AST节点
   */
  private createASTNode(node: any, content: string, type: string): ASTNode {
    const nodeId = `${node.startIndex}-${node.endIndex}-${type}`;

    return {
      id: ContentHashIDGenerator.generateNodeId({
        id: nodeId,
        type,
        startByte: node.startIndex,
        endByte: node.endIndex,
        startLine: node.startPosition.row,
        endLine: node.endPosition.row,
        text: content
      }),
      type,
      startByte: node.startIndex,
      endByte: node.endIndex,
      startLine: node.startPosition.row,
      endLine: node.endPosition.row,
      text: content,
      contentHash: ContentHashIDGenerator.getContentHashPrefix(content)
    };
  }

  extractNodesFromChunk(chunk: CodeChunk, ast: any): ASTNode[] {
    if (!this.astNodeExtractor) {
      this.logger?.warn('ASTNodeExtractor not initialized');
      return [];
    }

    return this.astNodeExtractor.extractNodesFromChunk(chunk, ast, 'import');
  }

  hasUsedNodes(chunk: CodeChunk, nodeTracker: any, ast: any): boolean {
    if (!nodeTracker || !chunk.metadata.nodeIds) {
      return false;
    }

    const nodes = this.extractNodesFromChunk(chunk, ast);
    return nodes.some(node => nodeTracker.isUsed(node));
  }
}

/**
 * 导入策略提供者
 */
@injectable()
export class ImportStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.LoggerService) private logger?: LoggerService,
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService
  ) { }

  getName(): string {
    return 'ImportStrategyProvider';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new ImportStrategy(this.logger, this.treeSitterService);
  }

  getDependencies(): string[] {
    return ['TreeSitterService'];
  }

  supportsLanguage(language: string): boolean {
    const strategy = this.createStrategy();
    return strategy.supportsLanguage(language);
  }

  getPriority(): number {
    return 3; // 低优先级
  }

  getDescription(): string {
    return 'Provides import statement extraction strategy';
  }
}