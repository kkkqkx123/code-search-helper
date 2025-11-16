/**
 * 文本处理工具函数
 */
export class TextUtils {
  /**
   * 清理注释文本
   */
  static cleanCommentText(text: string): string {
    return text
      .replace(/^\s*\/\//gm, '')           // 移除行注释标记
      .replace(/^\s*\/\*/gm, '')           // 移除块注释开始标记
      .replace(/^\s*\*\/\s*$/gm, '')        // 移除块注释结束标记
      .replace(/^\s*\*/gm, '')             // 移除块注释行标记
      .trim();
  }

  /**
   * 提取注释的第一行
   */
  static getFirstLine(text: string): string {
    return text.split('\n')[0].trim();
  }

  /**
   * 检查是否为空注释
   */
  static isEmpty(text: string): boolean {
    return !text || !text.trim() || /^\s*[\/*]+\s*$/.test(text);
 }

  /**
   * 截断文本
   */
  static truncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }
}