import { BaseStrategy } from '../base/BaseStrategy';
import { IProcessingContext, ICodeChunk, IStrategyConfig } from '../../types/Strategy';
import { Logger } from '../../../../../../../utils/Logger';

/**
 * HTML分层处理策略配置
 */
export interface LayeredHTMLConfig extends IStrategyConfig {
  /** 启用的层类型 */
  enabledLayers?: string[];
  /** 错误处理模式 */
  errorHandling?: 'fail-fast' | 'continue';
  /** 合并策略 */
  mergeStrategy?: 'position' | 'type';
}

/**
 * 脚本块
 */
export interface ScriptBlock {
  id: string;
  content: string;
  language: string;
  position: { line: number; column: number };
}

/**
 * 样式块
 */
export interface StyleBlock {
  id: string;
  content: string;
  styleType: string;
  position: { line: number; column: number };
}

/**
 * 层类型
 */
export enum LayerType {
  STRUCTURE = 'structure',
  SCRIPT = 'script',
  STYLE = 'style'
}

/**
 * HTML分层处理策略
 * 实现文档中推荐的分层处理方案
 */
export class LayeredHTMLStrategy extends BaseStrategy {
  private config: LayeredHTMLConfig;
  private logger: Logger;

  constructor(config: LayeredHTMLConfig = {}) {
    super('layered-html', 'Layered HTML Processing Strategy');
    this.config = {
      enabledLayers: [LayerType.STRUCTURE, LayerType.SCRIPT, LayerType.STYLE],
      errorHandling: 'continue',
      mergeStrategy: 'position',
      ...config
    };
    this.logger = Logger.getInstance();
  }

  /**
   * 检查是否可以处理指定的上下文
   */
  canHandle(context: IProcessingContext): boolean {
    const { language, content } = context;
    
    // 只处理HTML文件
    if (!language || !['html', 'htm'].includes(language.toLowerCase())) {
      return false;
    }
    
    // 检查内容是否包含HTML结构
    return /<[^>]+>/.test(content);
  }

  /**
   * 执行分段处理
   */
  async process(context: IProcessingContext): Promise<ICodeChunk[]> {
    const startTime = Date.now();
    this.logger.info(`Starting layered HTML processing for ${context.filePath}`);

    try {
      // 1. 结构层处理
      const structureResult = await this.processStructureLayer(context);
      
      // 2. 提取嵌入式内容
      const scripts = this.extractScripts(context.content);
      const styles = this.extractStyles(context.content);
      
      // 3. 处理Script和Style内容
      const scriptResults = await this.processScriptLayers(scripts, context);
      const styleResults = await this.processStyleLayers(styles, context);
      
      // 4. 合并结果
      const finalResult = await this.mergeResults(
        structureResult,
        scriptResults,
        styleResults,
        context
      );

      const processingTime = Date.now() - startTime;
      this.updatePerformanceStats(processingTime, finalResult.chunks.length);
      this.logger.info(`Layered HTML processing completed in ${processingTime}ms`);

      return finalResult.chunks;
    } catch (error) {
      this.logger.error(`Layered HTML processing failed: ${error}`);
      
      // 降级到简单的HTML处理
      this.logger.warn(`Falling back to simple HTML processing for ${context.filePath}`);
      return this.createFallbackChunks(context);
    }
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return ['html', 'htm'];
  }

  /**
   * 处理结构层
   */
  private async processStructureLayer(context: IProcessingContext): Promise<{
    chunks: ICodeChunk[];
    metadata: any;
  }> {
    this.logger.debug('Processing HTML structure layer');
    
    try {
      const chunks = this.processHTMLStructure(context.content, context);
      
      return {
        chunks,
        metadata: {
          layer: LayerType.STRUCTURE,
          processor: 'HTMLStructureProcessor',
          chunkCount: chunks.length
        }
      };
    } catch (error) {
      this.logger.error(`Structure layer processing failed: ${error}`);
      throw error;
    }
  }

  /**
   * 处理HTML结构
   */
  private processHTMLStructure(content: string, context: IProcessingContext): ICodeChunk[] {
    const chunks: ICodeChunk[] = [];
    const lines = content.split('\n');
    
    // 简单的HTML结构分段，基于标签平衡
    let currentChunk: string[] = [];
    let currentLine = 1;
    let tagDepth = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      currentChunk.push(line);
      
      // 计算标签深度
      tagDepth += this.countOpeningTags(line);
      tagDepth -= this.countClosingTags(line);
      
      // 分段条件：标签平衡且达到最小大小
      const chunkContent = currentChunk.join('\n');
      const shouldSplit = (tagDepth === 0 && currentChunk.length >= 5) ||
                         chunkContent.length > 2000 ||
                         i === lines.length - 1;
      
      if (shouldSplit) {
        chunks.push(this.createChunk(
          chunkContent,
          context,
          {
            startLine: currentLine,
            endLine: currentLine + currentChunk.length - 1,
            type: 'html_structure',
            complexity: this.calculateComplexity(chunkContent)
          }
        ));
        
        currentChunk = [];
        currentLine = i + 1;
        tagDepth = 0;
      }
    }
    
