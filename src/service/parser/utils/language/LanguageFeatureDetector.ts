import { LanguageDetectionResult } from '../syntax/SyntaxPatternMatcher';
import { syntaxPatternMatcher } from '../syntax';
import { LanguageExtensionMap } from './LanguageExtensionMap';
import { FileUtils } from './FileUtils';

/**
 * 语言特征检测器接口
 */
export interface ILanguageFeatureDetector {
  detectLanguageByContent(content: string): LanguageDetectionResult;
  detectLanguageByExtension(filePath: string): string | undefined;
  detectLanguage(filePath: string, content?: string): Promise<LanguageDetectionResult>;
  validateLanguageDetection(content: string, detectedLanguage: string): boolean;
}

/**
 * 语言特征检测器实现
 * 统一管理语言检测逻辑，结合扩展名和内容特征进行检测
 */
export class LanguageFeatureDetector implements ILanguageFeatureDetector {
  private extensionMap: LanguageExtensionMap;
  private fileUtils: FileUtils;
  private patternMatcher: typeof syntaxPatternMatcher;

  constructor() {
    this.extensionMap = new LanguageExtensionMap();
    this.fileUtils = new FileUtils();
    this.patternMatcher = syntaxPatternMatcher;
  }

  /**
   * 根据内容检测语言
   * @param content 代码内容
   * @returns 语言检测结果
   */
  detectLanguageByContent(content: string): LanguageDetectionResult {
    if (!content || content.trim().length === 0) {
      return {
        language: undefined,
        confidence: 0.0,
        method: 'fallback'
      };
    }

    // 使用语法模式匹配器进行检测
    return this.patternMatcher.detectLanguageByContent(content);
  }

  /**
   * 根据文件扩展名检测语言
   * @param filePath 文件路径
   * @returns 编程语言名称或undefined
   */
  detectLanguageByExtension(filePath: string): string | undefined {
    if (!filePath) {
      return undefined;
    }

    return this.extensionMap.getLanguageFromPath(filePath);
  }

  /**
   * 智能语言检测 - 结合文件路径和内容
   * @param filePath 文件路径
   * @param content 代码内容（可选）
   * @returns 语言检测结果
   */
  async detectLanguage(filePath: string, content?: string): Promise<LanguageDetectionResult> {
    // 1. 首先尝试通过文件扩展名检测
    const languageByExt = this.detectLanguageByExtension(filePath);
    
    if (languageByExt) {
      return {
        language: languageByExt,
        confidence: 0.9,
        method: 'extension'
      };
    }

    // 2. 如果没有内容，返回undefined
    if (!content) {
      return {
        language: undefined,
        confidence: 0.0,
        method: 'fallback'
      };
    }

    // 3. 获取文件扩展名，判断是否需要内容分析
    const ext = this.fileUtils.extractFileExtension(filePath);
    if (this.shouldAnalyzeContent(ext)) {
      const contentResult = this.detectLanguageByContent(content);
      
      // 如果内容检测成功，返回内容检测结果
      if (contentResult.language && contentResult.confidence > 0.5) {
        return contentResult;
      }
    }

    return {
      language: undefined,
      confidence: 0.0,
      method: 'fallback'
    };
  }

  /**
   * 验证语言检测结果
   * @param content 代码内容
   * @param detectedLanguage 检测到的语言
   * @returns 验证结果
   */
  validateLanguageDetection(content: string, detectedLanguage: string): boolean {
    if (!content || !detectedLanguage) {
      return false;
    }

    const normalizedLanguage = detectedLanguage.toLowerCase();
    const contentLower = content.toLowerCase();

    switch (normalizedLanguage) {
      case 'typescript':
      case 'javascript':
        return this.validateTypeScriptOrJavaScript(contentLower);
      
      case 'python':
        return this.validatePython(contentLower);
      
      case 'java':
        return this.validateJava(contentLower);
      
      case 'go':
        return this.validateGo(contentLower);
      
      case 'rust':
        return this.validateRust(contentLower);
      
      case 'cpp':
      case 'c':
        return this.validateCppOrC(contentLower);
      
      case 'csharp':
        return this.validateCSharp(contentLower);
      
      default:
        return true; // 对于不常见的语言，暂时返回true
    }
  }

