import { FunctionSplitter as FunctionSplitterInterface } from './index';
import { SplitStrategy, CodeChunk, CodeChunkMetadata, ChunkingOptions, DEFAULT_CHUNKING_OPTIONS, ASTNode } from '../types';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { LoggerService } from '../../../../utils/LoggerService';
import { ComplexityCalculator } from '../utils/ComplexityCalculator';
import { ContentHashIDGenerator } from '../utils/ContentHashIDGenerator';

/**
 * 统一的函数分割器 - 合并了FunctionSplitter和EnhancedFunctionSplitter的功能
 */
export class FunctionSplitter implements FunctionSplitterInterface {
  private options: Required<ChunkingOptions>;
  private treeSitterService?: TreeSitterService;
  private logger?: LoggerService;
  private complexityCalculator: ComplexityCalculator;
  private maxFunctionLines: number;
  private minFunctionLines: number;
  private enableSubFunctionExtraction: boolean;

  constructor(options?: ChunkingOptions) {
    this.options = { ...DEFAULT_CHUNKING_OPTIONS, ...options };
    this.complexityCalculator = new ComplexityCalculator();
    
    // 配置参数 - 从 functionSpecificOptions 中获取
    this.maxFunctionLines = options?.functionSpecificOptions?.maxFunctionLines || 50;
    this.minFunctionLines = options?.functionSpecificOptions?.minFunctionLines || 3;
    this.enableSubFunctionExtraction = options?.functionSpecificOptions?.enableSubFunctionExtraction ?? false;
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
   * 提取函数块 - 支持智能分段
   * @param content 源代码
   * @param ast AST树
   * @param language 编程语言
   * @param filePath 文件路径
   * @param nodeTracker 节点跟踪器
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

      this.logger?.debug(`Found ${functions.length} functions to process`);

      for (const funcNode of functions) {
        const functionChunks = this.processFunctionNode(funcNode, content, language, filePath, nodeTracker);
        chunks.push(...functionChunks);
      }

    } catch (error) {
      this.logger?.warn(`Failed to extract function chunks: ${error}`);
    }