    // 处理剩余内容
    if (currentChunk.length > 0) {
      const chunkContent = currentChunk.join('\n');
      chunks.push(this.createChunk(
        chunkContent,
        context,
        {
          startLine: currentLine,
          endLine: currentLine + currentChunk.length - 1,
          type: 'html_structure',
          complexity: this.calculateComplexity(chunkContent)
        }
      ));
    }
    
    return chunks;
  }

  /**
   * 提取脚本块
   */
  private extractScripts(content: string): ScriptBlock[] {
    const scripts: ScriptBlock[] = [];
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let id = 0;
    
    while ((match = scriptRegex.exec(content)) !== null) {
      const fullMatch = match[0];
      const scriptContent = match[1];
      const position = this.findPosition(content, match.index);
      
      // 检测脚本语言
      const language = this.detectScriptLanguage(fullMatch);
      
      scripts.push({
        id: `script_${id++}`,
        content: scriptContent,
        language,
        position
      });
    }
    
    return scripts;
  }

  /**
   * 提取样式块
   */
  private extractStyles(content: string): StyleBlock[] {
    const styles: StyleBlock[] = [];
    const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
    let match;
    let id = 0;
    
    while ((match = styleRegex.exec(content)) !== null) {
      const fullMatch = match[0];
      const styleContent = match[1];
      const position = this.findPosition(content, match.index);
      
      // 检测样式类型
      const styleType = this.detectStyleType(fullMatch);
      
      styles.push({
        id: `style_${id++}`,
        content: styleContent,
        styleType,
        position
      });
    }
    
    return styles;
  }

  /**
   * 处理Script层
   */
  private async processScriptLayers(
    scripts: ScriptBlock[],
    context: IProcessingContext
  ): Promise<Array<{
    scriptBlock: ScriptBlock;
    chunks: ICodeChunk[];
    metadata: any;
  }>> {
    const results = [];
    
    for (const script of scripts) {
      try {
        this.logger.debug(`Processing script layer: ${script.id} (${script.language})`);
        
        const scriptResult = await this.processScriptContent(script, context);
        results.push(scriptResult);
        
      } catch (error) {
        this.logger.warn(`Failed to process script ${script.id}: ${error}`);
        
        if (this.config.errorHandling === 'fail-fast') {
          throw error;
        }
        
        // 继续处理其他script，但记录错误
        results.push({
          scriptBlock: script,
          chunks: [],
          metadata: {
            layer: LayerType.SCRIPT,
            processor: 'JavaScriptExtractor',
            error: error instanceof Error ? error.message : String(error),
            processingFailed: true
          }
        });
      }
    }
    
    return results;
  }

  /**
   * 处理Style层
   */
  private async processStyleLayers(
    styles: StyleBlock[],
    context: IProcessingContext
  ): Promise<Array<{
    styleBlock: StyleBlock;
    chunks: ICodeChunk[];
    metadata: any;
  }>> {
    const results = [];
    
    for (const style of styles) {
      try {
        this.logger.debug(`Processing style layer: ${style.id} (${style.styleType})`);
        
        const styleResult = await this.processStyleContent(style, context);
        results.push(styleResult);
        
      } catch (error) {
        this.logger.warn(`Failed to process style ${style.id}: ${error}`);
        
        if (this.config.errorHandling === 'fail-fast') {
          throw error;
        }
        
        // 继续处理其他style，但记录错误
        results.push({
          styleBlock: style,
          chunks: [],
          metadata: {
            layer: LayerType.STYLE,
            processor: 'CSSExtractor',
            error: error instanceof Error ? error.message : String(error),
            processingFailed: true
          }
        });
      }
    }
    
    return results;
  }

  /**
   * 处理单个Script内容
   */
  private async processScriptContent(
    script: ScriptBlock,
    context: IProcessingContext
  ): Promise<{
    scriptBlock: ScriptBlock;
    chunks: ICodeChunk[];
    metadata: any;
  }> {
    // 创建脚本代码块
    const chunks = [this.createChunk(
      script.content,
      {
        ...context,
        filePath: `${context.filePath}#${script.id}`,
        language: script.language
      },
      {
        startLine: script.position.line,
        endLine: script.position.line + script.content.split('\n').length - 1,
        type: 'script',
        complexity: this.calculateComplexity(script.content),
        scriptId: script.id,
        scriptLanguage: script.language
      }
    )];

    return {
      scriptBlock: script,
      chunks,
      metadata: {
        layer: LayerType.SCRIPT,
        processor: 'JavaScriptExtractor',
        scriptLanguage: script.language,
        chunkCount: chunks.length,
        contentSize: script.content.length
      }
    };
  }

  /**
   * 处理单个Style内容
   */
  private async processStyleContent(
    style: StyleBlock,
    context: IProcessingContext
  ): Promise<{
    styleBlock: StyleBlock;
    chunks: ICodeChunk[];
    metadata: any;
  }> {
    // 创建样式代码块
    const chunks = [this.createChunk(
      style.content,
      {
        ...context,
        filePath: `${context.filePath}#${style.id}`,
        language: style.styleType
      },
      {
        startLine: style.position.line,
        endLine: style.position.line + style.content.split('\n').length - 1,
        type: 'style',
        complexity: this.calculateComplexity(style.content),
        styleId: style.id,
        styleType: style.styleType
      }
    )];

    return {
      styleBlock: style,
      chunks,
      metadata: {
        layer: LayerType.STYLE,
        processor: 'CSSExtractor',
        styleType: style.styleType,
        chunkCount: chunks.length,
        contentSize: style.content.length
      }
    };
  }

  /**
   * 合并所有层的处理结果
   */
  private async mergeResults(
    structureResult: { chunks: ICodeChunk[]; metadata: any },
    scriptResults: Array<{ scriptBlock: ScriptBlock; chunks: ICodeChunk[]; metadata: any }>,
    styleResults: Array<{ styleBlock: StyleBlock; chunks: ICodeChunk[]; metadata: any }>,
    context: IProcessingContext
  ): Promise<{
    chunks: ICodeChunk[];
    metadata: any;
  }> {
    const allChunks: ICodeChunk[] = [];
    
    // 添加结构层块
    if (this.config.enabledLayers?.includes(LayerType.STRUCTURE)) {
      allChunks.push(...structureResult.chunks);
    }
    
    // 添加Script块
    if (this.config.enabledLayers?.includes(LayerType.SCRIPT)) {
      for (const scriptResult of scriptResults) {
        allChunks.push(...scriptResult.chunks);
      }
    }
    
    // 添加Style块
    if (this.config.enabledLayers?.includes(LayerType.STYLE)) {
      for (const styleResult of styleResults) {
        allChunks.push(...styleResult.chunks);
      }
    }

    // 根据位置排序
    if (this.config.mergeStrategy === 'position') {
      allChunks.sort((a, b) => {
        const aStart = a.metadata?.startLine || 0;
        const bStart = b.metadata?.startLine || 0;
        return aStart - bStart;
      });
    }

    return {
      chunks: allChunks,
      metadata: {
        totalChunks: allChunks.length,
        structureChunks: structureResult.chunks.length,
        scriptChunks: scriptResults.reduce((sum, r) => sum + r.chunks.length, 0),
        styleChunks: styleResults.reduce((sum, r) => sum + r.chunks.length, 0),
        mergeStrategy: this.config.mergeStrategy
      }
    };
  }

  /**
   * 计算开标签数量
   */
  private countOpeningTags(line: string): number {
    const matches = line.match(/<[^\/][^>]*>/g);
    return matches ? matches.length : 0;
  }

  /**
   * 计算闭标签数量
   */
  private countClosingTags(line: string): number {
    const matches = line.match(/<\/[^>]*>/g);
    return matches ? matches.length : 0;
  }

  /**
   * 查找文本位置
   */
  private findPosition(content: string, index: number): { line: number; column: number } {
    const before = content.substring(0, index);
    const lines = before.split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1
    };
  }

  /**
   * 检测脚本语言
   */
  private detectScriptLanguage(scriptTag: string): string {
    const typeMatch = scriptTag.match(/type=["']([^"']+)["']/);
    if (typeMatch) {
      const type = typeMatch[1];
      if (type.includes('typescript')) return 'typescript';
      if (type.includes('javascript')) return 'javascript';
    }
    
    const langMatch = scriptTag.match(/lang=["']([^"']+)["']/);
    if (langMatch) {
      return langMatch[1];
    }
    
    return 'javascript'; // 默认
  }

  /**
   * 检测样式类型
   */
  private detectStyleType(styleTag: string): string {
    const typeMatch = styleTag.match(/type=["']([^"']+)["']/);
    if (typeMatch) {
      return typeMatch[1];
    }
    
    return 'css'; // 默认
  }

  /**
   * 计算复杂度
   */
  private calculateComplexity(content: string): number {
    let complexity = 1;
    
    // 基于长度
    complexity += Math.log10(content.length + 1);
    
    // 基于行数
    const lines = content.split('\n').length;
    complexity += Math.log10(lines + 1);
    
    // 基于关键字数量（简单实现）
    const keywords = content.match(/\b(function|class|const|let|var|if|for|while|return|import|export)\b/g);
    if (keywords) {
      complexity += keywords.length * 0.5;
    }
    
    return Math.round(Math.max(1, complexity));
  }

  /**
   * 创建降级块
   */
  private createFallbackChunks(context: IProcessingContext): ICodeChunk[] {
    return [this.createChunk(
      context.content,
      context,
      {
        startLine: 1,
        endLine: context.content.split('\n').length,
        type: 'html_fallback',
        complexity: this.calculateComplexity(context.content),
        fallback: true
      }
    )];
  }

  /**
   * 获取策略配置
   */
  getConfig(): LayeredHTMLConfig {
    return { ...this.config };
  }

  /**
   * 更新策略配置
   */
  updateConfig(config: Partial<LayeredHTMLConfig>): void {
    this.config = { ...this.config, ...config };
  }
}