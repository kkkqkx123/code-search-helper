import { LineEndingType, IndentType } from '../../../utils/FileContentDetector';

/**
 * 文件特征检测器接口
 * 定义文件特征检测的抽象接口
 */
export interface IFileFeatureDetector {
  /**
   * 检查是否为代码语言
   * @param language 语言名称
   * @returns 是否为代码语言
   */
  isCodeLanguage(language: string): boolean;

  /**
   * 检查是否为文本类语言
   * @param language 语言名称
   * @returns 是否为文本类语言
   */
  isTextLanguage(language: string): boolean;

  /**
   * 检查是否为Markdown
   * @param language 语言名称
   * @returns 是否为Markdown
   */
  isMarkdown(language: string): boolean;

  /**
   * 检查是否为XML类语言
   * @param language 语言名称
   * @returns 是否为XML类语言
   */
  isXML(language: string): boolean;

  /**
   * 检查是否可以使用TreeSitter
   * @param language 语言名称
   * @returns 是否可以使用TreeSitter
   */
  canUseTreeSitter(language: string): boolean;

  /**
   * 检查是否为结构化文件
   * @param content 文件内容
   * @param language 语言名称
   * @returns 是否为结构化文件
   */
  isStructuredFile(content: string, language: string): boolean;

  /**
   * 检查是否为高度结构化文件
   * @param content 文件内容
   * @param language 语言名称
   * @returns 是否为高度结构化文件
   */
  isHighlyStructured(content: string, language: string): boolean;

  /**
   * 计算内容复杂度
   * @param content 文件内容
   * @returns 复杂度数值
   */
  calculateComplexity(content: string): number;

  /**
   * 检查内容是否有导入语句
   * @param content 文件内容
   * @param language 语言名称
   * @returns 是否有导入语句
   */
  hasImports(content: string, language: string): boolean;

  /**
   * 检查内容是否有导出语句
   * @param content 文件内容
   * @param language 语言名称
   * @returns 是否有导出语句
   */
  hasExports(content: string, language: string): boolean;

  /**
   * 检查内容是否有函数定义
   * @param content 文件内容
   * @param language 语言名称
   * @returns 是否有函数定义
   */
  hasFunctions(content: string, language: string): boolean;

  /**
   * 检查内容是否有类定义
   * @param content 文件内容
   * @param language 语言名称
   * @returns 是否有类定义
   */
  hasClasses(content: string, language: string): boolean;

  /**
   * 检查是否为二进制内容
   * @param content 文件内容
   * @returns 是否为二进制内容
   */
  isBinaryContent(content: string): boolean;

  /**
   * 检查是否为代码内容
   * @param content 文件内容
   * @returns 是否为代码内容
   */
  isCodeContent(content: string): boolean;

  /**
   * 检测换行符类型
   * @param content 文件内容
   * @returns 换行符类型
   */
  detectLineEndingType(content: string): LineEndingType;

  /**
   * 检测缩进类型
   * @param content 文件内容
   * @returns 缩进类型和大小
   */
  detectIndentationType(content: string): { type: IndentType; size: number };
  /**
   * 获取文件的基本统计信息
   * @param content 文件内容
   * @returns 文件统计信息
   */
  getFileStats(content: string): {
    contentLength: number;
    lineCount: number;
    bracketCount: number;
    tagCount: number;
    complexity: number;
  };
}