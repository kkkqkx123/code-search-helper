import { injectable } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';
import {
  SHEBANG_PATTERNS,
  SYNTAX_PATTERNS,
  FILE_STRUCTURE_PATTERNS,
  STRONG_FEATURE_LANGUAGES
} from './constants';

/**
 * 无扩展名文件处理器
 * 负责基于内容检测无扩展名或扩展名未知文件的语言类型
 */
@injectable()
export class ExtensionlessFileProcessor {
  private logger?: LoggerService;
  private readonly shebangPatterns: Map<string, string>;
  private readonly syntaxPatterns: Map<string, RegExp[]>;
  private readonly fileStructurePatterns: Map<string, RegExp>;

  constructor(logger?: LoggerService) {
    this.logger = logger;

    // Shebang模式
    this.shebangPatterns = new Map(SHEBANG_PATTERNS);

    // 语法模式 - 基于代码特征的检测
    this.syntaxPatterns = new Map(Object.entries(SYNTAX_PATTERNS));

    // 文件结构模式
    this.fileStructurePatterns = new Map(FILE_STRUCTURE_PATTERNS);
  }

  /**
   * 基于内容的语言检测
   */
  detectLanguageByContent(content: string): {
    language: string;
    confidence: number;
    indicators: string[];
  } {
    const detectors = [
      this.detectByShebang.bind(this),
      this.detectBySyntaxPatterns.bind(this),
      this.detectByFileStructure.bind(this)
    ];

    let bestMatch = { language: 'unknown', confidence: 0, indicators: [] as string[] };

    for (const detector of detectors) {
      try {
        const result = detector(content);
        if (result.confidence > bestMatch.confidence) {
          bestMatch = result;
        }
      } catch (error) {
        this.logger?.warn(`Error in language detector: ${error}`);
      }
    }

    this.logger?.debug(`Language detection result: ${bestMatch.language} (confidence: ${bestMatch.confidence})`, {
      indicators: bestMatch.indicators
    });

    return bestMatch;
  }

  /**
   * 检测shebang
   */
  private detectByShebang(content: string): {
    language: string;
    confidence: number;
    indicators: string[];
  } {
    const firstLine = content.split('\n')[0];

    for (const [pattern, language] of Array.from(this.shebangPatterns.entries())) {
      if (firstLine.startsWith(pattern)) {
        return {
          language,
          confidence: 0.9,
          indicators: [`shebang: ${pattern}`]
        };
      }
    }

    return { language: 'unknown', confidence: 0, indicators: [] };
  }
  /** 
    * 检测语法模式
    */
  private detectBySyntaxPatterns(content: string): {
    language: string;
    confidence: number;
    indicators: string[];
  } {
    const firstFewLines = content.substring(0, Math.min(500, content.length));
    let bestMatch = { language: 'unknown', confidence: 0, indicators: [] as string[] };

    // 定义具有强特征的语言，这些语言只需要1个匹配模式即可识别
    const strongFeatureLanguages = new Set(STRONG_FEATURE_LANGUAGES);

    for (const [language, patterns] of Array.from(this.syntaxPatterns.entries())) {
      let matches = 0;
      const indicators: string[] = [];

      for (const pattern of patterns) {
        if (pattern.test(firstFewLines)) {
          matches++;
          indicators.push(pattern.source);
        }
      }

      if (matches > 0) { // 只要有一个匹配就继续
        const totalPatterns = patterns.length;
        const confidence = Math.min(1.0, matches / Math.max(totalPatterns / 3, 1)); // 调整信心计算

        // 对于具有强特征的语言，只需要1个匹配；其他语言需要至少1个匹配，但有更多匹配时信心更高
        const minMatchesRequired = strongFeatureLanguages.has(language) ? 1 : 1;

        if (confidence > bestMatch.confidence && matches >= minMatchesRequired) {
          bestMatch = {
            language,
            confidence,
            indicators: indicators.slice(0, 3) // 最多保留3个指示器
          };
        }
      }
    }

    return bestMatch;
  }
  /**
  * 检测文件结构
  */
  private detectByFileStructure(content: string): {
    language: string;
    confidence: number;
    indicators: string[];
  } {
    const firstFewLines = content.substring(0, Math.min(300, content.length));
    let bestMatch = { language: 'unknown', confidence: 0, indicators: [] as string[] };

    for (const [language, pattern] of Array.from(this.fileStructurePatterns.entries())) {
      if (pattern.test(firstFewLines)) {
        return {
          language,
          confidence: 0.7,
          indicators: [`structure: ${pattern.toString()}`]
        };
      }
    }

    return bestMatch;
  }

  /**
   * 检查文件是否可能包含代码内容
   */
  isLikelyCodeFile(content: string): boolean {
    const detection = this.detectLanguageByContent(content);
    return detection.language !== 'unknown' && detection.confidence > 0.5;
  }

  /**
   * 添加自定义语法模式
   */
  addSyntaxPattern(language: string, pattern: RegExp): void {
    if (!this.syntaxPatterns.has(language)) {
      this.syntaxPatterns.set(language, []);
    }
    const patterns = this.syntaxPatterns.get(language)!;
    patterns.push(pattern);
    this.logger?.info(`Added syntax pattern for ${language}: ${pattern.source}`);
  }

  /**
   * 添加自定义shebang模式
   */
  addShebangPattern(pattern: string, language: string): void {
    this.shebangPatterns.set(pattern, language);
    this.logger?.info(`Added shebang pattern: ${pattern} -> ${language}`);
  }

  /**
   * 添加文件结构模式
   */
  addFileStructurePattern(language: string, pattern: RegExp): void {
    this.fileStructurePatterns.set(language, pattern);
    this.logger?.info(`Added file structure pattern for ${language}: ${pattern.source}`);
  }
}