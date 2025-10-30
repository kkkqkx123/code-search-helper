import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { ISplitStrategy, IStrategyProvider, ChunkingOptions } from '../../../interfaces/CoreISplitStrategy';
import { CodeChunk, ASTNode, DEFAULT_CHUNKING_OPTIONS } from '../../../processing';
import { TreeSitterService } from '../../../core/parse/TreeSitterService';
import { ContentHashIDGenerator } from '../../utils/ContentHashIDGenerator';
import { ComplexityCalculator } from '../../utils/calculation/ComplexityCalculator';
import { ASTNodeExtractor } from '../../utils/AST/ASTNodeExtractor';
import { BaseSplitStrategy } from './base/BaseASTStrategy';

/**
 * 函数分割策略
 * 专注于提取和分割函数/方法定义
 */
@injectable()
export class FunctionStrategy extends BaseSplitStrategy {
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
      this.logger?.warn('TreeSitterService is required for FunctionStrategy');
      return [];
    }

    try {
      // 根据文件大小动态调整参数
      const adjustedOptions = this.adjustOptionsForFileSize(content, options);

      // 使用传入的AST或重新解析
      let parseResult = ast;
      if (!parseResult) {
        parseResult = await this.treeSitterService.parseCode(content, language);
      }

      if (parseResult && parseResult.success && parseResult.ast) {
        return this.extractFunctions(content, parseResult.ast, language, filePath, nodeTracker);
      } else {
        this.logger?.warn('Failed to parse code for function extraction');
        return [];
      }
    } catch (error) {
      this.logger?.warn(`Function splitting failed: ${error}`);
      return [];
    }
  }

  // 新增：根据文件大小调整选项
  private adjustOptionsForFileSize(content: string, originalOptions?: ChunkingOptions): ChunkingOptions {
    const lines = content.split('\n');
    const lineCount = lines.length;

    // 基础配置
    const baseOptions = originalOptions || {};

    // 小文件特殊处理
    if (lineCount <= 20) {
      return {
        ...baseOptions,
        functionSpecificOptions: {
          preferWholeFunctions: true,
          minFunctionOverlap: baseOptions.functionSpecificOptions?.minFunctionOverlap || 50,
          maxFunctionSize: baseOptions.functionSpecificOptions?.maxFunctionSize || 2000,
          maxFunctionLines: Math.max(lineCount, 50), // 放宽最大行数限制
          minFunctionLines: 1, // 最小行数降为1
          enableSubFunctionExtraction: false // 禁用子函数提取
        },
        minChunkSize: 5, // 降低最小块大小
        maxChunkSize: Math.max(100, lineCount * 3) // 调整最大块大小
      };
    }

    // 中等文件
    if (lineCount <= 100) {
      return {
        ...baseOptions,
        functionSpecificOptions: {
          preferWholeFunctions: true,
          minFunctionOverlap: baseOptions.functionSpecificOptions?.minFunctionOverlap || 50,
          maxFunctionSize: baseOptions.functionSpecificOptions?.maxFunctionSize || 2000,
          maxFunctionLines: 100, // 适度放宽
          minFunctionLines: 3, // 稍微降低最小行数
          enableSubFunctionExtraction: baseOptions.functionSpecificOptions?.enableSubFunctionExtraction ?? true
        }
      };
    }

    // 大文件使用默认配置
    return baseOptions;
  }

  getName(): string {
    return 'FunctionStrategy';
  }

  getDescription(): string {
    return 'Function Strategy that extracts function and method definitions';
  }

  supportsLanguage(language: string): boolean {
    if (!this.treeSitterService) {
      return false;
    }
    
    const supportedLanguages = this.treeSitterService.getSupportedLanguages();
    return supportedLanguages.some(lang => 
      lang.name.toLowerCase() === language.toLowerCase() && lang.supported
    );
  }



  /**
   * 提取函数块 - 改为public以便测试
   */
  async extractFunctions(
    content: string,
    ast: any,
    language: string,
    filePath?: string,
    nodeTracker?: any
  ): Promise<CodeChunk[]> {
    const chunks: CodeChunk[] = [];

    try {
      const functions = this.treeSitterService!.extractFunctions(ast);

      if (!functions || (await functions).length === 0) {
        return chunks;
      }

      this.logger?.debug(`Found ${(await functions).length} functions to process`);

      for (const functionNode of await functions) {
        const functionChunks = this.processFunctionNode(functionNode, content, language, filePath, nodeTracker);
        chunks.push(...functionChunks);
      }

    } catch (error) {
      this.logger?.warn(`Failed to extract function chunks: ${error}`);
    }

    return chunks;
  }

  /**
   * 处理单个函数节点
   */
  private processFunctionNode(
    functionNode: any,
    content: string,
    language: string,
    filePath?: string,
    nodeTracker?: any
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    // 获取函数文本和位置信息
    const functionText = this.treeSitterService!.getNodeText(functionNode, content);
    const location = this.treeSitterService!.getNodeLocation(functionNode);
    const functionName = this.treeSitterService!.getNodeName(functionNode);

    // 验证基本信息
    if (!location) {
      this.logger?.warn('Failed to get function location');
      return chunks;
    }

    const lineCount = location.endLine - location.startLine + 1;
    const complexity = this.complexityCalculator.calculate(functionText);

    // 创建AST节点对象
    const astNode: ASTNode = this.createASTNode(functionNode, functionText, 'function');

    // 检查节点是否已被使用
    if (nodeTracker && nodeTracker.isUsed(astNode)) {
      return chunks;
    }

    // 创建函数块的元数据
    const metadata = {
      startLine: location.startLine,
      endLine: location.endLine,
      language,
      filePath,
      type: 'function' as const,
      functionName,
      complexity,
      nodeIds: [astNode.id],
      lineCount
    };

    // 创建代码块
    chunks.push(this.createChunk(functionText, metadata));

    // 标记节点为已使用
    if (nodeTracker) {
      nodeTracker.markUsed(astNode);
    }

    return chunks;
  }

  /**
   * 创建AST节点
   */
  private createASTNode(node: any, content: string, type: string, customId?: string): ASTNode {
    const nodeId = customId || `${node.startIndex}-${node.endIndex}-${type}`;

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

    return this.astNodeExtractor.extractNodesFromChunk(chunk, ast, 'function');
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
 * 函数策略提供者
 */
@injectable()
export class FunctionStrategyProvider implements IStrategyProvider {
  constructor(
    @inject(TYPES.LoggerService) private logger?: LoggerService,
    @inject(TYPES.TreeSitterService) private treeSitterService?: TreeSitterService
  ) { }

  getName(): string {
    return 'FunctionStrategyProvider';
  }

  createStrategy(options?: ChunkingOptions): ISplitStrategy {
    return new FunctionStrategy(this.logger, this.treeSitterService);
  }

  getDependencies(): string[] {
    return ['TreeSitterService'];
  }

  supportsLanguage(language: string): boolean {
    const strategy = this.createStrategy();
    return strategy.supportsLanguage(language);
  }



  getDescription(): string {
    return 'Provides function extraction strategy';
  }
}