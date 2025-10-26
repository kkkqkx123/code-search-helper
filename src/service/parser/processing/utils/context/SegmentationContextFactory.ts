import { SegmentationContext, UniversalChunkingOptions } from '../../strategies/types/SegmentationTypes';
import { BLOCK_SIZE_LIMITS, SMALL_FILE_THRESHOLD } from '../constants';
import { languageExtensionMap } from '../../../utils/language/LanguageExtensionMap';

/**
 * 分段上下文工厂类
 * 职责：创建和初始化分段上下文
 */
export class SegmentationContextFactory {

  /**
   * 创建分段上下文
   */
  static create(
    content: string,
    filePath?: string,
    language?: string,
    options?: UniversalChunkingOptions
  ): SegmentationContext {
    return {
      content,
      filePath,
      language,
      options: options || this.getDefaultOptions(),
      metadata: {
        contentLength: content.length,
        lineCount: content.split('\n').length,
        isSmallFile: this.isSmallFile(content),
        isCodeFile: this.isCodeFile(language, filePath),
        isMarkdownFile: this.isMarkdownFile(language, filePath)
      }
    };
  }

  /**
   * 从现有上下文创建新的上下文（用于修改部分参数）
   */
  static fromExisting(
    existing: SegmentationContext,
    modifications: Partial<SegmentationContext>
  ): SegmentationContext {
    const newContext = {
      ...existing,
      ...modifications,
      metadata: {
        ...existing.metadata,
        ...(modifications.metadata || {})
      }
    };

    // 如果内容被修改，重新计算相关的元数据
    if (modifications.content && modifications.content !== existing.content) {
      newContext.metadata.contentLength = modifications.content.length;
      newContext.metadata.lineCount = modifications.content.split('\n').length;
      newContext.metadata.isSmallFile = this.isSmallFile(modifications.content);
    }

    return newContext;
  }

  /**
   * 获取默认选项
   */
  private static getDefaultOptions(): UniversalChunkingOptions {
    return {
      // 基础分段参数
      maxChunkSize: 2000,
      overlapSize: 200,
      maxLinesPerChunk: 100,

      // 功能开关
      enableBracketBalance: true,
      enableSemanticDetection: true,
      enableCodeOverlap: false,
      enableStandardization: true,
      standardizationFallback: true,

      // 重叠控制
      maxOverlapRatio: 0.3,

      // 错误和性能控制
      errorThreshold: 10,
      memoryLimitMB: 512,

      // 策略优先级
      strategyPriorities: {
        'markdown': 1,
        'standardization': 2,
        'semantic': 3,
        'bracket': 4,
        'line': 5
      },

      // 处理器配置
      filterConfig: {
        enableSmallChunkFilter: true,
        enableChunkRebalancing: true,
        minChunkSize: BLOCK_SIZE_LIMITS.MIN_BLOCK_CHARS,
        maxChunkSize: BLOCK_SIZE_LIMITS.MAX_BLOCK_CHARS
      },

      // 保护配置
      protectionConfig: {
        enableProtection: true,
        protectionLevel: 'medium'
      }
    };
  }

  /**
   * 检查是否是小文件
   */
  private static isSmallFile(content: string): boolean {
    const lines = content.split('\n');
    return content.length <= SMALL_FILE_THRESHOLD.CHARS || lines.length <= SMALL_FILE_THRESHOLD.LINES;
  }

  /**
   * 检查是否为代码文件（非markdown）
   */
  private static isCodeFile(language?: string, filePath?: string): boolean {
    if (language === 'markdown' || (filePath && filePath.endsWith('.md'))) {
      return false;
    }

    // 如果提供了语言，直接检查是否在代码语言列表中
    if (language) {
      const codeLanguages = [
        'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
        'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'shell',
        'html', 'css', 'scss', 'sass', 'less', 'vue', 'svelte', 'json',
        'xml', 'yaml', 'sql', 'dockerfile', 'cmake', 'perl', 'r', 'matlab',
        'lua', 'dart', 'elixir', 'erlang', 'haskell', 'ocaml', 'fsharp',
        'visualbasic', 'powershell', 'batch'
      ];
      return codeLanguages.includes(language);
    }

    // 如果没有提供语言，尝试从文件扩展名推断
    if (filePath) {
      const detectedLanguage = languageExtensionMap.getLanguageFromPath(filePath);
      if (detectedLanguage && detectedLanguage !== 'markdown' && detectedLanguage !== 'text') {
        return true;
      }
    }

    return false;
  }

  /**
   * 检查是否为Markdown文件
   */
  private static isMarkdownFile(language?: string, filePath?: string): boolean {
    return language === 'markdown' ||
      (!!(filePath && (filePath.endsWith('.md') || filePath.endsWith('.markdown'))));
  }

  /**
   * 验证上下文的有效性
   */
  static validate(context: SegmentationContext): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 检查内容是否为空
    if (!context.content || context.content.trim().length === 0) {
      errors.push('Content cannot be empty');
    }

    // 检查内容长度
    if (context.metadata.contentLength !== context.content.length) {
      errors.push('Content length mismatch in metadata');
    }

    // 检查行数
    const actualLineCount = context.content.split('\n').length;
    if (context.metadata.lineCount !== actualLineCount) {
      errors.push('Line count mismatch in metadata');
    }

    // 检查选项
    if (!context.options) {
      errors.push('Options are required');
    } else {
      if (context.options.maxChunkSize <= 0) {
        errors.push('Max chunk size must be positive');
      }

      if (context.options.overlapSize < 0) {
        errors.push('Overlap size cannot be negative');
      }

      if (context.options.maxLinesPerChunk <= 0) {
        errors.push('Max lines per chunk must be positive');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * 创建用于保护机制的上下文
   */
  static createProtectionContext(
    operation: string,
    segmentationContext: SegmentationContext,
    additionalMetadata?: Record<string, any>
  ): any {
    return {
      operation,
      filePath: segmentationContext.filePath,
      content: segmentationContext.content,
      language: segmentationContext.language,
      metadata: {
        contentLength: segmentationContext.metadata.contentLength,
        lineCount: segmentationContext.metadata.lineCount,
        isSmallFile: segmentationContext.metadata.isSmallFile,
        isCodeFile: segmentationContext.metadata.isCodeFile,
        ...additionalMetadata
      }
    };
  }
}