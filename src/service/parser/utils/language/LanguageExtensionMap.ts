import * as path from 'path';
import { languageMappingManager } from '../../../config/LanguageMappingManager';

/**
 * 语言扩展名映射接口
 */
export interface ILanguageExtensionMap {
  getLanguageByExtension(ext: string): string | undefined;
  getExtensionsByLanguage(language: string): string[];
  getAllSupportedLanguages(): string[];
  isLanguageSupported(language: string): boolean;
  isExtensionSupported(ext: string): boolean;
}

/**
 * 语言扩展名映射实现
 * 统一管理文件扩展名到编程语言的映射关系
 */
export class LanguageExtensionMap implements ILanguageExtensionMap {
  /**
   * 根据文件扩展名获取编程语言
   * @param ext 文件扩展名（包含点号，如 '.js'）
   * @returns 编程语言名称或undefined
   */
  getLanguageByExtension(ext: string): string | undefined {
    return languageMappingManager.getLanguageByExtension(ext);
  }

  /**
   * 根据编程语言获取所有支持的文件扩展名
   * @param language 编程语言名称
   * @returns 文件扩展名数组
   */
  getExtensionsByLanguage(language: string): string[] {
    return languageMappingManager.getExtensions(language);
  }

  /**
   * 获取所有支持的编程语言列表
   * @returns 编程语言名称数组
   */
  getAllSupportedLanguages(): string[] {
    return languageMappingManager.getAllSupportedLanguages();
  }

  /**
   * 检查指定的编程语言是否受支持
   * @param language 编程语言名称
   * @returns 是否支持
   */
  isLanguageSupported(language: string): boolean {
    return languageMappingManager.isLanguageSupported(language);
  }

  /**
   * 检查指定的文件扩展名是否受支持
   * @param ext 文件扩展名
   * @returns 是否支持
   */
  isExtensionSupported(ext: string): boolean {
    return languageMappingManager.isExtensionSupported(ext);
  }

  /**
   * 从文件路径中提取语言
   * @param filePath 文件路径
   * @returns 编程语言名称或undefined
   */
  getLanguageFromPath(filePath: string): string | undefined {
    return languageMappingManager.getLanguageByPath(filePath);
  }

  /**
   * 获取完整的扩展名到语言映射（只读）
   * @returns 扩展名到语言的映射对象
   */
  getExtensionToLanguageMap(): Readonly<Record<string, string>> {
    return languageMappingManager.getExtensionMappings();
  }

  /**
   * 获取完整的语言到扩展名映射（只读）
   * @returns 语言到扩展名的映射对象
   */
  getLanguageToExtensionsMap(): Readonly<Record<string, string[]>> {
    const mappings: Record<string, string[]> = {};
    for (const language of languageMappingManager.getAllSupportedLanguages()) {
      mappings[language] = languageMappingManager.getExtensions(language);
    }
    return mappings;
  }
}

/**
 * 单例实例，供整个应用使用
 */
export const languageExtensionMap = new LanguageExtensionMap();