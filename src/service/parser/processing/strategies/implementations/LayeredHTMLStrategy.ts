import { BaseStrategy } from '../base/BaseStrategy';
import { ProcessingResult, CodeChunk } from '../../core/types/ResultTypes';
import { StrategyConfig } from '../../types/Strategy';
import { Logger } from '../../../../../utils/logger';
import { IProcessingContext } from '../../core/interfaces/IProcessingContext';
import { HtmlLanguageAdapter } from '../../../core/normalization/adapters/HtmlLanguageAdapter';
import { ScriptBlock, StyleBlock } from '../../../processing/utils/html/LayeredHTMLConfig';
import { HTMLContentExtractor } from '../../../processing/utils/html/HTMLContentExtractor';

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
  private processHTMLStructure(content: string, context: IProcessingContext): CodeChunk[] {
    const chunks: CodeChunk[] = [];
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
          currentLine,
          currentLine + currentChunk.length - 1,
          context.language || 'html',
          undefined,
          {
            filePath: context.filePath,
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
        currentLine,
        currentLine + currentChunk.length - 1,
        context.language || 'html',
        undefined,
        {
          filePath: context.filePath,
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
    const cacheKey = this.generateScriptCacheKey(script);

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
    const scriptAnalysis = this.analyzeScriptAttributes(script.attributes);

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
        complexity: this.calculateComplexity(script.content),
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
    const cacheKey = this.generateStyleCacheKey(style);

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
    const styleAnalysis = this.analyzeStyleAttributes(style.attributes);

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
        complexity: this.calculateComplexity(style.content),
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
   * 计算复杂度
   */
  protected calculateComplexity(content: string): number {
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
        complexity: this.calculateComplexity(context.content),
        fallback: true
      }
    )];
  }

  /**
   * 生成脚本缓存键
   */
  private generateScriptCacheKey(script: ScriptBlock): string {
    const attrSignature = Object.keys(script.attributes)
      .sort()
      .map(key => `${key}:${script.attributes[key]}`)
      .join('|');
    return `${script.contentHash}_${script.language}_${attrSignature}`;
  }

  /**
   * 生成样式缓存键
   */
  private generateStyleCacheKey(style: StyleBlock): string {
    const attrSignature = Object.keys(style.attributes)
      .sort()
      .map(key => `${key}:${style.attributes[key]}`)
      .join('|');
    return `${style.contentHash}_${style.styleType}_${attrSignature}`;
  }

  /**
   * 分析脚本属性
   */
  private analyzeScriptAttributes(attributes: Record<string, string>) {
    return {
      isModule: attributes.type === 'module',
      isAsync: attributes.async === 'true',
      isDefer: attributes.defer === 'true',
      hasSrc: !!attributes.src,
      isTypeScript: attributes.lang === 'ts' || attributes.type?.includes('typescript'),
      isJSON: attributes.type === 'json',
      hasCrossorigin: !!attributes.crossorigin,
      isNomodule: attributes.nomodule === 'true'
    };
  }

  /**
   * 分析样式属性
   */
  private analyzeStyleAttributes(attributes: Record<string, string>) {
    return {
      isSCSS: attributes.lang === 'scss' || attributes.type?.includes('scss'),
      isLESS: attributes.lang === 'less' || attributes.type?.includes('less'),
      isInline: attributes.type === 'inline',
      hasMedia: !!attributes.media,
      hasScope: !!attributes.scoped,
      isPreprocessor: attributes.lang === 'scss' || attributes.lang === 'less' ||
        attributes.type?.includes('scss') || attributes.type?.includes('less')
    };
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