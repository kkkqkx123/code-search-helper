import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { LoggerService } from '../LoggerService';
import { HashUtils } from '../cache/HashUtils';
import { FileContentDetector } from '../FileContentDetector';
import { LANGUAGE_MAP } from '../../service/parser/constants/language-constants';

/**
 * 文件工具类，提供文件相关的通用功能
 */
export class FileUtils {
  /**
   * 根据文件扩展名检测语言
   */
  static detectLanguage(extension: string, supportedExtensions: string[]): string | null {
    // Use LANGUAGE_MAP from language-constants.ts instead of duplicating the mapping
    const language = LANGUAGE_MAP[extension];
    return language && supportedExtensions.includes(extension) ? language : null;
  }

  /**
   * 检查文件是否为二进制文件
   */
  static async isBinaryFile(filePath: string, logger?: LoggerService): Promise<boolean> {
    try {
      // 使用全局工具类的增强二进制检测，传入文件路径以利用扩展名检测
      const buffer = await fs.readFile(filePath, { encoding: null });
      return FileContentDetector.isBinaryContent(buffer, filePath);
    } catch (error) {
      if (logger) {
        logger.debug(`[DEBUG] Error checking if file is binary: ${filePath}`, { error: error instanceof Error ? error.message : String(error) });
      }
      return true;
    }
  }

  /**
   * 计算文件哈希值
   */
  static async calculateFileHash(filePath: string, logger?: LoggerService): Promise<string> {
    try {
      // Use HashUtils.calculateFileHash for consistent hashing across the codebase
      return await HashUtils.calculateFileHash(filePath);
    } catch (error) {
      if (logger) {
        logger.debug(`[DEBUG] Error calculating file hash: ${filePath}`, { error: error instanceof Error ? error.message : String(error) });
      }
      throw new Error(`Failed to calculate hash for ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 获取文件内容
   */
  static async getFileContent(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 获取文件扩展名（小写）
   */
  static getFileExtension(filePath: string): string {
    return path.extname(filePath).toLowerCase();
  }

  /**
   /**
    * 获取文件名（不含扩展名）
    */
  static getFileName(filePath: string): string {
    const basename = path.basename(filePath);
    const extname = path.extname(basename);
    return basename.slice(0, basename.length - extname.length);
  }
  /**
   * 获取相对路径
   */
  static getRelativePath(fromPath: string, toPath: string): string {
    return path.relative(fromPath, toPath);
  }

  /**
   * 检查文件是否存在
   */
  static async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件统计信息
   */
  static async getFileStats(filePath: string): Promise<fsSync.Stats | null> {
    try {
      return await fs.stat(filePath);
    } catch {
      return null;
    }
  }
}