import { BaseStrategy } from '../base/BaseStrategy';
import { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import { ProcessingResult } from '../../types/Processing';
import { CodeChunk, ChunkType } from '../../types/CodeChunk';
import { StrategyConfig } from '../../types/Strategy';
import { Logger } from '../../../../../utils/logger';

/**
 * AST分段策略配置
 */
export interface ASTStrategyConfig extends StrategyConfig {
  /** 最大函数大小 */
  maxFunctionSize?: number;
  /** 最大类大小 */
  maxClassSize?: number;
  /** 最小函数行数 */
  minFunctionLines?: number;
  /** 最小类行数 */
  minClassLines?: number;
}

/**
 * AST分段策略
 * 使用TreeSitter进行AST解析来分段代码
 */
export class ASTSegmentationStrategy extends BaseStrategy {
  protected config: ASTStrategyConfig;
  private logger: Logger;

  constructor(config: ASTStrategyConfig) {
    const defaultConfig: StrategyConfig = {
      name: 'ast-segmentation',
      priority: 20,
      supportedLanguages: [
        'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
        'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala'
      ],
      enabled: true,
      description: 'AST Segmentation Strategy',
    };
    super({ ...defaultConfig, ...config });
    this.config = {
      maxFunctionSize: 3000,
      maxClassSize: 5000,
      minFunctionLines: 10,
      minClassLines: 5,
      ...config
    };
    this.logger = Logger.getInstance();
  }

  /**
   * 检查是否可以处理指定的上下文
   */
  canHandle(context: IProcessingContext): boolean {
    const { language, content } = context;
    
    // 检查语言是否支持
    if (!this.supportsLanguage(language || 'unknown')) {
      return false;
    }
    
    // 检查内容是否适合AST处理（至少有一些结构）
    const hasStructure = /(?:function|func|def|class|struct|interface)\s+\w+/i.test(content);
    return hasStructure;
  }

  /**
   * 执行策略
   */
  async execute(context: IProcessingContext): Promise<ProcessingResult> {
    const startTime = Date.now();
    try {
      const chunks = await this.process(context);
      return this.createSuccessResult(chunks, Date.now() - startTime);
    } catch (error) {
      return this.createFailureResult(Date.now() - startTime, error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * 执行分段处理
   */
  async process(context: IProcessingContext): Promise<CodeChunk[]> {
    const startTime = Date.now();
    this.logger.debug(`Starting AST segmentation for language: ${context.language}, file: ${context.filePath}`);
    
    try {
      // 验证上下文
      if (!this.validateContext(context)) {
        throw new Error('Invalid context for AST segmentation');
      }

      // 检查语言是否支持
      const lang = context.language || 'unknown';
      if (!this.supportsLanguage(lang)) {
        this.logger.warn(`Language ${lang} not supported by AST strategy`);
        return this.createFallbackChunks(context);
      }

      // 模拟AST解析（实际实现中应该调用TreeSitter服务）
      const parseResult = await this.simulateTreeSitterParse(context.content, lang);
      
      if (!parseResult.success) {
        this.logger.warn(`TreeSitter parsing failed for ${lang}`);
        return this.createFallbackChunks(context);
      }

      // 提取函数和类定义
      const functions = await this.extractFunctions(parseResult.ast, lang);
      const classes = await this.extractClasses(parseResult.ast, lang);

      this.logger.debug(`TreeSitter extracted ${functions.length} functions and ${classes.length} classes`);

      // 将AST节点转换为CodeChunk
      const chunks: CodeChunk[] = [];

      // 处理函数定义
      for (const func of functions) {
        try {
          const location = func.location;
          const funcText = func.text;
          
          if (funcText && funcText.trim().length > 0) {
            chunks.push(this.createChunk(
              funcText,
              location.startLine,
              location.endLine,
              context.language || 'unknown',
              ChunkType.FUNCTION,
              {
                filePath: context.filePath,
                complexity: this.calculateComplexity(funcText),
                functionName: func.name
              }
            ));
          }
        } catch (error) {
          this.logger.warn(`Failed to process function node: ${error}`);
          continue;
        }
      }

      // 处理类定义
      for (const cls of classes) {
        try {
          const location = cls.location;
          const clsText = cls.text;
          
          if (clsText && clsText.trim().length > 0) {
            chunks.push(this.createChunk(
              clsText,
              location.startLine,
              location.endLine,
              context.language || 'unknown',
              ChunkType.CLASS,
              {
                filePath: context.filePath,
                complexity: this.calculateComplexity(clsText),
                className: cls.name
              }
            ));
          }
        } catch (error) {
          this.logger.warn(`Failed to process class node: ${error}`);
          continue;
        }
      }

      // 如果没有提取到任何函数或类，返回包含整个文件的chunk
      if (chunks.length === 0) {
        this.logger.info('No functions or classes found by TreeSitter, returning full content as single chunk');
        chunks.push(this.createChunk(
          context.content,
          1,
          context.content.split('\n').length,
          context.language || 'unknown',
          ChunkType.GENERIC,
          {
            filePath: context.filePath,
            complexity: this.calculateComplexity(context.content),
            reason: 'no_functions_or_classes_found'
          }
        ));
      }

      this.updatePerformanceStats(Date.now() - startTime, true, chunks.length);
      this.logger.debug(`Successfully created ${chunks.length} chunks from AST segmentation`);
      return chunks;
    } catch (error) {
      this.logger.error(`AST segmentation failed: ${error}`);
      
      // 如果失败，返回一个简单的块
      return this.createFallbackChunks(context);
    }
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    // AST策略支持大多数编程语言
    return [
      'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
      'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala'
    ];
  }

  /**
   * 验证上下文
   */
  validateContext(context: IProcessingContext): boolean {
    return !!context.content && !!context.language;
  }

  /**
   * 模拟TreeSitter解析（实际实现中应该调用真实的TreeSitter服务）
   */
  private async simulateTreeSitterParse(content: string, language: string): Promise<{
    success: boolean;
    ast: any;
  }> {
    // 这是一个模拟实现，实际应该调用TreeSitter服务
    // 为了演示，我们简单地检查内容并返回模拟结果
    
    const hasFunctions = /(?:function|func|def)\s+\w+/i.test(content);
    const hasClasses = /(?:class|struct|interface)\s+\w+/i.test(content);
    
    if (!hasFunctions && !hasClasses) {
      return { success: false, ast: null };
    }
    
    // 创建模拟AST
    const ast = {
      type: 'program',
      children: []
    };
    
    return { success: true, ast };
  }

  /**
   * 提取函数（模拟实现）
   */
  private async extractFunctions(ast: any, language: string): Promise<Array<{
    name: string;
    text: string;
    location: { startLine: number; endLine: number };
  }>> {
    // 这是一个模拟实现，实际应该使用TreeSitter查询
    const functions: Array<{
      name: string;
      text: string;
      location: { startLine: number; endLine: number };
    }> = [];
    
    // 模拟提取函数
    // 实际实现中应该使用TreeSitter查询来提取函数
    
    return functions;
  }

  /**
   * 提取类（模拟实现）
   */
  private async extractClasses(ast: any, language: string): Promise<Array<{
    name: string;
    text: string;
    location: { startLine: number; endLine: number };
  }>> {
    // 这是一个模拟实现，实际应该使用TreeSitter查询
    const classes: Array<{
      name: string;
      text: string;
      location: { startLine: number; endLine: number };
    }> = [];
    
    // 模拟提取类
    // 实际实现中应该使用TreeSitter查询来提取类
    
    return classes;
  }

  /**
   * 创建降级块
   */
  private createFallbackChunks(context: IProcessingContext): CodeChunk[] {
    return [this.createChunk(
      context.content,
      1,
      context.content.split('\n').length,
      context.language || 'unknown',
      ChunkType.GENERIC,
      {
        filePath: context.filePath,
        fallback: true
      }
    )];
  }

  /**
   * 计算复杂度
   */
  protected calculateComplexity(content: string): number {
    let complexity = 0;

    // 基于代码结构计算复杂度
    complexity += (content.match(/\b(if|else|while|for|switch|case|try|catch|finally)\b/g) || []).length * 2;
    complexity += (content.match(/\b(function|method|class|interface)\b/g) || []).length * 3;
    complexity += (content.match(/[{}]/g) || []).length;
    complexity += (content.match(/[()]/g) || []).length * 0.5;

    // 基于代码长度调整
    const lines = content.split('\n').length;
    complexity += Math.log10(lines + 1) * 2;

    return Math.round(complexity);
  }

  /**
   * 获取策略配置
   */
  getConfig(): ASTStrategyConfig {
    return { ...this.config };
  }

  /**
   * 更新策略配置
   */
  updateConfig(config: Partial<ASTStrategyConfig>): void {
    this.config = { ...this.config, ...config };
  }
}