/**
 * 文件类型验证器
 * 专门验证不同文件类型的结构和内容
 */
import { CODE_LANGUAGES } from '../../../service/parser/constants/language-constants';

/**
 * 文件类型验证器
 */
export class FileTypeValidator {
  /**
   * 验证是否为代码文件
   * 复用 CODE_LANGUAGES 常量
   */
  static isCodeFile(language: string): boolean {
    return CODE_LANGUAGES.includes(language.toLowerCase());
  }

  /**
   * 验证是否具有Markdown结构
   */
  static hasMarkdownStructure(content: string): boolean {
    const markdownPatterns = [
      /^#{1,6}\s+/m,           // 标题
      /^\*{1,3}.+$/m,          // 列表
      /^\d+\.\s+/m,            // 有序列表
      /```[\s\S]*?```/,        // 代码块
      /^\|.*\|$/m,             // 表格
      /^\[.*\]\(.*\)$/m        // 链接
    ];

    return markdownPatterns.some(pattern => pattern.test(content));
  }

  /**
   * 验证是否具有XML结构
   */
  static hasXmlStructure(content: string): boolean {
    const xmlPatterns = [
      /<[^>]+>/,               // 标签
      /<\/[^>]+>/,             // 闭合标签
      /<[^>]+\/>/,             // 自闭合标签
      /<\?xml.*\?>/,           // XML声明
      /<!--.*-->/              // 注释
    ];

    return xmlPatterns.some(pattern => pattern.test(content));
  }

  /**
   * 验证是否具有JSON结构
   */
  static hasJsonStructure(content: string): boolean {
    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 验证是否具有YAML结构
   */
  static hasYamlStructure(content: string): boolean {
    const yamlPatterns = [
      /^\s*[\w-]+:\s*.*$/m,    // 键值对
      /^\s*-\s+.*$/m,          // 列表项
      /^\s*#[^#]*$/m,          // 注释
      /^\s*\w+:\s*\n\s+/m      // 嵌套结构
    ];

    return yamlPatterns.some(pattern => pattern.test(content));
  }


  /**
   * 验证结构是否有效（通用方法）
   */
  static isValidStructure(structure: any): boolean {
    if (!structure || typeof structure !== 'object') return false;

    // 检查必需属性
    if (!structure.type || !structure.content || !structure.location) return false;

    // 检查位置信息
    const { startLine, endLine } = structure.location;
    if (!Number.isInteger(startLine) || !Number.isInteger(endLine)) return false;
    if (startLine < 1 || endLine < startLine) return false;

    // 检查内容
    if (typeof structure.content !== 'string' || structure.content.trim().length === 0) return false;

    return true;
  }

  /**
   * 检测文件类型
   */
  static detectFileType(content: string, language?: string): string {
    // 如果提供了语言信息，优先使用
    if (language) {
      if (this.isCodeFile(language)) return 'code';
      if (language.includes('markdown') || language.includes('md')) return 'markdown';
      if (language.includes('xml') || language.includes('html')) return 'xml';
      if (language.includes('json')) return 'json';
      if (language.includes('yaml') || language.includes('yml')) return 'yaml';
    }

    // 基于内容检测
    if (this.hasJsonStructure(content)) return 'json';
    if (this.hasYamlStructure(content)) return 'yaml';
    if (this.hasMarkdownStructure(content)) return 'markdown';
    if (this.hasXmlStructure(content)) return 'xml';

    // 默认为代码文件
    return 'code';
  }

}