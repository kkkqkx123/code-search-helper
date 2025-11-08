/**
 * 函数分割策略
 * 专注于提取和分割函数/方法定义的策略
 */

import { BaseStrategy } from '../base/BaseStrategy';
import type { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import type { ProcessingResult } from '../../core/types/ResultTypes';
import type { StrategyConfig } from '../../types/Strategy';
import { ChunkType } from '../../types/CodeChunk';
import { ContentHashUtils } from '../../../../../utils/ContentHashUtils';
import { FUNCTION_STRATEGY_SUPPORTED_LANGUAGES } from '../../../constants/StrategyPriorities';

/**
 * 函数分割策略实现
 */
export class FunctionStrategy extends BaseStrategy {
  constructor(config?: Partial<StrategyConfig>) {
    const defaultConfig: StrategyConfig = {
      name: 'function-strategy',
      supportedLanguages: FUNCTION_STRATEGY_SUPPORTED_LANGUAGES,
      enabled: true,
      description: 'Function extraction strategy',
      parameters: {
        maxFunctionSize: 2000,
        minFunctionLines: 5,
        maxFunctionLines: 100,
        enableSubFunctionExtraction: true,
        preferWholeFunctions: true,
        minFunctionOverlap: 50
      }
    };

    super({ ...defaultConfig, ...config });
  }

  /**
   * 判断是否可以处理给定的上下文
   */
  canHandle(context: IProcessingContext): boolean {
    if (!this.validateContext(context)) {
      return false;
    }

    // 检查是否支持该语言
    if (!this.supportsLanguage(context.language)) {
      return false;
    }

    // 检查是否有AST可用
    if (!context.ast) {
      return false;
    }

    // 检查文件是否包含函数
    if (!context.metadata.hasFunctions) {
      return false;
    }

    // 检查文件是否为代码文件
    if (!context.metadata.isCodeFile) {
      return false;
    }

    return true;
  }

  /**
   * 执行代码分割策略
   */
  async execute(context: IProcessingContext): Promise<ProcessingResult> {
    const startTime = Date.now();

    try {
      const chunks = await this.extractFunctions(context);
      const executionTime = Date.now() - startTime;

      return this.createSuccessResult(
        chunks,
        executionTime,
        {
          language: context.language,
          filePath: context.filePath,
          strategy: this.name,
          chunkCount: chunks.length,
          averageChunkSize: chunks.length > 0 
            ? chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length 
            : 0,
          totalSize: chunks.reduce((sum, chunk) => sum + chunk.content.length, 0)
        }
      );
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return this.createFailureResult(executionTime, errorMessage);
    }
  }

  /**
   * 提取函数定义
   */
  private async extractFunctions(context: IProcessingContext): Promise<any[]> {
    const { content, language, filePath, ast } = context;
    const chunks: any[] = [];

    try {
      // 根据文件大小调整参数
      const adjustedConfig = this.adjustConfigForFileSize(content);
      
      // 这里应该调用TreeSitter服务提取函数
      // 由于我们无法直接访问TreeSitter服务，这里提供一个模拟实现
      const functions = this.mockExtractFunctions(ast);
      
      for (const func of functions) {
        const functionChunks = await this.processFunctionNode(
          func,
          content,
          language,
          filePath,
          context.nodeTracker,
          adjustedConfig
        );
        chunks.push(...functionChunks);
      }

      // 如果没有提取到任何函数，创建一个包含整个内容的块
      if (chunks.length === 0) {
        const complexity = this.calculateComplexity(content);
        const chunk = this.createChunk(
          content,
          1,
          content.split('\n').length,
          language,
          ChunkType.GENERIC,
          {
            filePath,
            complexity,
            fallback: true
          }
        );
        chunks.push(chunk);
      }

      return chunks;
    } catch (error) {
      // 如果提取失败，创建一个包含整个内容的块
      const complexity = this.calculateComplexity(content);
      const chunk = this.createChunk(
        content,
        1,
        content.split('\n').length,
        language,
        ChunkType.GENERIC,
        {
          filePath,
          complexity,
          error: error instanceof Error ? error.message : String(error)
        }
      );
      
      return [chunk];
    }
  }

  /**
   * 处理单个函数节点
   */
  private async processFunctionNode(
    functionNode: any,
    content: string,
    language: string,
    filePath?: string,
    nodeTracker?: any,
    config?: any
  ): Promise<any[]> {
    const chunks: any[] = [];

    try {
      // 获取函数文本和位置信息
      const functionText = this.getNodeText(functionNode, content);
      const location = this.getNodeLocation(functionNode);
      const functionName = this.getNodeName(functionNode);

      if (!location || !functionText || functionText.trim().length === 0) {
        return chunks;
      }

      const lineCount = location.endLine - location.startLine + 1;
      const complexity = this.calculateComplexity(functionText);

      // 检查函数大小和行数
      const maxFunctionSize = config?.maxFunctionSize || this.config.parameters?.maxFunctionSize || 2000;
      const minFunctionLines = config?.minFunctionLines || this.config.parameters?.minFunctionLines || 5;
      const maxFunctionLines = config?.maxFunctionLines || this.config.parameters?.maxFunctionLines || 100;

      if (lineCount < minFunctionLines || lineCount > maxFunctionLines || functionText.length > maxFunctionSize) {
        return chunks;
      }

      // 创建AST节点对象
      const astNode = this.createASTNode(functionNode, functionText, 'function');

      // 检查节点是否已被使用
      if (nodeTracker && nodeTracker.isUsed && nodeTracker.isUsed(astNode)) {
        return chunks;
      }

      // 创建函数块
      const chunk = this.createChunk(
        functionText,
        location.startLine,
        location.endLine,
        language,
        ChunkType.FUNCTION,
        {
          filePath,
          complexity,
          functionName,
          nodeIds: [astNode.id],
          lineCount
        }
      );

      chunks.push(chunk);

      // 标记节点为已使用
      if (nodeTracker && nodeTracker.markUsed) {
        nodeTracker.markUsed(astNode);
      }

      // 如果启用子函数提取，尝试提取嵌套函数
      if (config?.enableSubFunctionExtraction !== false && this.config.parameters?.enableSubFunctionExtraction) {
        const subFunctions = await this.extractSubFunctions(functionNode, content, language, filePath);
        chunks.push(...subFunctions);
      }

      return chunks;
    } catch (error) {
      // 忽略错误，继续处理其他函数
      return chunks;
    }
  }

  /**
   * 提取嵌套函数
   */
  private async extractSubFunctions(
    parentNode: any,
    content: string,
    language: string,
    filePath?: string
  ): Promise<any[]> {
    const chunks: any[] = [];

    try {
      // 这里应该调用TreeSitter服务提取嵌套函数
      // 由于我们无法直接访问TreeSitter服务，这里提供一个模拟实现
      const subFunctions = this.mockExtractSubFunctions(parentNode);
      
      for (const subFunc of subFunctions) {
        const functionText = this.getNodeText(subFunc, content);
        const location = this.getNodeLocation(subFunc);
        const functionName = this.getNodeName(subFunc);

        if (!location || !functionText || functionText.trim().length === 0) {
          continue;
        }

        const complexity = this.calculateComplexity(functionText);

        const chunk = this.createChunk(
          functionText,
          location.startLine,
          location.endLine,
          language,
          ChunkType.FUNCTION,
          {
            filePath,
            complexity,
            functionName,
            parentFunction: this.getNodeName(parentNode),
            nodeIds: [subFunc.id]
          }
        );

        chunks.push(chunk);
      }
    } catch (error) {
      // 忽略错误，继续处理其他函数
    }

    return chunks;
  }

  /**
   * 根据文件大小调整配置
   */
  private adjustConfigForFileSize(content: string): any {
    const lines = content.split('\n');
    const lineCount = lines.length;

    // 小文件特殊处理
    if (lineCount <= 20) {
      return {
        maxFunctionSize: Math.max(100, lineCount * 3),
        maxFunctionLines: Math.max(lineCount, 50),
        minFunctionLines: 1,
        enableSubFunctionExtraction: false
      };
    }

    // 中等文件
    if (lineCount <= 100) {
      return {
        maxFunctionSize: this.config.parameters?.maxFunctionSize || 2000,
        maxFunctionLines: 100,
        minFunctionLines: 3,
        enableSubFunctionExtraction: this.config.parameters?.enableSubFunctionExtraction
      };
    }

    // 大文件使用默认配置
    return this.config.parameters;
  }

  /**
   * 创建AST节点
   */
  private createASTNode(node: any, content: string, type: string): any {
    const nodeId = `${node.startIndex}-${node.endIndex}-${type}`;

    return {
      id: this.generateNodeId(nodeId),
      type,
      startByte: node.startIndex,
      endByte: node.endIndex,
      startLine: node.startPosition?.row || 0,
      endLine: node.endPosition?.row || 0,
      text: content,
      contentHash: this.generateContentHash(content)
    };
  }

  /**
   * 生成节点ID
   */
  private generateNodeId(nodeId: string): string {
    // 简单的哈希实现，实际项目中应该使用更强大的哈希算法
    let hash = 0;
    for (let i = 0; i < nodeId.length; i++) {
      const char = nodeId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString(16);
  }

  /**
   * 生成内容哈希
   */
  private generateContentHash(content: string): string {
    return ContentHashUtils.generateContentHash(content);
  }

  /**
   * 模拟函数提取（实际实现应该使用TreeSitter服务）
   */
  private mockExtractFunctions(ast: any): any[] {
    // 这是一个模拟实现，实际应该使用TreeSitter服务
    return [];
  }

  /**
   * 模拟嵌套函数提取（实际实现应该使用TreeSitter服务）
   */
  private mockExtractSubFunctions(parentNode: any): any[] {
    // 这是一个模拟实现，实际应该使用TreeSitter服务
    return [];
  }

  /**
   * 获取节点文本（模拟实现）
   */
  private getNodeText(node: any, content: string): string {
    // 这是一个模拟实现，实际应该使用TreeSitter服务
    return '';
  }

  /**
   * 获取节点位置（模拟实现）
   */
  private getNodeLocation(node: any): any {
    // 这是一个模拟实现，实际应该使用TreeSitter服务
    return null;
  }

  /**
   * 获取节点名称（模拟实现）
   */
  private getNodeName(node: any): string {
    // 这是一个模拟实现，实际应该使用TreeSitter服务
    return '';
  }

  /**
   * 验证上下文是否有效
   */
  validateContext(context: IProcessingContext): boolean {
    if (!super.validateContext(context)) {
      return false;
    }

    // 检查是否有AST可用
    if (!context.ast) {
      return false;
    }

    return true;
  }
}