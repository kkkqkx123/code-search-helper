import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';
import { TYPES } from '../../../types';
import { IFileFeatureDetector, FileFeatures, DetectionResult } from './IFileFeatureDetector';
import { ComplexityCalculator } from '../../../utils/parser/ComplexityCalculator';
import { FileContentDetector, LineEndingType, IndentType } from '../../../utils/FileContentDetector';
import { syntaxPatternMatcher } from '../utils/syntax/SyntaxPatternMatcher';
import { PythonIndentChecker } from '../../../utils/structure/PythonIndentChecker';
import {
  CODE_LANGUAGES,
  STRUCTURED_LANGUAGES,
  TREE_SITTER_SUPPORTED_LANGUAGES,
  MARKDOWN_LANGUAGES,
  XML_LANGUAGES,
  TEXT_LANGUAGES
} from '../constants/language-constants';

/**
 * 统一的文件特征检测器
 * 提供依赖注入模式的文件特征检测，支持测试隔离
 */
@injectable()
export class FileFeatureDetector implements IFileFeatureDetector {
  private logger?: LoggerService;

  constructor(@inject(TYPES.LoggerService) logger?: LoggerService) {
    this.logger = logger;
    this.logger?.debug('FileFeatureDetector initialized');
  }

  /**
  * 检查是否为代码语言
  */
  isCodeLanguage(language: string): boolean {
    return CODE_LANGUAGES.includes(language.toLowerCase());
  }

  /**
   * 检查是否为文本类语言（需要智能分段的非代码文件）
   */
  isTextLanguage(language: string): boolean {
    return TEXT_LANGUAGES.includes(language.toLowerCase());
  }

  /**
   * 检查是否为Markdown
   */
  isMarkdown(language: string): boolean {
    return MARKDOWN_LANGUAGES.includes(language.toLowerCase());
  }

  /**
   * 检查是否为XML类语言
   */
  isXML(language: string): boolean {
    return XML_LANGUAGES.includes(language.toLowerCase());
  }

  /**
  * 检查是否可以使用TreeSitter
  */
  canUseTreeSitter(language: string): boolean {
    return TREE_SITTER_SUPPORTED_LANGUAGES.includes(language.toLowerCase());
  }

  /**
  * 检查是否为结构化文件
  */
  isStructuredFile(content: string, language: string): boolean {
    // 如果是已知结构化语言，直接返回true
    if (STRUCTURED_LANGUAGES.includes(language.toLowerCase())) {
      return true;
    }

    // 检查内容是否包含大量括号或标签
    const bracketCount = (content.match(/[{}()\[\]]/g) || []).length;
    const tagCount = (content.match(/<[^>]+>/g) || []).length;
    const totalLength = content.length;

    const isStructured = (bracketCount / totalLength > 0.01) || (tagCount / totalLength > 0.005);

    if (isStructured) {
      this.logger?.debug(`Detected structured content: brackets=${bracketCount}, tags=${tagCount}, ratio=${(bracketCount / totalLength).toFixed(3)}`, {
        brackets: bracketCount,
        tags: tagCount,
        ratio: bracketCount / totalLength
      });
    }

    return isStructured;
  }

  /**
   * 检查是否为高度结构化文件
   * 与isStructuredFile方法功能相同，保持兼容性
   */
  isHighlyStructured(content: string, language: string): boolean {
    return this.isStructuredFile(content, language);
  }


  /**
   * 计算内容复杂度
   */
  calculateComplexity(content: string): number {
    // 使用 ComplexityCalculator 进行复杂度计算
    return ComplexityCalculator.calculateCodeComplexity(content).score;
  }

  /**
   * 检查文件大小是否为小文件
   */
  isSmallFile(content: string, threshold: number = 1000): boolean {
    return content.length < threshold;
  }

