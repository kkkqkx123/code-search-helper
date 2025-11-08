import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';
import { TYPES } from '../../../types';
import { IFileFeatureDetector } from './IFileFeatureDetector';
import { CODE_LANGUAGES, STRUCTURED_LANGUAGES, TREE_SITTER_SUPPORTED_LANGUAGES } from '../constants/language-constants';

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
    return ['markdown', 'text', 'log', 'ini', 'cfg', 'conf', 'toml'].includes(language.toLowerCase());
  }

  /**
   * 检查是否为Markdown
   */
  isMarkdown(language: string): boolean {
    return ['markdown', 'md'].includes(language.toLowerCase());
  }

  /**
   * 检查是否为XML类语言
   */
  isXML(language: string): boolean {
    return ['xml', 'html', 'svg', 'xhtml'].includes(language.toLowerCase());
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
   * 根据扩展名检测语言
   */
  detectLanguageByExtension(extension: string, languageMap: Record<string, string>): string {
    return languageMap[extension] || 'unknown';
  }

  /**
   * 计算内容复杂度
   */
  calculateComplexity(content: string): number {
    // 如果内容为空，返回0
    if (!content || content.trim().length === 0) {
      return 0;
    }

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
}