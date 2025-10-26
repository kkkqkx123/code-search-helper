import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';
import { IProcessingStrategy } from './IProcessingStrategy';
import { DetectionResult, ProcessingStrategyType } from '../UnifiedDetectionCenter';
import { UniversalTextSplitter } from '../UniversalTextSplitter';
import { TreeSitterService } from '../../core/parse/TreeSitterService';
import { MarkdownTextSplitter } from '../md/MarkdownTextSplitter';
import { XMLTextSplitter } from '../xml/XMLTextSplitter';

@injectable()
export class ProcessingStrategyFactory {
  private logger?: LoggerService;
  private universalTextSplitter: UniversalTextSplitter | undefined;
  private treeSitterService?: TreeSitterService;
  private markdownSplitter: MarkdownTextSplitter | undefined;
  private xmlSplitter: XMLTextSplitter | undefined;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService,
    @inject(TYPES.UniversalTextSplitter) universalTextSplitter?: UniversalTextSplitter,
    @inject(TYPES.TreeSitterService) treeSitterService?: TreeSitterService,
    @inject(TYPES.MarkdownTextSplitter) markdownSplitter?: MarkdownTextSplitter,
    @inject(TYPES.XMLTextSplitter) xmlSplitter?: XMLTextSplitter
  ) {
    this.logger = logger;
    this.universalTextSplitter = universalTextSplitter;
    this.treeSitterService = treeSitterService;
    this.markdownSplitter = markdownSplitter;
    this.xmlSplitter = xmlSplitter;
  }

  createStrategy(detection: DetectionResult): IProcessingStrategy {
    switch (detection.processingStrategy) {
      case ProcessingStrategyType.TREESITTER_AST:
        return new ASTStrategy(this.treeSitterService, this.logger);

      case ProcessingStrategyType.MARKDOWN_SPECIALIZED:
        return new MarkdownStrategy(this.markdownSplitter, this.logger);

      case ProcessingStrategyType.XML_SPECIALIZED:
        return new XMLStrategy(this.xmlSplitter, this.logger);

      case ProcessingStrategyType.UNIVERSAL_SEMANTIC_FINE:
        return new SemanticFineStrategy(this.universalTextSplitter, this.logger);

      case ProcessingStrategyType.UNIVERSAL_SEMANTIC:
        return new SemanticStrategy(this.universalTextSplitter, this.logger);

      case ProcessingStrategyType.UNIVERSAL_BRACKET:
        return new BracketStrategy(this.universalTextSplitter, this.logger);

      case ProcessingStrategyType.UNIVERSAL_LINE:
      case ProcessingStrategyType.EMERGENCY_SINGLE_CHUNK:
      default:
        return new LineStrategy(this.universalTextSplitter, this.logger);
    }
  }
}

// 具体策略实现
class ASTStrategy implements IProcessingStrategy {
  constructor(
    private treeSitterService: TreeSitterService | undefined,
    private logger?: LoggerService
  ) { }

