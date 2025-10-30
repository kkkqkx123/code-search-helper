import { injectable } from 'inversify';
import { LoggerService } from '../../../../utils/LoggerService';
import {
  SHEBANG_PATTERNS,
  SYNTAX_PATTERNS,
  FILE_STRUCTURE_PATTERNS,
  STRONG_FEATURE_LANGUAGES
} from '../constants';

/**
 * 无扩展名文件处理器
 * 采用决策树逻辑进行语言检测，优先检测具有明显特征的语言
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
   * 基于内容的语言检测 - 决策树逻辑
   */
  detectLanguageByContent(content: string): {
    language: string;
    confidence: number;
    indicators: string[];
  } {
    const firstFewLines = content.substring(0, Math.min(500, content.length));
    
    // 决策树检测逻辑
    const result = this.detectByDecisionTree(firstFewLines);
    
    this.logger?.debug(`Language detection result: ${result.language} (confidence: ${result.confidence})`, {
      indicators: result.indicators
    });
    
    return result;
  }

  /**
   * 决策树语言检测逻辑
   */
  private detectByDecisionTree(content: string): {
    language: string;
    confidence: number;
    indicators: string[];
  } {
    // 1. 检测 Shebang（最高优先级）
    const shebangResult = this.detectByShebang(content);
    if (shebangResult.confidence > 0) {
      return shebangResult;
    }

    // 2. 检测文件结构（特定文件格式）
    const structureResult = this.detectByFileStructure(content);
    if (structureResult.confidence > 0) {
      return structureResult;
    }

    // 3. 关键特征检测（按语言特异性排序）
    const keyFeatureResult = this.detectByKeyFeatures(content);
    if (keyFeatureResult.confidence >= 0.7) {
      return keyFeatureResult;
    }

    // 4. 通用模式检测（最后手段）
    const genericResult = this.detectByGenericPatterns(content);
    if (genericResult.confidence >= 0.3) {
      return genericResult;
    }

    return { language: 'unknown', confidence: 0, indicators: [] };
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

    // 按照特定顺序检查 shebang 模式，确保更具体的模式优先匹配
    const patterns = Array.from(this.shebangPatterns.entries());
    
    // 按模式长度降序排序，确保更长的模式优先匹配
    patterns.sort((a, b) => b[0].length - a[0].length);

    for (const [pattern, language] of patterns) {
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
   * 检测文件结构
   */
  private detectByFileStructure(content: string): {
    language: string;
    confidence: number;
    indicators: string[];
  } {
    const firstFewLines = content.substring(0, Math.min(300, content.length));

    for (const [language, pattern] of Array.from(this.fileStructurePatterns.entries())) {
      if (pattern.test(firstFewLines)) {
        return {
          language,
          confidence: 0.7,
          indicators: [`structure: ${pattern.source}`]
        };
      }
    }

    return { language: 'unknown', confidence: 0, indicators: [] };
  }

  /**
   * 关键特征检测 - 检测具有明显特征的语言
   */
  private detectByKeyFeatures(content: string): {
    language: string;
    confidence: number;
    indicators: string[];
  } {
    const indicators: string[] = [];
    let bestLanguage = 'unknown';
    let bestConfidence = 0;

    // TypeScript 特有特征检测
    if (/interface\s+\w+/m.test(content)) {
      indicators.push('interface');
      bestLanguage = 'typescript';
      bestConfidence = 0.8;
    }
    if (/type\s+\w+\s*=/m.test(content)) {
      indicators.push('type alias');
      bestLanguage = 'typescript';
      bestConfidence = Math.max(bestConfidence, 0.7);
    }
    if (/:\s*(string|number|boolean|void|any|unknown)/m.test(content)) {
      indicators.push('type annotation');
      bestLanguage = 'typescript';
      bestConfidence = Math.max(bestConfidence, 0.7);
    }

    // Java 特有特征检测
    if (/public\s+class\s+\w+/m.test(content)) {
      indicators.push('public class');
      bestLanguage = 'java';
      bestConfidence = Math.max(bestConfidence, 0.8);
    }
    if (/package\s+[\w.]+/m.test(content)) {
      indicators.push('package');
      bestLanguage = 'java';
      bestConfidence = Math.max(bestConfidence, 0.7);
    }

    // C++ 特有特征检测
    if (/#include\s*<[^>]+>/m.test(content)) {
      indicators.push('#include');
      bestLanguage = 'cpp';
      bestConfidence = Math.max(bestConfidence, 0.8);
    }
    if (/using\s+namespace\s+\w+/m.test(content)) {
      indicators.push('using namespace');
      bestLanguage = 'cpp';
      bestConfidence = Math.max(bestConfidence, 0.7);
    }

    // Go 特有特征检测
    if (/package\s+\w+/m.test(content)) {
      indicators.push('package');
      bestLanguage = 'go';
      bestConfidence = Math.max(bestConfidence, 0.8);
    }
    if (/func\s+\w+\s*\(/m.test(content)) {
      indicators.push('func');
      bestLanguage = 'go';
      bestConfidence = Math.max(bestConfidence, 0.7);
    }

    // Python 特有特征检测（更严格）
    if (/^def\s+\w+\s*\([^)]*\)\s*:/m.test(content)) {
      indicators.push('def function');
      bestLanguage = 'python';
      bestConfidence = Math.max(bestConfidence, 0.7);
    }
    if (/^class\s+\w+\s*\([^)]*\)\s*:/m.test(content)) {
      indicators.push('class');
      bestLanguage = 'python';
      bestConfidence = Math.max(bestConfidence, 0.7);
    }
    if (/if\s+__name__\s*==\s*['"']__main__['"']/m.test(content)) {
      indicators.push('__main__');
      bestLanguage = 'python';
      bestConfidence = Math.max(bestConfidence, 0.8);
    }

    if (bestLanguage !== 'unknown') {
      return {
        language: bestLanguage,
        confidence: bestConfidence,
        indicators: indicators.slice(0, 3)
      };
    }

    return { language: 'unknown', confidence: 0, indicators: [] };
  }

  /**
   * 通用模式检测 - 使用预定义的模式进行检测
   */
  private detectByGenericPatterns(content: string): {
    language: string;
    confidence: number;
    indicators: string[];
  } {
    let bestLanguage = 'unknown';
    let bestConfidence = 0;
    let bestIndicators: string[] = [];

    for (const [language, patterns] of Array.from(this.syntaxPatterns.entries())) {
      const indicators: string[] = [];
      let matches = 0;

      for (const pattern of patterns) {
        if (pattern.test(content)) {
          matches++;
          indicators.push(pattern.source);
        }
      }

      if (matches > 0) {
        // 对于自定义模式，给予更高的置信度
        const isCustomLanguage = !(language in SYNTAX_PATTERNS);
        const baseConfidence = Math.min(1.0, matches / Math.max(patterns.length / 3, 1));
        const confidence = isCustomLanguage ? Math.max(baseConfidence, 0.8) : baseConfidence;
        
        if (confidence > bestConfidence) {
          bestLanguage = language;
          bestConfidence = confidence;
          bestIndicators = indicators.slice(0, 3);
        }
      }
    }

    if (bestLanguage !== 'unknown') {
      return {
        language: bestLanguage,
        confidence: bestConfidence,
        indicators: bestIndicators
      };
    }

    return { language: 'unknown', confidence: 0, indicators: [] };
  }

  /**
   * 检查文件是否可能包含代码内容
   */
  isLikelyCodeFile(content: string): boolean {
    const detection = this.detectLanguageByContent(content);
    return detection.language !== 'unknown' && detection.confidence >= 0.1;
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
    this.logger?.info(`Added syntax pattern for ${language}:`, pattern.source);
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
    this.logger?.info(`Added file structure pattern for ${language}:`, pattern.source);
  }
}