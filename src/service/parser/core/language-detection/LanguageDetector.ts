import { LanguageDetectionResult } from './types';
import { languageFeatureDetector, languageExtensionMap, fileUtils } from '../../utils';
import { ExtensionlessFileProcessor } from '../../../parser/processing/utils/ExtensionlessFileProcessor';
import { BackupFileProcessor } from '../../../parser/processing/utils/BackupFileProcessor';

/**
 * 语言特征检测器
 * 负责根据文件扩展名和内容检测编程语言
 * 
 * 重构完成：此类现在完全使用公共工具类，所有旧实现已移除
 */
export class LanguageDetector {
  private featureDetector = languageFeatureDetector;
  private extensionMap = languageExtensionMap;
  private fileUtils = fileUtils;
  private extensionlessProcessor: ExtensionlessFileProcessor;
  private backupProcessor: BackupFileProcessor;

  constructor() {
    this.extensionlessProcessor = new ExtensionlessFileProcessor();
    this.backupProcessor = new BackupFileProcessor();
  }

  /**
   * 智能语言检测 - 根据文件路径和内容推断语言
   * @param filePath 文件路径
   * @param content 代码内容（可选）
   * @returns 语言检测结果
   */
  async detectLanguage(filePath: string, content?: string): Promise<LanguageDetectionResult> {
    // 首先检查是否为备份文件
    const backupMetadata = this.backupProcessor.getBackupFileMetadata(filePath);
    if (backupMetadata.isBackup && backupMetadata.originalInfo) {
      const language = backupMetadata.originalInfo.language;
      if (language && language !== 'unknown') {
        return {
          language,
          confidence: backupMetadata.originalInfo.confidence,
          method: 'extension'
        };
      }
    }

    // 尝试通过扩展名检测
const extensionResult = await this.featureDetector.detectLanguage(filePath, content);
    if (extensionResult.language) {
      return extensionResult;
    }

    // 如果扩展名检测失败，尝试内容检测
    if (content) {
      const contentDetection = this.extensionlessProcessor.detectLanguageByContent(content);
      if (contentDetection.confidence > 0.5) {
        return {
          language: contentDetection.language,
          confidence: contentDetection.confidence,
          method: 'content'
        };
      }
    }

    return {
      language: undefined,
      confidence: 0.0,
      method: 'fallback'
    };
  }

  /**
   * 同步语言检测 - 仅基于文件扩展名
   * @param filePath 文件路径
   * @returns 编程语言名称或undefined
   */
  detectLanguageSync(filePath: string): string | undefined {
    return this.extensionMap.getLanguageFromPath(filePath);
  }

  /**
   * 获取支持的语言列表
   * @returns 支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return this.extensionMap.getAllSupportedLanguages();
  }

  /**
   * 检查语言是否支持AST解析
   * @param language 编程语言名称
   * @returns 是否支持AST解析
   */
  isLanguageSupportedForAST(language: string | undefined): boolean {
    return this.featureDetector.isLanguageSupportedForAST(language);
  }

  /**
   * 验证语言检测结果
   * @param content 代码内容
   * @param detectedLanguage 检测到的语言
   * @returns 验证结果
   */
  validateLanguageDetection(content: string, detectedLanguage: string): boolean {
    return this.featureDetector.validateLanguageDetection(content, detectedLanguage);
  }

  /**
   * 根据文件扩展名检测语言
   * @param ext 文件扩展名
   * @returns 编程语言名称或undefined
   */
  detectLanguageByExtension(ext: string): string | undefined {
    return this.extensionMap.getLanguageByExtension(ext);
  }

  /**
   * 根据内容检测语言
   * @param content 代码内容
   * @returns 语言检测结果
   */
  detectLanguageByContent(content: string): LanguageDetectionResult {
    const detection = this.extensionlessProcessor.detectLanguageByContent(content);
    if (detection.confidence > 0.5) {
      return {
        language: detection.language,
        confidence: detection.confidence,
        method: 'content'
      };
    }
    return this.featureDetector.detectLanguageByContent(content);
  }

  /**
   * 获取文件扩展名
   * @param filePath 文件路径
   * @returns 文件扩展名
   */
  getFileExtension(filePath: string): string {
    return this.fileUtils.extractFileExtension(filePath);
  }
}

// 重新导出类型以保持向后兼容
export { LanguageDetectionResult } from './types';