  async execute(filePath: string, content: string, detection: DetectionResult) {
    if (!this.treeSitterService) {
      this.logger?.warn('TreeSitterService not available, falling back to semantic strategy');
      // 如果没有TreeSitterService，抛出错误以触发后备策略
      throw new Error('TreeSitterService not available');
    }

    try {
      // 检测语言支持
      const detectedLanguage = await this.treeSitterService.detectLanguage(filePath);
      if (!detectedLanguage) {
        this.logger?.warn(`Language not supported by TreeSitter for ${filePath}`);
        throw new Error(`Language not supported by TreeSitter for ${filePath}`);
      }

      this.logger?.info(`Using TreeSitter AST parsing for ${detectedLanguage.name}`);

      // 使用TreeSitter解析代码
      const parseResult = await this.treeSitterService.parseCode(content, detectedLanguage.name);

      if (!parseResult.success || !parseResult.ast) {
        this.logger?.warn(`TreeSitter parsing failed for ${filePath}`);
        throw new Error(`TreeSitter parsing failed for ${filePath}`);
      }

      // 提取函数和类定义
      const functions = await this.treeSitterService.extractFunctions(parseResult.ast);
      const classes = await this.treeSitterService.extractClasses(parseResult.ast);

      this.logger?.debug(`TreeSitter extracted ${functions.length} functions and ${classes.length} classes`);

      // 将AST节点转换为CodeChunk
      const chunks: any[] = [];

      // 处理函数定义
      for (const func of functions) {
        const location = this.treeSitterService.getNodeLocation(func);
        const funcText = this.treeSitterService.getNodeText(func, content);

        chunks.push({
          content: funcText,
          metadata: {
            startLine: location.startLine,
            endLine: location.endLine,
            language: detectedLanguage.name,
            filePath: filePath,
            type: 'function',
            complexity: this.calculateComplexity(funcText)
          }
        });
      }

      // 处理类定义
      for (const cls of classes) {
        const location = this.treeSitterService.getNodeLocation(cls);
        const clsText = this.treeSitterService.getNodeText(cls, content);

        chunks.push({
          content: clsText,
          metadata: {
            startLine: location.startLine,
            endLine: location.endLine,
            language: detectedLanguage.name,
            filePath: filePath,
            type: 'class',
            complexity: this.calculateComplexity(clsText)
          }
        });
      }

      // 如果没有提取到任何函数或类，返回空数组以触发后备策略
      if (chunks.length === 0) {
        this.logger?.info('No functions or classes found by TreeSitter');
        throw new Error('No functions or classes found by TreeSitter');
      }

      return { chunks, metadata: { strategy: 'ASTStrategy', language: detectedLanguage.name } };
    } catch (error) {
      this.logger?.error(`AST strategy failed: ${error}`);

      // 如果失败，返回一个简单的块
      return {
        chunks: [{
          content,
          metadata: {
            startLine: 1,
            endLine: content.split('\n').length,
            language: detection.language,
            filePath,
            fallback: true
          }
        }],
        metadata: { strategy: 'ASTStrategy', error: (error as Error).message }
      };
    }
  }

  getName(): string {
    return 'ASTStrategy';
  }

  getDescription(): string {
    return 'Uses TreeSitter AST parsing to extract functions and classes';
  }

  private calculateComplexity(content: string): number {
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
}

class MarkdownStrategy implements IProcessingStrategy {
  constructor(
    private markdownSplitter: MarkdownTextSplitter | undefined,
    private logger?: LoggerService
  ) { }

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.debug(`Using Markdown strategy for ${filePath}`);
    if (!this.markdownSplitter) {
      this.logger?.warn('MarkdownSplitter not available, falling back to semantic strategy');
      throw new Error('MarkdownSplitter not available');
    }
    const chunks = await this.markdownSplitter.chunkMarkdown(content, filePath);
    return { chunks, metadata: { strategy: 'MarkdownStrategy' } };
  }

  getName(): string {
    return 'MarkdownStrategy';
  }

  getDescription(): string {
    return 'Uses specialized Markdown splitting to preserve semantic structure';
  }
}

class XMLStrategy implements IProcessingStrategy {
  constructor(
    private xmlSplitter: XMLTextSplitter | undefined,
    private logger?: LoggerService
  ) { }

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.debug(`Using XML strategy for ${filePath}`);
    if (!this.xmlSplitter) {
      this.logger?.warn('XMLSplitter not available, falling back to semantic strategy');
      throw new Error('XMLSplitter not available');
    }
    const chunks = await this.xmlSplitter.chunkXML(content, filePath);
    return { chunks, metadata: { strategy: 'XMLStrategy' } };
  }

  getName(): string {
    return 'XMLStrategy';
  }

  getDescription(): string {
    return 'Uses specialized XML splitting to preserve element structure';
  }
}

class SemanticFineStrategy implements IProcessingStrategy {
  constructor(
    private universalTextSplitter: UniversalTextSplitter | undefined,
    private logger?: LoggerService
  ) { }

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.debug(`Using Semantic Fine strategy for ${filePath}`);

    if (!this.universalTextSplitter) {
      this.logger?.warn('UniversalTextSplitter not available, falling back to semantic strategy');
      throw new Error('UniversalTextSplitter not available');
    }

