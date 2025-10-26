import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import { TYPES } from '../../../../types';

/**
 * 文件特征检测器
 * 统一处理文件特征检测逻辑，避免重复代码
 */
@injectable()
export class FileFeatureDetector {
  private logger?: LoggerService;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.logger = logger;
  }

  /**
   * 检查是否为代码语言
   */
  isCodeLanguage(language: string): boolean {
    const codeLanguages = [
      'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
      'go', 'rust', 'php', 'ruby', 'css', 'html', 'json', 'yaml', 'xml'
    ];
    return codeLanguages.includes(language.toLowerCase());
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
    const treeSitterLanguages = [
      'javascript', 'typescript', 'python', 'java', 'cpp', 'c', 'csharp',
      'go', 'rust', 'php', 'ruby'
    ];
    return treeSitterLanguages.includes(language.toLowerCase());
  }

  /**
   * 检查是否为结构化文件
   */
  isStructuredFile(content: string, language: string): boolean {
    // 如果是已知结构化语言，直接返回true
    const structuredLanguages = ['json', 'xml', 'html', 'yaml', 'css', 'sql'];
    if (structuredLanguages.includes(language.toLowerCase())) {
      return true;
    }

    // 检查内容是否包含大量括号或标签
    const bracketCount = (content.match(/[{}()\[\]]/g) || []).length;
    const tagCount = (content.match(/<[^>]+>/g) || []).length;
    const totalLength = content.length;

    const isStructured = (bracketCount / totalLength > 0.01) || (tagCount / totalLength > 0.005);
    
    if (isStructured) {
      this.logger?.debug(`Detected structured content: brackets=${bracketCount}, tags=${tagCount}, ratio=${(bracketCount / totalLength).toFixed(3)}`);
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