  /**
   * 判断是否需要分析内容
   * @param ext 文件扩展名
   * @returns 是否需要内容分析
   */
  private shouldAnalyzeContent(ext: string): boolean {
    const contentBasedExtensions = ['.md', '.txt', ''];
    return contentBasedExtensions.includes(ext) || !this.extensionMap.isExtensionSupported(ext);
  }

  /**
   * 验证TypeScript/JavaScript语言
   * @param content 代码内容
   * @returns 验证结果
   */
  private validateTypeScriptOrJavaScript(content: string): boolean {
    const features = [
      content.includes('function'),
      content.includes('const') || content.includes('let') || content.includes('var'),
      content.includes('=>') || content.includes('function'),
      content.includes('import') || content.includes('export'),
      content.includes('{') && content.includes('}')
    ];

    const matchCount = features.filter(Boolean).length;
    return matchCount >= 3; // 至少匹配3个特征
  }

  /**
   * 验证Python语言
   * @param content 代码内容
   * @returns 验证结果
   */
  private validatePython(content: string): boolean {
    const features = [
      content.includes('def '),
      content.includes('import '),
      content.includes('from '),
      content.includes('class '),
      content.includes(':'),
      content.includes('print(')
    ];

    const matchCount = features.filter(Boolean).length;
    return matchCount >= 3; // 至少匹配3个特征
  }

  /**
   * 验证Java语言
   * @param content 代码内容
   * @returns 验证结果
   */
  private validateJava(content: string): boolean {
    const features = [
      content.includes('public '),
      content.includes('class '),
      content.includes('import '),
      content.includes('package '),
      content.includes('static '),
      content.includes('void ')
    ];

    const matchCount = features.filter(Boolean).length;
    return matchCount >= 3; // 至少匹配3个特征
  }

  /**
   * 验证Go语言
   * @param content 代码内容
   * @returns 验证结果
   */
  private validateGo(content: string): boolean {
    const features = [
      content.includes('package '),
      content.includes('func '),
      content.includes('import '),
      content.includes('type '),
      content.includes('struct '),
      content.includes('interface '),
      content.includes(':=')
    ];

    const matchCount = features.filter(Boolean).length;
    return matchCount >= 2; // 至少匹配2个特征
  }

  /**
   * 验证Rust语言
   * @param content 代码内容
   * @returns 验证结果
   */
  private validateRust(content: string): boolean {
    const features = [
      content.includes('fn '),
      content.includes('struct '),
      content.includes('impl '),
      content.includes('use '),
      content.includes('let '),
      content.includes('-> '),
      content.includes('match '),
      content.includes('Option<')
    ];

    const matchCount = features.filter(Boolean).length;
    return matchCount >= 2; // 至少匹配2个特征
  }

  /**
   * 验证C/C++语言
   * @param content 代码内容
   * @returns 验证结果
   */
  private validateCppOrC(content: string): boolean {
    const features = [
      content.includes('#include'),
      content.includes('int '),
      content.includes('main('),
      content.includes('{') && content.includes('}'),
      content.includes(';'),
      content.includes('std::') || content.includes('printf') || content.includes('cout')
    ];

    const matchCount = features.filter(Boolean).length;
    return matchCount >= 3; // 至少匹配3个特征
  }

  /**
   * 验证C#语言
   * @param content 代码内容
   * @returns 验证结果
   */
  private validateCSharp(content: string): boolean {
    const features = [
      content.includes('using '),
      content.includes('namespace '),
      content.includes('class '),
      content.includes('public '),
      content.includes('private '),
      content.includes('Console.'),
      content.includes('new ')
    ];

    const matchCount = features.filter(Boolean).length;
    return matchCount >= 3; // 至少匹配3个特征
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
    if (!language) return false;
    
    const supportedLanguages = [
      'typescript', 'javascript', 'python', 'java', 
      'go', 'rust', 'cpp', 'c', 'csharp'
    ];
    return supportedLanguages.includes(language.toLowerCase());
  }
}

/**
 * 单例实例，供整个应用使用
 */
export const languageFeatureDetector = new LanguageFeatureDetector();