    // 保存原始选项
    const originalOptions = {
      maxChunkSize: this.universalTextSplitter.getOptions?.()?.maxChunkSize || 2000,
      overlapSize: this.universalTextSplitter.getOptions?.()?.overlapSize || 20,
      maxLinesPerChunk: this.universalTextSplitter.getOptions?.()?.maxLinesPerChunk || 50
    };

    try {
      // 根据内容大小调整重叠大小，小文件使用更小的重叠
      const contentLines = content.split('\n').length;
      const adjustedOverlapSize = Math.min(50, Math.max(20, contentLines * 2)); // 每行约2-50字符重叠

      // 临时设置更精细的分段参数
      this.universalTextSplitter.setOptions({
        maxChunkSize: 800, // 从2000降低到800
        maxLinesPerChunk: 20, // 从50降低到20
        overlapSize: adjustedOverlapSize,   // 动态调整重叠大小
        enableSemanticDetection: true
      });

      const chunks = await this.universalTextSplitter.chunkBySemanticBoundaries(content, filePath, detection.language);

      this.logger?.debug(`Semantic Fine strategy completed, generated ${chunks.length} chunks`);

      return { chunks };

    } catch (error) {
      this.logger?.error(`Semantic Fine strategy failed: ${error}`);
      throw error;
    } finally {
      // 恢复原始选项
      try {
        this.universalTextSplitter.setOptions({
          ...originalOptions,
          enableSemanticDetection: true
        });
      } catch (restoreError) {
        this.logger?.warn(`Failed to restore original text splitter options: ${restoreError}`);
      }
    }
  }

  getName(): string {
    return 'SemanticFineStrategy';
  }

  getDescription(): string {
    return 'Uses fine-grained semantic segmentation with adjusted parameters';
  }
}

class SemanticStrategy implements IProcessingStrategy {
  constructor(
    private universalTextSplitter: UniversalTextSplitter | undefined,
    private logger?: LoggerService
  ) { }

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.debug(`Using Semantic strategy for ${filePath}`);
    if (!this.universalTextSplitter) {
      this.logger?.warn('UniversalTextSplitter not available, falling back to line strategy');
      throw new Error('UniversalTextSplitter not available');
    }
    const chunks = await this.universalTextSplitter.chunkBySemanticBoundaries(content, filePath, detection.language);
    return { chunks };
  }

  getName(): string {
    return 'SemanticStrategy';
  }

  getDescription(): string {
    return 'Uses semantic boundary detection for code splitting';
  }
}

class BracketStrategy implements IProcessingStrategy {
  constructor(
    private universalTextSplitter: UniversalTextSplitter | undefined,
    private logger?: LoggerService
  ) { }

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.debug(`Using Bracket strategy for ${filePath}`);
    if (!this.universalTextSplitter) {
      this.logger?.warn('UniversalTextSplitter not available, falling back to line strategy');
      throw new Error('UniversalTextSplitter not available');
    }
    const chunks = await this.universalTextSplitter.chunkByBracketsAndLines(content, filePath, detection.language);
    return { chunks };
  }

  getName(): string {
    return 'BracketStrategy';
  }

  getDescription(): string {
    return 'Uses bracket and line-based splitting for structured content';
  }
}

class LineStrategy implements IProcessingStrategy {
  constructor(
    private universalTextSplitter: UniversalTextSplitter | undefined,
    private logger?: LoggerService
  ) { }

  async execute(filePath: string, content: string, detection: DetectionResult) {
    this.logger?.debug(`Using Line strategy for ${filePath}`);
    if (!this.universalTextSplitter) {
      this.logger?.warn('UniversalTextSplitter not available, falling back to simple line strategy');
      // 如果没有UniversalTextSplitter，返回一个包含全部内容的简单块
      return {
        chunks: [{
          content,
          metadata: {
            startLine: 1,
            endLine: content.split('\n').length,
            language: detection.language,
            filePath,
            fallback: true
          }
        }],
        metadata: { strategy: 'LineStrategy', error: 'UniversalTextSplitter not available' }
      };
    }
    const chunks = await this.universalTextSplitter.chunkByLines(content, filePath, detection.language);
    return { chunks };
  }

  getName(): string {
    return 'LineStrategy';
  }

  getDescription(): string {
    return 'Uses simple line-based splitting as a fallback';
  }
}