  /**
   * 检查内容是否有导入语句
   */
  hasImports(content: string, language: string): boolean {
    const importPatterns: Record<string, RegExp> = {
      typescript: /import\s+|require\s*\(/,
      javascript: /import\s+|require\s*\(/,
      python: /import\s+|from\s+.*\s+import/,
      java: /import\s+/,
      go: /import\s+/,
      rust: /use\s+/,
      c: /#include/,
      cpp: /#include|using\s+namespace/
    };

    const pattern = importPatterns[language.toLowerCase()];
    return pattern ? pattern.test(content) : /import\s+|from\s+.*import|require\s*\(|#include|use\s+/.test(content);
  }

  /**
   * 检查内容是否有导出语句
   */
  hasExports(content: string, language: string): boolean {
    const exportPatterns: Record<string, RegExp> = {
      typescript: /export\s+/,
      javascript: /export\s+|module\.exports/,
      python: /__all__\s*=/
    };

    const pattern = exportPatterns[language.toLowerCase()];
    return pattern ? pattern.test(content) : /export\s+|module\.exports|__all__\s*=/.test(content);
  }

  /**
   * 检查内容是否有函数定义
   */
  hasFunctions(content: string, language: string): boolean {
    const functionPatterns: Record<string, RegExp> = {
      typescript: /function\s+\w+|=>\s*\{|const\s+\w+\s*=\s*\(/,
      javascript: /function\s+\w+|=>\s*\{|const\s+\w+\s*=\s*\(/,
      python: /def\s+\w+/,
      java: /\w+\s+\w+\s*\([^)]*\)\s*\{/,
      go: /func\s+\w+/,
      rust: /fn\s+\w+/
    };

    const pattern = functionPatterns[language.toLowerCase()];
    return pattern ? pattern.test(content) : /function\s+\w+|def\s+\w+|func\s+\w+|fn\s+\w+|=>\s*\{|const\s+\w+\s*=\s*\(/.test(content);
  }

  /**
   * 检查内容是否有类定义
   */
  hasClasses(content: string, language: string): boolean {
    const classPatterns: Record<string, RegExp> = {
      typescript: /class\s+\w+/,
      javascript: /class\s+\w+/,
      python: /class\s+\w+/,
      java: /class\s+\w+/,
      go: /type\s+\w+\s+struct/,
      rust: /struct\s+\w+/
    };

    const pattern = classPatterns[language.toLowerCase()];
    return pattern ? pattern.test(content) : /class\s+\w+|type\s+\w+\s+struct|struct\s+\w+/.test(content);
  }

  /**
   * 获取文件的基本统计信息
   */
  getFileStats(content: string): {
    contentLength: number;
    lineCount: number;
    bracketCount: number;
    tagCount: number;
    complexity: number;
  } {
    const lines = content.split('\n');
    const bracketCount = (content.match(/[{}()\[\]]/g) || []).length;
    const tagCount = (content.match(/<[^>]+>/g) || []).length;

    return {
      contentLength: content.length,
      lineCount: lines.length,
      bracketCount,
      tagCount,
      complexity: this.calculateComplexity(content)
    };
  }
  /**
   * 检查是否为二进制内容
   * 使用增强的检测算法，包括UTF-8验证、魔数检测和扩展名检测
   *
   * @param content 文件内容
   * @param filePath 文件路径（可选，用于更准确的检测）
   * @returns 是否为二进制文件
   */
  isBinaryContent(content: string, filePath?: string): boolean {
    return FileContentDetector.isBinaryContent(content, filePath);
  }

  /**
   * 检查是否为代码内容
   */
  isCodeContent(content: string): boolean {
    // 使用 SyntaxPatternMatcher 进行代码检测
    const result = syntaxPatternMatcher.detectLanguageByContent(content);
    return result.language !== undefined && result.confidence > 0.3;
  }

  /**
   * 检测换行符类型
   */
  detectLineEndingType(content: string): LineEndingType {
    // 使用全局工具类的换行符检测
    return FileContentDetector.detectLineEndingType(content);
  }

  /**
   * 检测缩进类型
   */
  detectIndentationType(content: string): { type: IndentType; size: number } {
    // 直接使用 PythonIndentChecker 进行缩进检测
    const indentStyle = PythonIndentChecker.detectIndentStyle(content);
    
    // 转换为接口期望的格式
    let type: IndentType;
    switch (indentStyle.type) {
      case 'spaces':
        type = IndentType.SPACES;
        break;
      case 'tabs':
        type = IndentType.TABS;
        break;
      case 'mixed':
        type = IndentType.MIXED;
        break;
      default:
        type = IndentType.NONE;
    }
    
    return {
      type,
      size: indentStyle.size
    };
  }

  /**
   * 分析文件特征
   */
  analyzeFileFeatures(content: string, language: string): FileFeatures {
    const stats = this.getFileStats(content);

    return {
      isCodeFile: this.isCodeLanguage(language) || this.isCodeContent(content),
      isTextFile: this.isTextLanguage(language),
      isMarkdownFile: this.isMarkdown(language),
      isXMLFile: this.isXML(language),
      isStructuredFile: this.isStructuredFile(content, language),
      isHighlyStructured: this.isHighlyStructured(content, language),
      complexity: stats.complexity,
      lineCount: stats.lineCount,
      size: stats.contentLength,
      hasImports: this.hasImports(content, language),
      hasExports: this.hasExports(content, language),
      hasFunctions: this.hasFunctions(content, language),
      hasClasses: this.hasClasses(content, language)
    };
  }

  /**
   * 推荐处理策略
   */
  recommendProcessingStrategy(
    detectionResult: DetectionResult,
    fileFeatures: FileFeatures,
    filePath?: string,
    content?: string | Buffer
  ): string {
    const { language } = detectionResult;

    // 使用增强的二进制检测方法
    // 如果提供了内容，使用增强检测；否则回退到基础检测
    let isBinary = false;
    if (content) {
      isBinary = this.isBinaryContent(content as string, filePath);
    } else {
      // 回退到原有的检测逻辑
      isBinary = language === 'binary' || !fileFeatures.isTextFile;
    }

    // 如果是二进制内容，使用紧急单块处理
    if (isBinary) {
      return 'binary';
    }

    // 如果是Markdown，使用专门的Markdown处理
    if (fileFeatures.isMarkdownFile) {
      return 'markdown';
    }

    // 如果是XML类语言，使用专门的XML处理
    if (fileFeatures.isXMLFile) {
      return 'xml';
    }

    // 如果是HTML，使用分层处理
    if (language === 'html') {
      return 'html';
    }

    // 如果可以使用TreeSitter且是代码文件，使用AST处理
    if (this.canUseTreeSitter(language) && fileFeatures.isCodeFile) {
      return 'ast';
    }

    // 如果是高度结构化的代码文件，使用语义处理
    if (fileFeatures.isHighlyStructured && fileFeatures.isCodeFile) {
      return 'semantic';
    }

    // 如果是结构化文件，使用语义处理
    if (fileFeatures.isStructuredFile) {
      return 'semantic';
    }

    // 如果是代码文件，使用括号处理
    if (fileFeatures.isCodeFile) {
      return 'bracket';
    }

    // 如果是文本文件，使用行处理
    if (fileFeatures.isTextFile) {
      return 'line';
    }

    // 默认使用通用文本处理
    return 'text';
  }

  /**
   * 创建默认文件特征
   */
  createDefaultFileFeatures(content: string): FileFeatures {
    const stats = this.getFileStats(content);

    return {
      isCodeFile: this.isCodeContent(content),
      isTextFile: true, // 默认认为是文本文件
      isMarkdownFile: false,
      isXMLFile: false,
      isStructuredFile: false,
      isHighlyStructured: false,
      complexity: stats.complexity,
      lineCount: stats.lineCount,
      size: stats.contentLength,
      hasImports: false,
      hasExports: false,
      hasFunctions: false,
      hasClasses: false
    };
  }

  /**
   * 创建回退检测结果
   */
  createFallbackResult(filePath: string, content: string): DetectionResult {
    const fileFeatures = this.createDefaultFileFeatures(content);

    return {
      language: 'unknown',
      detectionMethod: 'extension',
      fileType: 'unknown',
      filePath: filePath,
      metadata: {
        originalExtension: this.getFileExtension(filePath),
        overrideReason: 'fallback_result',
        fileFeatures: fileFeatures,
        processingStrategy: this.recommendProcessingStrategy(
          { language: 'unknown', detectionMethod: 'extension' } as DetectionResult,
          fileFeatures
        )
      }
    };
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot !== -1 ? filePath.substring(lastDot).toLowerCase() : '';
  }
}