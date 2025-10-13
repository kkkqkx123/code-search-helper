import * as path from 'path';

/**
 * 文件工具接口
 */
export interface IFileUtils {
  extractFileExtension(filePath: string): string;
  normalizeExtension(ext: string): string;
  isValidExtension(ext: string): boolean;
  getFileName(filePath: string): string;
  getBaseName(filePath: string): string;
  getDirectoryName(filePath: string): string;
}

/**
 * 文件工具实现
 * 提供文件路径和扩展名处理的通用方法
 */
export class FileUtils implements IFileUtils {
  /**
   * 从文件路径中提取扩展名
   * @param filePath 文件路径
   * @returns 文件扩展名（包含点号），如果没有扩展名则返回空字符串
   */
  extractFileExtension(filePath: string): string {
    if (!filePath || typeof filePath !== 'string') {
      return '';
    }

    try {
      // 处理路径中的特殊字符和大小写
      const basename = this.getBaseName(filePath);
      const lastDot = basename.lastIndexOf('.');

      // 确保扩展名有效
      if (lastDot <= 0 || lastDot === basename.length - 1) {
        return '';
      }

      return basename.substring(lastDot).toLowerCase();
    } catch (error) {
      console.error('Failed to extract file extension:', error);
      return '';
    }
  }

  /**
   * 标准化文件扩展名
   * @param ext 文件扩展名
   * @returns 标准化后的扩展名（小写，包含点号）
   */
  normalizeExtension(ext: string): string {
    if (!ext || typeof ext !== 'string') {
      return '';
    }

    // 确保扩展名以点号开头
    let normalizedExt = ext.trim().toLowerCase();
    if (!normalizedExt.startsWith('.')) {
      normalizedExt = '.' + normalizedExt;
    }

    return normalizedExt;
  }

  /**
   * 检查扩展名是否有效
   * @param ext 文件扩展名
   * @returns 是否为有效扩展名
   */
  isValidExtension(ext: string): boolean {
    if (!ext || typeof ext !== 'string') {
      return false;
    }

    const normalizedExt = this.normalizeExtension(ext);
    
    // 基本验证：扩展名应该以点号开头，且至少有一个字符
    if (normalizedExt.length <= 1) {
      return false;
    }

    // 检查是否包含无效字符
    const validPattern = /^\.[a-zA-Z0-9_\-+]+$/;
    return validPattern.test(normalizedExt);
  }

  /**
   * 从文件路径中获取文件名（包含扩展名）
   * @param filePath 文件路径
   * @returns 文件名
   */
  getFileName(filePath: string): string {
    if (!filePath || typeof filePath !== 'string') {
      return '';
    }

    try {
      return path.basename(filePath);
    } catch (error) {
      console.error('Failed to get file name:', error);
      return '';
    }
  }

  /**
   * 从文件路径中获取基本文件名（不包含扩展名）
   * @param filePath 文件路径
   * @returns 基本文件名
   */
  getBaseName(filePath: string): string {
    if (!filePath || typeof filePath !== 'string') {
      return '';
    }

    try {
      // 处理路径中的特殊字符
      const basename = filePath.split(/[\\/]/).pop() || '';
      return basename;
    } catch (error) {
      console.error('Failed to get base name:', error);
      return '';
    }
  }

  /**
   * 从文件路径中获取目录名
   * @param filePath 文件路径
   * @returns 目录名
   */
  getDirectoryName(filePath: string): string {
    if (!filePath || typeof filePath !== 'string') {
      return '';
    }

    try {
      return path.dirname(filePath);
    } catch (error) {
      console.error('Failed to get directory name:', error);
      return '';
    }
  }

  /**
   * 检查文件路径是否为绝对路径
   * @param filePath 文件路径
   * @returns 是否为绝对路径
   */
  isAbsolutePath(filePath: string): boolean {
    if (!filePath || typeof filePath !== 'string') {
      return false;
    }

    return path.isAbsolute(filePath);
  }

  /**
   * 标准化文件路径
   * @param filePath 文件路径
   * @returns 标准化后的路径
   */
  normalizePath(filePath: string): string {
    if (!filePath || typeof filePath !== 'string') {
      return '';
    }

    try {
      return path.normalize(filePath);
    } catch (error) {
      console.error('Failed to normalize path:', error);
      return filePath;
    }
  }

  /**
   * 连接路径片段
   * @param paths 路径片段
   * @returns 连接后的路径
   */
  joinPaths(...paths: string[]): string {
    try {
      return path.join(...paths);
    } catch (error) {
      console.error('Failed to join paths:', error);
      return paths.join('/');
    }
  }

  /**
   * 获取相对路径
   * @param from 起始路径
   * @param to 目标路径
   * @returns 相对路径
   */
  getRelativePath(from: string, to: string): string {
    if (!from || !to) {
      return '';
    }

    try {
      return path.relative(from, to);
    } catch (error) {
      console.error('Failed to get relative path:', error);
      return to;
    }
  }
}

/**
 * 单例实例，供整个应用使用
 */
export const fileUtils = new FileUtils();