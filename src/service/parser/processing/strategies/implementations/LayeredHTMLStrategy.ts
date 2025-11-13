import { BaseStrategy } from '../base/BaseStrategy';
import { ProcessingResult, CodeChunk } from '../../core/types/ResultTypes';
import { StrategyConfig } from '../../types/Strategy';
import { Logger } from '../../../../../utils/logger';
import { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import { HtmlLanguageAdapter } from '../../../core/normalization/adapters/HtmlLanguageAdapter';
import { ScriptBlock, StyleBlock } from '../../../processing/utils/html/LayeredHTMLConfig';
import { HTMLContentExtractor } from '../../../processing/utils/html/HTMLContentExtractor';
import { HTMLProcessingUtils } from '../../../processing/utils/html/HTMLProcessingUtils';

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
  private logger: Logger;
  private htmlAdapter: HtmlLanguageAdapter;
  private htmlExtractor: HTMLContentExtractor;
  private scriptCache: Map<string, any> = new Map();
  private styleCache: Map<string, any> = new Map();

  constructor(config: StrategyConfig, htmlAdapter?: HtmlLanguageAdapter) {
    super(config);
    this.logger = Logger.getInstance();
    this.htmlAdapter = htmlAdapter || new HtmlLanguageAdapter();
    this.htmlExtractor = new HTMLContentExtractor();
  }

  async execute(context: IProcessingContext): Promise<ProcessingResult> {
    const startTime = Date.now();
    const chunks = await this.process(context);
    const executionTime = Date.now() - startTime;

    return {
      chunks,
      success: true,
      executionTime,
      strategy: this.name
    };
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
  async process(context: IProcessingContext): Promise<CodeChunk[]> {
    const startTime = Date.now();
    this.logger.info(`Starting layered HTML processing for ${context.filePath}`);

    try {
      // 1. 结构层处理
      const structureResult = await this.processStructureLayer(context);

      // 2. 提取嵌入式内容（使用HTMLContentExtractor以获得完整的attributes和contentHash）
      const scripts = this.htmlExtractor.extractScripts(context.content);
      const styles = this.htmlExtractor.extractStyles(context.content);

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
      this.updatePerformanceStats(processingTime, true, finalResult.chunks.length);
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
    chunks: CodeChunk[];
    metadata: any;
  }> {
    this.logger.debug('Processing HTML structure layer');

    try {
      const rawChunks = HTMLProcessingUtils.processHTMLStructure(context.content, 1);
      const chunks = rawChunks.map(chunk => 
        this.createChunk(
          chunk.content,
          chunk.startLine,
          chunk.endLine,
          chunk.language,
          undefined,
          {
            filePath: context.filePath,
            complexity: chunk.complexity,
            type: chunk.type
          }
        )
      );

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
   * 提取脚本块
   */
  private extractScripts(content: string): ScriptBlock[] {
    // 使用适配器提供的方法
    return this.htmlAdapter.extractScripts(content);
  }

  /**
   * 提取样式块
   */
  private extractStyles(content: string): StyleBlock[] {
    // 使用适配器提供的方法
    return this.htmlAdapter.extractStyles(content);
  }

  /**
   * 处理Script层
   */
  private async processScriptLayers(
    scripts: ScriptBlock[],
    context: IProcessingContext
  ): Promise<Array<{
    scriptBlock: ScriptBlock;
    chunks: CodeChunk[];
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

        // Continue processing other scripts (default behavior)

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
    chunks: CodeChunk[];
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

        // Continue processing other styles (default behavior)

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
    chunks: CodeChunk[];
    metadata: any;
  }> {
    // 生成缓存键
    const cacheKey = HTMLProcessingUtils.generateScriptCacheKey(script);

    // 检查缓存
    const cached = this.scriptCache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Using cached result for script ${script.id}`);
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          processingFromCache: true
        }
      };
    }

    // 分析脚本属性
    const scriptAnalysis = HTMLProcessingUtils.analyzeScriptAttributes(script.attributes);

    // 创建脚本代码块
    const chunks = [this.createChunk(
      script.content,
      script.position.line,
      script.position.line + script.content.split('\n').length - 1,
      script.language,
      undefined,
      {
        startLine: script.position.line,
        endLine: script.position.line + script.content.split('\n').length - 1,
        type: 'script',
        complexity: HTMLProcessingUtils.calculateComplexity(script.content),
        scriptId: script.id,
        scriptLanguage: script.language,
        scriptAttributes: script.attributes,
        contentHash: script.contentHash,
        ...scriptAnalysis
      }
    )];

    const result = {
      scriptBlock: script,
      chunks,
      metadata: {
        layer: LayerType.SCRIPT,
        processor: 'JavaScriptExtractor',
        scriptLanguage: script.language,
        chunkCount: chunks.length,
        contentSize: script.content.length,
        scriptAttributes: script.attributes,
        contentHash: script.contentHash,
        attributeCount: Object.keys(script.attributes).length,
        hasExternalSource: scriptAnalysis.hasSrc,
        processingFromCache: false,
        ...scriptAnalysis
      }
    };

    // 缓存结果
    this.scriptCache.set(cacheKey, result);

    return result;
  }

  /**
   * 处理单个Style内容
   */
  private async processStyleContent(
    style: StyleBlock,
    context: IProcessingContext
  ): Promise<{
    styleBlock: StyleBlock;
    chunks: CodeChunk[];
    metadata: any;
  }> {
    // 生成缓存键
    const cacheKey = HTMLProcessingUtils.generateStyleCacheKey(style);

    // 检查缓存
    const cached = this.styleCache.get(cacheKey);
    if (cached) {
      this.logger.debug(`Using cached result for style ${style.id}`);
      return {
        ...cached,
        metadata: {
          ...cached.metadata,
          processingFromCache: true
        }
      };
    }

    // 分析样式属性
    const styleAnalysis = HTMLProcessingUtils.analyzeStyleAttributes(style.attributes);

    // 创建样式代码块
    const chunks = [this.createChunk(
      style.content,
      style.position.line,
      style.position.line + style.content.split('\n').length - 1,
      style.styleType,
      undefined,
      {
        startLine: style.position.line,
        endLine: style.position.line + style.content.split('\n').length - 1,
        type: 'style',
        complexity: HTMLProcessingUtils.calculateComplexity(style.content),
        styleId: style.id,
        styleType: style.styleType,
        styleAttributes: style.attributes,
        contentHash: style.contentHash,
        ...styleAnalysis
      }
    )];

    const result = {
      styleBlock: style,
      chunks,
      metadata: {
        layer: LayerType.STYLE,
        processor: 'CSSExtractor',
        styleType: style.styleType,
        chunkCount: chunks.length,
        contentSize: style.content.length,
        styleAttributes: style.attributes,
        contentHash: style.contentHash,
        attributeCount: Object.keys(style.attributes).length,
        processingFromCache: false,
        ...styleAnalysis
      }
    };

    // 缓存结果
    this.styleCache.set(cacheKey, result);

    return result;
  }

  /**
   * 合并所有层的处理结果
   */
  private async mergeResults(
    structureResult: { chunks: CodeChunk[]; metadata: any },
    scriptResults: Array<{ scriptBlock: ScriptBlock; chunks: CodeChunk[]; metadata: any }>,
    styleResults: Array<{ styleBlock: StyleBlock; chunks: CodeChunk[]; metadata: any }>,
    context: IProcessingContext
  ): Promise<{
    chunks: CodeChunk[];
    metadata: any;
  }> {
    const allChunks: CodeChunk[] = [];

    // 添加所有层块（默认启用所有层）
    allChunks.push(...structureResult.chunks);

    // 添加Script块
    for (const scriptResult of scriptResults) {
      allChunks.push(...scriptResult.chunks);
    }

    // 添加Style块
    for (const styleResult of styleResults) {
      allChunks.push(...styleResult.chunks);
    }

    // 根据位置排序（默认策略）
    allChunks.sort((a, b) => {
      const aStart = a.metadata?.startLine || 0;
      const bStart = b.metadata?.startLine || 0;
      return aStart - bStart;
    });

    return {
      chunks: allChunks,
      metadata: {
        totalChunks: allChunks.length,
        structureChunks: structureResult.chunks.length,
        scriptChunks: scriptResults.reduce((sum, r) => sum + r.chunks.length, 0),
        styleChunks: styleResults.reduce((sum, r) => sum + r.chunks.length, 0),
        mergeStrategy: 'position'
      }
    };
  }

  /**
   * 创建降级块
   */
  private createFallbackChunks(context: IProcessingContext): CodeChunk[] {
    return [this.createChunk(
      context.content,
      1,
      context.content.split('\\n').length,
      context.language || 'html',
      undefined,
      {
        filePath: context.filePath,
        startLine: 1,
        endLine: context.content.split('\n').length,
        type: 'html_fallback',
        complexity: HTMLProcessingUtils.calculateComplexity(context.content),
        fallback: true
      }
    )];
  }

  /**
   * 清理缓存
   */
  public clearCache(): void {
    this.scriptCache.clear();
    this.styleCache.clear();
    this.logger.debug('Cleared HTML processing cache');
  }

  /**
   * 获取缓存统计
   */
  public getCacheStats(): { scriptCache: number; styleCache: number } {
    return {
      scriptCache: this.scriptCache.size,
      styleCache: this.styleCache.size
    };
  }
}