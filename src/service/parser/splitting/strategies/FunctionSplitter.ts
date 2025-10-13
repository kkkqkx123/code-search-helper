import { BaseSplitStrategy } from './base/BaseSplitStrategy';
import { CodeChunk, ChunkingOptions, ASTNode } from '../types';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { ContentHashIDGenerator } from '../utils/ContentHashIDGenerator';
import { ComplexityCalculator } from '../utils/ComplexityCalculator';

/**
 * 函数分割策略
 * 专注于提取和分割函数定义
 */
export class FunctionSplitter extends BaseSplitStrategy {
  private complexityCalculator: ComplexityCalculator;
  private maxFunctionLines: number;
  private minFunctionLines: number;
  private enableSubFunctionExtraction: boolean;

  constructor(options?: ChunkingOptions) {
    super(options);
    this.complexityCalculator = new ComplexityCalculator();
    
    // 配置参数 - 从 functionSpecificOptions 中获取
    this.maxFunctionLines = options?.functionSpecificOptions?.maxFunctionLines || 50;
    this.minFunctionLines = options?.functionSpecificOptions?.minFunctionLines || 3;
    this.enableSubFunctionExtraction = options?.functionSpecificOptions?.enableSubFunctionExtraction ?? false;
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
      this.logger?.warn('TreeSitterService is required for FunctionSplitter');
      return [];
    }

    try {
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

  getName(): string {
    return 'FunctionSplitter';
  }

  supportsLanguage(language: string): boolean {
    return this.treeSitterService?.detectLanguage(language) !== null || false;
  }

  getPriority(): number {
    return 2; // 中等优先级
  }

  /**
   * 提取函数块
   */
  private extractFunctions(
    content: string,
    ast: any,
    language: string,
    filePath?: string,
    nodeTracker?: any
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    try {
      const functions = this.treeSitterService!.extractFunctions(ast);

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
   * 处理单个函数节点
   */
  private processFunctionNode(
    funcNode: any,
    content: string,
    language: string,
    filePath?: string,
    nodeTracker?: any
  ): CodeChunk[] {
    const chunks: CodeChunk[] = [];

    // 获取函数文本和位置信息
    const funcText = this.treeSitterService!.getNodeText(funcNode, content);
    const location = this.treeSitterService!.getNodeLocation(funcNode);
    const functionName = this.treeSitterService!.getNodeName(funcNode);

    // 验证基本信息
    if (!location || !functionName) {
      this.logger?.warn('Failed to get function location or name');
      return chunks;
    }

    const lineCount = location.endLine - location.startLine + 1;
    const complexity = this.complexityCalculator.calculate(funcText);

    // 创建AST节点对象
    const astNode: ASTNode = this.createASTNode(funcNode, funcText, 'function');

    // 检查节点是否已被使用
    if (nodeTracker && nodeTracker.isUsed(astNode)) {
      return chunks;
    }

    // 决策：是否需要细分这个函数？
    if (this.shouldSplitFunction(funcText, lineCount, complexity)) {
      // 智能分段大函数
      const subChunks = this.splitLargeFunction(funcNode, funcText, location, language, filePath, nodeTracker);
      chunks.push(...subChunks);
    } else {
      // 保持为单个函数块
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

      chunks.push(this.createChunk(funcText, metadata));
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
    const reasons = [];

    if (lineCount > this.maxFunctionLines) {
      reasons.push(`Lines: ${lineCount} > ${this.maxFunctionLines}`);
    }

    if (complexity > 20) {
      reasons.push(`Complexity: ${complexity} > 20`);
    }

    const controlStructures = funcContent.split('\n').filter(line => 
      line.trim().startsWith('if ') || 
      line.trim().startsWith('for ') || 
      line.trim().startsWith('switch ')
    ).length;

    if (controlStructures > 5) {
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
      const metadata = {
        startLine: location.startLine,
        endLine: location.endLine,
        language,
        filePath,
        type: 'function' as const,
        functionName: this.treeSitterService!.getNodeName(funcNode) || 'unknown_function',
        complexity: this.complexityCalculator.calculate(funcContent),
        nodeIds: [`${funcNode.startIndex}-${funcNode.endIndex}-function`]
      };

      return [this.createChunk(funcContent, metadata)];
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
      const subAstNode: ASTNode = this.createASTNode(
        funcNode, 
        blockContent, 
        'sub_function',
        `${funcNode.startIndex}-${funcNode.endIndex}-subfunction-${i}`
      );

      // 检查是否已被使用
      if (nodeTracker && nodeTracker.isUsed(subAstNode)) {
        continue;
      }

      const metadata = {
        startLine: location.startLine + block.startLine,
        endLine: location.startLine + block.endLine,
        language,
        filePath,
        type: 'sub_function' as const,
        functionName: `block_${i}`,
        complexity: this.complexityCalculator.calculate(blockContent),
        nodeIds: [subAstNode.id],
        parentFunction: this.treeSitterService!.getNodeName(funcNode) || 'unknown',
        blockType: block.type
      };

      chunks.push(this.createChunk(blockContent, metadata));

      // 标记为已使用
      if (nodeTracker) {
        nodeTracker.markUsed(subAstNode);
      }
    }

    // 如果没有有效的子块，返回原始函数
    if (chunks.length === 0) {
      const metadata = {
        startLine: location.startLine,
        endLine: location.endLine,
        language,
        filePath,
        type: 'function' as const,
        functionName: this.treeSitterService!.getNodeName(funcNode) || 'unknown_function',
        complexity: this.complexityCalculator.calculate(funcContent),
        nodeIds: [`${funcNode.startIndex}-${funcNode.endIndex}-function`]
      };

      chunks.push(this.createChunk(funcContent, metadata));
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

  /**
   * 创建AST节点
   */
  private createASTNode(
    node: any, 
    content: string, 
    type: string, 
    customId?: string
  ): ASTNode {
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
    if (!chunk.metadata.nodeIds || !ast) {
      return [];
    }

    // 这里需要根据实际的AST结构实现节点查找逻辑
    // 暂时返回空数组，实际实现需要根据Tree-sitter的AST结构来提取
    return [];
  }

  hasUsedNodes(chunk: CodeChunk, nodeTracker: any, ast: any): boolean {
    if (!nodeTracker || !chunk.metadata.nodeIds) {
      return false;
    }

    const nodes = this.extractNodesFromChunk(chunk, ast);
    return nodes.some(node => nodeTracker.isUsed(node));
  }
}