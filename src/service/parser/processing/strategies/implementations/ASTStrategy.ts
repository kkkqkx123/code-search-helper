/**
 * AST分割策略
 * 基于抽象语法树进行代码分割的策略
 */

import { BaseStrategy } from '../base/BaseStrategy';
import type { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import type { ProcessingResult } from '../../core/types/ResultTypes';
import type { StrategyConfig } from '../../types/Strategy';
import { ChunkType } from '../../types/CodeChunk';

/**
 * AST分割策略实现
 */
export class ASTStrategy extends BaseStrategy {
  constructor(config?: Partial<StrategyConfig>) {
    const defaultConfig: StrategyConfig = {
      name: 'ast-strategy',
      priority: 60,
      supportedLanguages: [
        'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
        'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala'
      ],
      enabled: true,
      description: 'AST-based code splitting strategy',
      parameters: {
        extractFunctions: true,
        extractClasses: true,
        extractImports: true,
        maxFunctionSize: 2000,
        maxClassSize: 3000,
        minFunctionLines: 5,
        minClassLines: 3
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
      const chunks = await this.extractFromAST(context);
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
   * 从AST提取代码块
   */
  private async extractFromAST(context: IProcessingContext): Promise<any[]> {
    const { content, language, filePath, ast } = context;
    const chunks: any[] = [];

    try {
      // 提取函数
      if (this.config.parameters?.extractFunctions !== false) {
        const functionChunks = await this.extractFunctions(content, ast, language, filePath);
        chunks.push(...functionChunks);
      }

      // 提取类
      if (this.config.parameters?.extractClasses !== false) {
        const classChunks = await this.extractClasses(content, ast, language, filePath);
        chunks.push(...classChunks);
      }

      // 提取导入语句
      if (this.config.parameters?.extractImports !== false) {
        const importChunks = await this.extractImports(content, ast, language, filePath);
        chunks.push(...importChunks);
      }

      // 如果没有提取到任何块，创建一个包含整个内容的块
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
      // 如果AST解析失败，创建一个包含整个内容的块
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
   * 提取函数定义
   */
  private async extractFunctions(
    content: string,
    ast: any,
    language: string,
    filePath?: string
  ): Promise<any[]> {
    const chunks: any[] = [];
    
    try {
      // 这里应该调用TreeSitter服务提取函数
      // 由于我们无法直接访问TreeSitter服务，这里提供一个模拟实现
      const functions = this.mockExtractFunctions(ast);
      
      for (const func of functions) {
        const functionText = this.getNodeText(func, content);
        const location = this.getNodeLocation(func);
        const functionName = this.getNodeName(func);
        
        if (!location || !functionText || functionText.trim().length === 0) {
          continue;
        }

        const lineCount = location.endLine - location.startLine + 1;
        const minFunctionLines = this.config.parameters?.minFunctionLines || 5;
        const maxFunctionSize = this.config.parameters?.maxFunctionSize || 2000;

        // 检查函数大小和行数
        if (lineCount < minFunctionLines || functionText.length > maxFunctionSize) {
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
            nodeIds: [func.id]
          }
        );

        chunks.push(chunk);
      }
    } catch (error) {
      // 忽略错误，继续处理其他类型的节点
    }

    return chunks;
  }

  /**
   * 提取类定义
   */
  private async extractClasses(
    content: string,
    ast: any,
    language: string,
    filePath?: string
  ): Promise<any[]> {
    const chunks: any[] = [];
    
    try {
      // 这里应该调用TreeSitter服务提取类
      // 由于我们无法直接访问TreeSitter服务，这里提供一个模拟实现
      const classes = this.mockExtractClasses(ast);
      
      for (const cls of classes) {
        const classText = this.getNodeText(cls, content);
        const location = this.getNodeLocation(cls);
        const className = this.getNodeName(cls);
        
        if (!location || !classText || classText.trim().length === 0) {
          continue;
        }

        const lineCount = location.endLine - location.startLine + 1;
        const minClassLines = this.config.parameters?.minClassLines || 3;
        const maxClassSize = this.config.parameters?.maxClassSize || 3000;

        // 检查类大小和行数
        if (lineCount < minClassLines || classText.length > maxClassSize) {
          continue;
        }

        const complexity = this.calculateComplexity(classText);

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
            nodeIds: [cls.id]
          }
        );

        chunks.push(chunk);
      }
    } catch (error) {
      // 忽略错误，继续处理其他类型的节点
    }

    return chunks;
  }

  /**
   * 提取导入语句
   */
  private async extractImports(
    content: string,
    ast: any,
    language: string,
    filePath?: string
  ): Promise<any[]> {
    const chunks: any[] = [];
    
    try {
      // 这里应该调用TreeSitter服务提取导入语句
      // 由于我们无法直接访问TreeSitter服务，这里提供一个模拟实现
      const imports = this.mockExtractImports(ast);
      
      for (const importNode of imports) {
        const importText = this.getNodeText(importNode, content);
        const location = this.getNodeLocation(importNode);
        
        if (!location || !importText || importText.trim().length === 0) {
          continue;
        }

        const complexity = this.calculateComplexity(importText);

        const chunk = this.createChunk(
          importText,
          location.startLine,
          location.endLine,
          language,
          ChunkType.IMPORT,
          {
            filePath,
            complexity,
            nodeIds: [importNode.id]
          }
        );

        chunks.push(chunk);
      }
    } catch (error) {
      // 忽略错误，继续处理其他类型的节点
    }

    return chunks;
  }

  /**
   * 模拟函数提取（实际实现应该使用TreeSitter服务）
   */
  private mockExtractFunctions(ast: any): any[] {
    // 这是一个模拟实现，实际应该使用TreeSitter服务
    return [];
  }

  /**
   * 模拟类提取（实际实现应该使用TreeSitter服务）
   */
  private mockExtractClasses(ast: any): any[] {
    // 这是一个模拟实现，实际应该使用TreeSitter服务
    return [];
  }

  /**
   * 模拟导入提取（实际实现应该使用TreeSitter服务）
   */
  private mockExtractImports(ast: any): any[] {
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