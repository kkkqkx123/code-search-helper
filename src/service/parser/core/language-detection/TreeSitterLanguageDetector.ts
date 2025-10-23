import { ParserLanguage } from '../parse/TreeSitterCoreService';
import { LanguageDetectionResult } from './types';
import { languageExtensionMap, fileUtils, languageFeatureDetector } from '../../utils';
import { ExtensionlessFileProcessor } from '../../../parser/universal/ExtensionlessFileProcessor';
import { BackupFileProcessor } from '../../../parser/universal/BackupFileProcessor';

/**
 * TreeSitter专用的语言检测器
 * 扩展基础语言检测器，增加TreeSitter特定的检测逻辑
 * 
 * 重构说明：此类现在使用公共工具类，减少了重复代码
 */
export class TreeSitterLanguageDetector {
  private extensionMap = languageExtensionMap;
  private fileUtils = fileUtils;
  private featureDetector = languageFeatureDetector;
  private extensionlessProcessor: ExtensionlessFileProcessor;
  private backupProcessor: BackupFileProcessor;

  constructor() {
    this.extensionlessProcessor = new ExtensionlessFileProcessor();
    this.backupProcessor = new BackupFileProcessor();
  }

  /**
   * 基于TreeSitter解析器配置的语言检测
   * @param filePath 文件路径
   * @param parsers 解析器映射
   * @param content 代码内容（可选）
   * @returns 解析器语言或null
   */
  detectLanguageByParserConfig(
    filePath: string,
    parsers: Map<string, ParserLanguage>,
    content?: string
  ): ParserLanguage | null {
    try {
      // 首先检查是否为备份文件
      const backupMetadata = this.backupProcessor.getBackupFileMetadata(filePath);
      if (backupMetadata.isBackup && backupMetadata.originalInfo) {
        const language = backupMetadata.originalInfo.language;
        if (language && language !== 'unknown') {
          const parser = parsers.get(language);
          return parser && parser.supported ? parser : null;
        }
      }

      // 1. 安全提取文件扩展名
      const ext = this.extractFileExtension(filePath);
      if (!ext) {
        // 如果没有扩展名，尝试内容检测
        if (content) {
          const contentDetection = this.extensionlessProcessor.detectLanguageByContent(content);
          if (contentDetection.confidence > 0.5) {
            const parser = parsers.get(contentDetection.language);
            return parser && parser.supported ? parser : null;
          }
        }
        return null;
      }

      // 2. 基于扩展名的初步检测
      let language = parsers.get(this.getLanguageKeyByExtension(ext));

      // 3. 基于内容的二次验证（如果提供了内容）
      if (content && language) {
        const confirmedLanguage = this.validateLanguageByContent(content, language);
        if (confirmedLanguage) {
          return confirmedLanguage;
        }
      }

      // 4. Fallback：基于内容特征检测
      if (content && !language) {
        const detectedByContent = this.detectLanguageByContentFeatures(content, parsers);
        if (detectedByContent) {
          language = detectedByContent;
        }
      }

      return language && language.supported ? language : null;
    } catch (error) {
      console.error(`Language detection failed for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * 安全的文件扩展名提取
   * @param filePath 文件路径
   * @returns 文件扩展名
   */
  private extractFileExtension(filePath: string): string {
    return this.fileUtils.extractFileExtension(filePath);
  }

  /**
   * 基于扩展名获取语言键
   * @param ext 文件扩展名
   * @returns 语言键
   */
  private getLanguageKeyByExtension(ext: string): string {
    return this.extensionMap.getLanguageByExtension(ext) || '';
  }

  /**
   * 基于内容验证语言
   * @param content 代码内容
   * @param detectedLanguage 检测到的语言
   * @returns 验证后的语言或null
   */
  private validateLanguageByContent(content: string, detectedLanguage: ParserLanguage): ParserLanguage | null {
    try {
      const contentLower = content.trim().toLowerCase();

      // 使用公共的特征检测器验证
      const isValid = this.featureDetector.validateLanguageDetection(content, detectedLanguage.name.toLowerCase());
      
      if (isValid) {
        return detectedLanguage;
      }

      return null; // 验证失败
    } catch (error) {
      console.error('Language content validation failed:', error);
      return detectedLanguage; // 验证出错时信任扩展名检测
    }
  }

  /**
   * 基于内容特征检测语言
   * @param content 代码内容
   * @param parsers 解析器映射
   * @returns 检测到的语言或null
   */
  private detectLanguageByContentFeatures(content: string, parsers: Map<string, ParserLanguage>): ParserLanguage | null {
    try {
      // 使用扩展名处理器进行内容检测
      const detectionResult = this.extensionlessProcessor.detectLanguageByContent(content);
      
      if (detectionResult.language && detectionResult.confidence > 0.5) {
        return parsers.get(detectionResult.language) || null;
      }

      return null;
    } catch (error) {
      console.error('Language detection by content features failed:', error);
      return null;
    }
  }

  /**
   * 创建扩展名到TreeSitter解析器的映射
   * @param parsers 解析器映射
   * @returns 扩展名到解析器的映射
   */
  createExtensionToParserMap(parsers: Map<string, ParserLanguage>): Map<string, ParserLanguage> {
    const extMap = new Map<string, ParserLanguage>();
    
    parsers.forEach((parser, languageKey) => {
      if (parser.supported && parser.fileExtensions) {
        parser.fileExtensions.forEach(ext => {
          extMap.set(ext.toLowerCase(), parser);
        });
      }
    });

    return extMap;
  }

  /**
   * 检查语言是否被TreeSitter支持
   * @param language 语言名称
   * @param parsers 解析器映射
   * @returns 是否支持
   */
  isLanguageSupported(language: string, parsers: Map<string, ParserLanguage>): boolean {
    const parser = parsers.get(language.toLowerCase());
    return parser ? parser.supported : false;
  }

  /**
   * 获取所有支持的语言列表
   * @param parsers 解析器映射
   * @returns 支持的语言列表
   */
  getSupportedLanguages(parsers: Map<string, ParserLanguage>): ParserLanguage[] {
    return Array.from(parsers.values()).filter(lang => lang.supported);
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
}