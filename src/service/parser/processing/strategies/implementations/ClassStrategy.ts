/**
 * 类分割策略
 * 专注于提取和分割类定义的策略
 */

import { BaseStrategy } from '../base/BaseStrategy';
import type { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import type { ProcessingResult } from '../../types/Processing';
import type { StrategyConfig } from '../../types/Strategy';
import { ChunkType } from '../../types/CodeChunk';

/**
 * 类分割策略实现
 */
export class ClassStrategy extends BaseStrategy {
  constructor(config?: Partial<StrategyConfig>) {
    const defaultConfig: StrategyConfig = {
      name: 'class-strategy',
      priority: 45,
      supportedLanguages: [
        'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
        'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala'
      ],
      enabled: true,
      description: 'Class extraction strategy',
      parameters: {
        maxClassSize: 3000,
        minClassLines: 3,
        maxClassLines: 200,
        keepMethodsTogether: true,
        classHeaderOverlap: 100,
        enableComponentSplitting: false
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

    // 检查文件是否包含类
    if (!context.metadata.hasClasses) {
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
      const chunks = await this.extractClasses(context);
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
   * 提取类定义
   */
  private async extractClasses(context: IProcessingContext): Promise<any[]> {
    const { content, language, filePath, ast } = context;
    const chunks: any[] = [];

    try {
      // 这里应该调用TreeSitter服务提取类
      // 由于我们无法直接访问TreeSitter服务，这里提供一个模拟实现
      const classes = this.mockExtractClasses(ast);
      
      for (const cls of classes) {
        const classChunks = await this.processClassNode(
          cls,
          content,
          language,
          filePath,
          context.nodeTracker
        );
        chunks.push(...classChunks);
      }

      // 如果没有提取到任何类，创建一个包含整个内容的块
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
   * 处理单个类节点
   */
  private async processClassNode(
    classNode: any,
    content: string,
    language: string,
    filePath?: string,
    nodeTracker?: any
  ): Promise<any[]> {
    const chunks: any[] = [];

    try {
      // 获取类文本和位置信息
      const classText = this.getNodeText(classNode, content);
      const location = this.getNodeLocation(classNode);
      const className = this.getNodeName(classNode);

      if (!location || !classText || classText.trim().length === 0) {
        return chunks;
      }

      const lineCount = location.endLine - location.startLine + 1;
      const complexity = this.calculateComplexity(classText);

      // 检查类大小和行数
      const maxClassSize = this.config.parameters?.maxClassSize || 3000;
      const minClassLines = this.config.parameters?.minClassLines || 3;
      const maxClassLines = this.config.parameters?.maxClassLines || 200;

      if (lineCount < minClassLines || lineCount > maxClassLines || classText.length > maxClassSize) {
        return chunks;
      }

      // 创建AST节点对象
      const astNode = this.createASTNode(classNode, classText, 'class');

      // 检查节点是否已被使用
      if (nodeTracker && nodeTracker.isUsed && nodeTracker.isUsed(astNode)) {
        return chunks;
      }

      // 根据配置决定是否保持方法在一起
      const keepMethodsTogether = this.config.parameters?.keepMethodsTogether !== false;

      if (keepMethodsTogether) {
        // 保持方法在一起，将整个类作为一个块
        const chunk = this.createChunk(
          classText,
          location.startLine,
          location.endLine,
          language,
          ChunkType.CLASS,
          {
            filePath,
            complexity,
            className,
            nodeIds: [astNode.id],
            lineCount
          }
        );

        chunks.push(chunk);
      } else {
        // 分别提取类定义和方法
        const componentChunks = await this.splitClassComponents(
          classNode,
          classText,
          location,
          language,
          filePath
        );
        chunks.push(...componentChunks);
      }

      // 标记节点为已使用
      if (nodeTracker && nodeTracker.markUsed) {
        nodeTracker.markUsed(astNode);
      }

      return chunks;
    } catch (error) {
      // 忽略错误，继续处理其他类
      return chunks;
    }
  }

  /**
   * 分割类组件（类定义和方法）
   */
  private async splitClassComponents(
    classNode: any,
    classContent: string,
    location: any,
    language: string,
    filePath?: string
  ): Promise<any[]> {
    const chunks: any[] = [];

    try {
      // 首先添加类定义头
      const classHeader = this.extractClassHeader(classNode, classContent);
      if (classHeader) {
        const headerLines = classHeader.split('\n').length;
        const headerComplexity = this.calculateComplexity(classHeader);
        const className = this.getNodeName(classNode);

        const headerChunk = this.createChunk(
          classHeader,
          location.startLine,
          location.startLine + headerLines - 1,
          language,
          ChunkType.CLASS,
          {
            filePath,
            complexity: headerComplexity,
            className,
            component: 'header'
          }
        );

        chunks.push(headerChunk);
      }

      // 尝试提取方法
      if (this.config.parameters?.enableComponentSplitting) {
        const methodChunks = await this.extractMethods(
          classNode,
          classContent,
          location,
          language,
          filePath
        );
        chunks.push(...methodChunks);
      }
    } catch (error) {
      // 忽略错误，返回类定义头
    }

    return chunks;
  }

  /**
   * 提取类头部定义
   */
  private extractClassHeader(classNode: any, classContent: string): string {
    try {
      // 找到类名后的第一个大括号，提取到那里为止的内容
      const lines = classContent.split('\n');
      let braceCount = 0;
      let headerEnd = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;

        if (braceCount > 0) {
          headerEnd = i;
          break;
        }
      }

      return lines.slice(0, headerEnd + 1).join('\n');
    } catch (error) {
      // 如果提取失败，返回前几行
      const lines = classContent.split('\n');
      return lines.slice(0, Math.min(5, lines.length)).join('\n');
    }
  }

  /**
   * 提取方法
   */
  private async extractMethods(
    classNode: any,
    classContent: string,
    location: any,
    language: string,
    filePath?: string
  ): Promise<any[]> {
    const chunks: any[] = [];

    try {
      // 这里应该调用TreeSitter服务提取方法
      // 由于我们无法直接访问TreeSitter服务，这里提供一个模拟实现
      const methods = this.mockExtractMethods(classNode);
      
      for (const method of methods) {
        const methodText = this.getNodeText(method, classContent);
        const methodLocation = this.getNodeLocation(method);
        const methodName = this.getNodeName(method);

        if (!methodLocation || !methodText || methodText.trim().length === 0) {
          continue;
        }

        const complexity = this.calculateComplexity(methodText);
        const className = this.getNodeName(classNode);

        const chunk = this.createChunk(
          methodText,
          methodLocation.startLine,
          methodLocation.endLine,
          language,
          ChunkType.FUNCTION,
          {
            filePath,
            complexity,
            functionName: methodName,
            className,
            component: 'method',
            nodeIds: [method.id]
          }
        );

        chunks.push(chunk);
      }
    } catch (error) {
      // 忽略错误，继续处理其他方法
    }

    return chunks;
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
    // 简单的哈希实现，实际项目中应该使用更强大的哈希算法
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return hash.toString(16);
  }

  /**
   * 模拟类提取（实际实现应该使用TreeSitter服务）
   */
  private mockExtractClasses(ast: any): any[] {
    // 这是一个模拟实现，实际应该使用TreeSitter服务
    return [];
  }

  /**
   * 模拟方法提取（实际实现应该使用TreeSitter服务）
   */
  private mockExtractMethods(classNode: any): any[] {
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