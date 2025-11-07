import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import { IProcessingStrategy } from '../impl/base/IProcessingStrategy';
import { DetectionResult } from '../../detection/UnifiedDetectionService';
import { XMLTextStrategy } from '../../utils/xml/XMLTextStrategy';
import {
  LayeredHTMLConfig,
  LayeredProcessingResult,
  ScriptBlock,
  StyleBlock,
  LayerType,
  DEFAULT_LAYERED_HTML_CONFIG,
  IHTMLContentExtractor
} from '../../utils/html/LayeredHTMLConfig';
import { HTMLContentExtractor } from '../../utils/html/HTMLContentExtractor';

/**
 * HTML分层处理策略
 * 实现文档中推荐的分层处理方案
 */
@injectable()
export class LayeredHTMLStrategy implements IProcessingStrategy {
  private logger?: LoggerService;
  private xmlStrategy?: XMLTextStrategy;
  private contentExtractor: IHTMLContentExtractor;
  private config: LayeredHTMLConfig;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.XMLTextStrategy) xmlStrategy?: XMLTextStrategy,
    @inject('unmanaged') config?: Partial<LayeredHTMLConfig>
  ) {
    this.logger = logger;
    this.xmlStrategy = xmlStrategy;
    this.contentExtractor = new HTMLContentExtractor(logger);
    this.config = { ...DEFAULT_LAYERED_HTML_CONFIG, ...config };
  }

  /**
   * 执行分层处理
   */
  async execute(filePath: string, content: string, detection: DetectionResult): Promise<{
    chunks: any[];
    metadata?: any;
  }> {
    const startTime = Date.now();
    this.logger?.info(`Starting layered HTML processing for ${filePath}`);

    try {
      // 1. 结构层处理
      const structureResult = await this.processStructureLayer(content, filePath);
      
      // 2. 提取嵌入式内容
      const scripts = this.contentExtractor.extractScripts(content);
      const styles = this.contentExtractor.extractStyles(content);
      
      // 3. 处理Script和Style内容
      const scriptResults = await this.processScriptLayers(scripts, filePath);
      const styleResults = await this.processStyleLayers(styles, filePath);
      
      // 4. 合并结果
      const finalResult = await this.mergeResults(
        structureResult,
        scriptResults,
        styleResults,
        filePath
      );

      const processingTime = Date.now() - startTime;
      this.logger?.info(`Layered HTML processing completed in ${processingTime}ms`);

      return {
        chunks: finalResult.chunks,
        metadata: {
          strategy: 'LayeredHTMLStrategy',
          processingTime,
          scriptCount: scripts.length,
          styleCount: styles.length,
          hasEmbeddedContent: scripts.length > 0 || styles.length > 0,
          layers: this.config.layers.filter(layer => layer.enabled).map(layer => layer.type),
          ...finalResult.metadata
        }
      };

    } catch (error) {
      this.logger?.error(`Layered HTML processing failed: ${error}`);
      
      // 降级到XML处理
      if (this.xmlStrategy) {
        this.logger?.warn(`Falling back to XML strategy for ${filePath}`);
        try {
          const fallbackResult = await this.xmlStrategy.chunkXML(content, filePath);
          return {
            chunks: fallbackResult,
            metadata: {
              strategy: 'LayeredHTMLStrategy-Fallback',
              error: error instanceof Error ? error.message : String(error),
              fallbackUsed: true
            }
          };
        } catch (fallbackError) {
          this.logger?.error(`Fallback XML strategy also failed: ${fallbackError}`);
          throw error; // 抛出原始错误
        }
      }
      
      throw error;
    }
  }

  /**
   * 处理结构层
   */
  private async processStructureLayer(content: string, filePath: string): Promise<{
    chunks: any[];
    metadata: any;
  }> {
    if (!this.xmlStrategy) {
      throw new Error('XMLTextStrategy is required for structure layer processing');
    }

    this.logger?.debug('Processing HTML structure layer');
    
    try {
      const chunks = await this.xmlStrategy.chunkXML(content, filePath);
      
      return {
        chunks,
        metadata: {
          layer: LayerType.STRUCTURE,
          processor: 'XMLTextStrategy',
          chunkCount: chunks.length
        }
      };
    } catch (error) {
      this.logger?.error(`Structure layer processing failed: ${error}`);
      throw error;
    }
  }

  /**
   * 处理Script层
   */
  private async processScriptLayers(
    scripts: ScriptBlock[],
    filePath: string
  ): Promise<Array<{
    scriptBlock: ScriptBlock;
    chunks: any[];
    metadata: any;
  }>> {
    const results = [];
    
    for (const script of scripts) {
      try {
        this.logger?.debug(`Processing script layer: ${script.id} (${script.language})`);
        
        const scriptResult = await this.processScriptContent(script, filePath);
        results.push(scriptResult);
        
      } catch (error) {
        this.logger?.warn(`Failed to process script ${script.id}: ${error}`);
        
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
    filePath: string
  ): Promise<Array<{
    styleBlock: StyleBlock;
    chunks: any[];
    metadata: any;
  }>> {
    const results = [];
    
    for (const style of styles) {
      try {
        this.logger?.debug(`Processing style layer: ${style.id} (${style.styleType})`);
        
        const styleResult = await this.processStyleContent(style, filePath);
        results.push(styleResult);
        
      } catch (error) {
        this.logger?.warn(`Failed to process style ${style.id}: ${error}`);
        
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
    filePath: string
  ): Promise<{
    scriptBlock: ScriptBlock;
    chunks: any[];
    metadata: any;
  }> {
    // 这里应该调用相应的JavaScript/TypeScript处理器
    // 暂时创建基本的代码块
    const chunks = [{
      id: `script_${script.id}_chunk_0`,
      content: script.content,
      metadata: {
        startLine: script.position.line,
        endLine: script.position.line + script.content.split('\n').length - 1,
        language: script.language,
        filePath: `${filePath}#${script.id}`,
        type: 'script',
        scriptId: script.id,
        scriptLanguage: script.language,
        complexity: this.calculateComplexity(script.content)
      }
    }];

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
    filePath: string
  ): Promise<{
    styleBlock: StyleBlock;
    chunks: any[];
    metadata: any;
  }> {
    // 这里应该调用相应的CSS处理器
    // 暂时创建基本的代码块
    const chunks = [{
      id: `style_${style.id}_chunk_0`,
      content: style.content,
      metadata: {
        startLine: style.position.line,
        endLine: style.position.line + style.content.split('\n').length - 1,
        language: style.styleType,
        filePath: `${filePath}#${style.id}`,
        type: 'style',
        styleId: style.id,
        styleType: style.styleType,
        complexity: this.calculateComplexity(style.content)
      }
    }];

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
    structureResult: { chunks: any[]; metadata: any },
    scriptResults: Array<{ scriptBlock: ScriptBlock; chunks: any[]; metadata: any }>,
    styleResults: Array<{ styleBlock: StyleBlock; chunks: any[]; metadata: any }>,
    filePath: string
  ): Promise<{
    chunks: any[];
    metadata: any;
  }> {
    const allChunks: any[] = [];
    
    // 添加结构层块
    allChunks.push(...structureResult.chunks);
    
    // 添加Script块
    for (const scriptResult of scriptResults) {
      allChunks.push(...scriptResult.chunks);
    }
    
    // 添加Style块
    for (const styleResult of styleResults) {
      allChunks.push(...styleResult.chunks);
    }

    // 根据位置排序
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
        mergeStrategy: this.config.mergeStrategy
      }
    };
  }

  /**
   * 计算内容复杂度
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
   * 获取策略名称
   */
  getName(): string {
    return 'LayeredHTMLStrategy';
  }

  /**
   * 获取策略描述
   */
  getDescription(): string {
    return 'Uses layered processing to handle HTML structure and embedded content (scripts/styles) separately';
  }

  /**
   * 设置配置
   */
  setConfig(config: Partial<LayeredHTMLConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * 获取当前配置
   */
  getConfig(): LayeredHTMLConfig {
    return { ...this.config };
  }
}