    return chunks;
  }

  /**
   * 处理单个函数节点 - 支持智能分段
   */
  private processFunctionNode(
    funcNode: any,
    content: string,
    language: string,
    filePath?: string,
    nodeTracker?: any
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    // 检查treeSitterService是否存在
    if (!this.treeSitterService) {
      throw new Error('TreeSitterService is required for FunctionSplitter');
    }

    // 获取函数文本
    const funcText = this.treeSitterService.getNodeText(funcNode, content);
    
    // 创建增强的AST节点对象
    const astNode: ASTNode = {
      id: ContentHashIDGenerator.generateNodeId({
        id: `${funcNode.startIndex}-${funcNode.endIndex}-function`,
        type: 'function',
        startByte: funcNode.startIndex,
        endByte: funcNode.endIndex,
        startLine: funcNode.startPosition.row,
        endLine: funcNode.endPosition.row,
        text: funcText
      }),
      type: 'function',
      startByte: funcNode.startIndex,
      endByte: funcNode.endIndex,
      startLine: funcNode.startPosition.row,
      endLine: funcNode.endPosition.row,
      text: funcText,
      contentHash: ContentHashIDGenerator.getContentHashPrefix(funcText)
    };

    // 检查节点是否已被使用
    if (nodeTracker && nodeTracker.isUsed(astNode)) {
      return chunks; // 跳过已使用的节点
    }

    const funcContent = astNode.text;
    const location = this.treeSitterService.getNodeLocation(funcNode);
    const functionName = this.treeSitterService.getNodeName(funcNode);
    
    // 添加空值检查
    if (!location) {
      this.logger?.warn('Failed to get node location');
      return chunks;
    }
    
    const lineCount = location.endLine - location.startLine + 1;
    const complexity = this.complexityCalculator.calculate(funcContent);

    // 决策：是否需要细分这个函数？
    if (this.shouldSplitFunction(funcContent, lineCount, complexity)) {
      // 智能分段大函数
      const subChunks = this.splitLargeFunction(funcNode, funcContent, location, language, filePath, nodeTracker);
      chunks.push(...subChunks);
    } else {
      // 保持为单个函数块
      const metadata: CodeChunkMetadata = {
        startLine: location.startLine,
        endLine: location.endLine,
        language,
        filePath,
        type: 'function',
        functionName,
        complexity,
        nodeIds: [astNode.id],
        lineCount
      };

      chunks.push({
        content: funcContent,
        metadata
      });
    }

    // 标记节点为已使用
    if (nodeTracker) {
      nodeTracker.markUsed(astNode);
    }

    return chunks;
  }

  /**
   * 判断是否需要对函数进行细分
   */
  private shouldSplitFunction(funcContent: string, lineCount: number, complexity: number): boolean {
    // 基于多个因素决定是否分段
    const reasons = [];

    if (lineCount > this.maxFunctionLines) {
      reasons.push(`Lines: ${lineCount} > ${this.maxFunctionLines}`);
    }

    if (complexity > 20) { // 复杂度阈值
      reasons.push(`Complexity: ${complexity} > 20`);
    }

    if (funcContent.split('\n').filter(line => line.trim().startsWith('if ') || line.trim().startsWith('for ') || line.trim().startsWith('switch ')).length > 5) {
      reasons.push('Too many control structures');
    }

    const shouldSplit = reasons.length > 0;
    
    if (shouldSplit) {
      this.logger?.debug(`Should split function: ${reasons.join(', ')}`);
    }

    return shouldSplit;
  }

  /**
   * 智能分段大函数
   */
  private splitLargeFunction(
    funcNode: any,
    funcContent: string,
    location: any,
    language: string,
    filePath?: string,
    nodeTracker?: any
  ): CodeChunk[] {
    if (!this.enableSubFunctionExtraction) {
      // 如果禁用子函数提取，返回原始函数
      const metadata: CodeChunkMetadata = {
        startLine: location.startLine,
        endLine: location.endLine,
        language,
        filePath,
        type: 'function',
        functionName: this.treeSitterService ? this.treeSitterService.getNodeName(funcNode) || 'unknown_function' : 'unknown_function',
        complexity: this.complexityCalculator.calculate(funcContent),
        nodeIds: [`${funcNode.startIndex}-${funcNode.endIndex}-function`]
      };

      return [{
        content: funcContent,
        metadata
      }];
    }

    const chunks: CodeChunk[] = [];
    const lines = funcContent.split('\n');
    
    // 策略1：按逻辑块分段（基于控制结构）
    const logicalBlocks = this.extractLogicalBlocks(lines);
    
    // 策略2：按注释分段（基于文档注释）
    const commentBlocks = this.extractCommentBlocks(lines);
    
    // 策略3：按复杂度分段（基于圈复杂度）
    const complexityBlocks = this.extractComplexityBlocks(lines);
    
    // 合并所有分段策略的结果
    const allBlocks = this.mergeSplittingStrategies(logicalBlocks, commentBlocks, complexityBlocks);
    
    // 创建代码块
    for (let i = 0; i < allBlocks.length; i++) {
      const block = allBlocks[i];
      const blockContent = lines.slice(block.startLine, block.endLine + 1).join('\n');
      
      // 检查内容是否有效
      if (blockContent.trim().length < 10) continue;
      
      // 创建子函数块
      const subAstNode: ASTNode = {
        id: `${funcNode.startIndex}-${funcNode.endIndex}-subfunction-${i}`,
        type: 'sub_function',
        startByte: funcNode.startIndex,
        endByte: funcNode.endIndex,
        startLine: location.startLine + block.startLine,
        endLine: location.startLine + block.endLine,
        text: blockContent,
        contentHash: ContentHashIDGenerator.getContentHashPrefix(blockContent)
      };

      // 检查是否已被使用
      if (nodeTracker && nodeTracker.isUsed(subAstNode)) {
        continue;
      }

      const metadata: CodeChunkMetadata = {
        startLine: location.startLine + block.startLine,
        endLine: location.startLine + block.endLine,
        language,
        filePath,
        type: 'sub_function',
        functionName: `block_${i}`,
        complexity: this.complexityCalculator.calculate(blockContent),
        nodeIds: [subAstNode.id],
        parentFunction: this.treeSitterService ? this.treeSitterService.getNodeName(funcNode) || 'unknown' : 'unknown',
        blockType: block.type
      };

      chunks.push({
        content: blockContent,
        metadata
      });

      // 标记为已使用
      if (nodeTracker) {
        nodeTracker.markUsed(subAstNode);
      }
    }

    // 如果没有有效的子块，返回原始函数
    if (chunks.length === 0) {
      const metadata: CodeChunkMetadata = {
        startLine: location.startLine,
        endLine: location.endLine,
        language,
        filePath,
        type: 'function',
        functionName: this.treeSitterService ? this.treeSitterService.getNodeName(funcNode) || 'unknown_function' : 'unknown_function',
        complexity: this.complexityCalculator.calculate(funcContent),
        nodeIds: [`${funcNode.startIndex}-${funcNode.endIndex}-function`]
      };

      chunks.push({
        content: funcContent,
        metadata
      });
    }

    return chunks;
  }

  /**
   * 提取逻辑块（基于控制结构）
   */
  private extractLogicalBlocks(lines: string[]): Array<{startLine: number, endLine: number, type: string}> {
    const blocks = [];
    let currentBlockStart = 0;
    let braceLevel = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 计算大括号层级
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;
      braceLevel += openBraces - closeBraces;
      
      // 检测逻辑边界
      const isControlStructure = /^(if|for|switch|case|default)\s/.test(line.trim());
      const isReturn = line.trim().startsWith('return');
      const isEmptyBlock = i > 0 && lines[i-1].trim() === '{' && line.trim() === '}';
      
      if (isControlStructure || isReturn || isEmptyBlock) {
        if (i - currentBlockStart >= this.minFunctionLines) {
          blocks.push({
            startLine: currentBlockStart,
            endLine: i,
            type: isControlStructure ? 'control_structure' : (isReturn ? 'return_block' : 'empty_block')
          });
        }
        currentBlockStart = i + 1;
      }
    }
    
    // 添加最后一个块
    if (lines.length - currentBlockStart >= this.minFunctionLines) {
      blocks.push({
        startLine: currentBlockStart,
        endLine: lines.length - 1,
        type: 'remaining_block'
      });
    }
    
    return blocks.filter(block => block.endLine - block.startLine + 1 >= this.minFunctionLines);
  }

  /**
   * 提取注释块（基于文档注释）
   */
  private extractCommentBlocks(lines: string[]): Array<{startLine: number, endLine: number, type: string}> {
    const blocks = [];
    let inCommentBlock = false;
    let commentStart = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('//') || line.startsWith('/*')) {
        if (!inCommentBlock) {
          inCommentBlock = true;
          commentStart = i;
        }
      } else if (inCommentBlock) {
        inCommentBlock = false;
        if (i - commentStart >= this.minFunctionLines) {
          blocks.push({
            startLine: commentStart,
            endLine: i - 1,
            type: 'comment_block'
          });
        }
      }
    }
    
    return blocks;
  }

  /**
   * 提取复杂度块（基于圈复杂度）
   */
  private extractComplexityBlocks(lines: string[]): Array<{startLine: number, endLine: number, type: string}> {
    const blocks = [];
    let currentComplexity = 0;
    let blockStart = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // 简单复杂度计算
      if (line.includes('if ') || line.includes('for ') || line.includes('switch ')) {
        currentComplexity++;
      }
      
      // 当复杂度达到阈值时创建块
      if (currentComplexity >= 5 && i - blockStart >= this.minFunctionLines) {
        blocks.push({
          startLine: blockStart,
          endLine: i,
          type: 'complexity_block'
        });
        blockStart = i + 1;
        currentComplexity = 0;
      }
    }
    
    return blocks;
  }

  /**
   * 合并多个分段策略的结果
   */
  private mergeSplittingStrategies(
    logicalBlocks: Array<{startLine: number, endLine: number, type: string}>,
    commentBlocks: Array<{startLine: number, endLine: number, type: string}>,
    complexityBlocks: Array<{startLine: number, endLine: number, type: string}>
  ): Array<{startLine: number, endLine: number, type: string}> {
    const allBlocks = [...logicalBlocks, ...commentBlocks, ...complexityBlocks];
    
    // 按起始行排序
    allBlocks.sort((a, b) => a.startLine - b.startLine);
    
    // 合并重叠的块
    const mergedBlocks = [];
    let currentBlock = null;
    
    for (const block of allBlocks) {
      if (!currentBlock) {
        currentBlock = { ...block };
      } else if (block.startLine <= currentBlock.endLine + 1) {
        // 重叠或相邻，合并
        currentBlock.endLine = Math.max(currentBlock.endLine, block.endLine);
        currentBlock.type = 'merged_block';
      } else {
        // 不重叠，保存当前块并开始新块
        mergedBlocks.push(currentBlock);
        currentBlock = { ...block };
      }
    }
    
    if (currentBlock) {
      mergedBlocks.push(currentBlock);
    }
    
    return mergedBlocks;
  }

  getName(): string {
    return 'FunctionSplitter';
  }

  supportsLanguage(language: string): boolean {
    return this.treeSitterService?.detectLanguage(language) !== null || false;
  }

  getPriority(): number {
    return 2; // 函数分段优先级（中等优先级）
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