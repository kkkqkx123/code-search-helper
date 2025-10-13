import * as path from 'path';

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
  private static readonly EXTENSION_TO_LANGUAGE: Record<string, string> = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.jsx': 'javascript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.c++': 'cpp',
    '.c': 'c',
    '.h': 'c',  // C头文件
    '.hpp': 'cpp', // C++头文件
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.php': 'php',
    '.rb': 'ruby',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.md': 'markdown',
    '.txt': 'text',
    '.json': 'json',
    '.xml': 'xml',
    '.yaml': 'yaml',
    '.yml': 'yaml',
    '.sql': 'sql',
    '.sh': 'shell',
    '.bash': 'shell',
    '.zsh': 'shell',
    '.fish': 'shell',
    '.html': 'html',
    '.css': 'css',
    '.scss': 'scss',
    '.sass': 'sass',
    '.less': 'less',
    '.vue': 'vue',
    '.svelte': 'svelte'
  };

  private static readonly LANGUAGE_TO_EXTENSIONS: Record<string, string[]> = {
    'javascript': ['.js', '.jsx'],
    'typescript': ['.ts', '.tsx'],
    'python': ['.py'],
    'java': ['.java'],
    'cpp': ['.cpp', '.cc', '.cxx', '.c++', '.hpp'],
    'c': ['.c', '.h'],
    'csharp': ['.cs'],
    'go': ['.go'],
    'rust': ['.rs'],
    'php': ['.php'],
    'ruby': ['.rb'],
    'swift': ['.swift'],
    'kotlin': ['.kt'],
    'scala': ['.scala'],
    'markdown': ['.md'],
    'text': ['.txt'],
    'json': ['.json'],
    'xml': ['.xml'],
    'yaml': ['.yaml', '.yml'],
    'sql': ['.sql'],
    'shell': ['.sh', '.bash', '.zsh', '.fish'],
    'html': ['.html'],
    'css': ['.css'],
    'scss': ['.scss'],
    'sass': ['.sass'],
    'less': ['.less'],
    'vue': ['.vue'],
    'svelte': ['.svelte']
  };

  /**
   * 根据文件扩展名获取编程语言
   * @param ext 文件扩展名（包含点号，如 '.js'）
   * @returns 编程语言名称或undefined
   */
  getLanguageByExtension(ext: string): string | undefined {
    if (!ext) return undefined;

    // 标准化扩展名为小写
    const normalizedExt = ext.toLowerCase();
    return LanguageExtensionMap.EXTENSION_TO_LANGUAGE[normalizedExt];
  }

  /**
   * 根据编程语言获取所有支持的文件扩展名
   * @param language 编程语言名称
   * @returns 文件扩展名数组
   */
  getExtensionsByLanguage(language: string): string[] {
    if (!language) return [];

    const normalizedLanguage = language.toLowerCase();
    return LanguageExtensionMap.LANGUAGE_TO_EXTENSIONS[normalizedLanguage] || [];
  }

  /**
   * 获取所有支持的编程语言列表
   * @returns 编程语言名称数组
   */
  getAllSupportedLanguages(): string[] {
    return Object.keys(LanguageExtensionMap.LANGUAGE_TO_EXTENSIONS);
  }

  /**
   * 检查指定的编程语言是否受支持
   * @param language 编程语言名称
   * @returns 是否支持
   */
  isLanguageSupported(language: string): boolean {
    if (!language) return false;

    const normalizedLanguage = language.toLowerCase();
    return normalizedLanguage in LanguageExtensionMap.LANGUAGE_TO_EXTENSIONS;
  }

  /**
   * 检查指定的文件扩展名是否受支持
   * @param ext 文件扩展名
   * @returns 是否支持
   */
  isExtensionSupported(ext: string): boolean {
    if (!ext) return false;

    const normalizedExt = ext.toLowerCase();
    return normalizedExt in LanguageExtensionMap.EXTENSION_TO_LANGUAGE;
  }

  /**
   * 从文件路径中提取语言
   * @param filePath 文件路径
   * @returns 编程语言名称或undefined
   */
  getLanguageFromPath(filePath: string): string | undefined {
    if (!filePath) return undefined;

    const ext = path.extname(filePath);
    return this.getLanguageByExtension(ext);
  }

  /**
   * 获取完整的扩展名到语言映射（只读）
   * @returns 扩展名到语言的映射对象
   */
  getExtensionToLanguageMap(): Readonly<Record<string, string>> {
    return { ...LanguageExtensionMap.EXTENSION_TO_LANGUAGE };
  }

  /**
   * 获取完整的语言到扩展名映射（只读）
   * @returns 语言到扩展名的映射对象
   */
  getLanguageToExtensionsMap(): Readonly<Record<string, string[]>> {
    return { ...LanguageExtensionMap.LANGUAGE_TO_EXTENSIONS };
  }
}

/**
 * 单例实例，供整个应用使用
 */
export const languageExtensionMap = new LanguageExtensionMap();