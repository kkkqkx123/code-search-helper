/**
 * 基于查询规则目录的语言分类检测服务
 * 根据实际目录结构和查询规则复杂度进行语言检测
 */
import { LoggerService } from '../../../utils/LoggerService';
import { languageMappingManager } from './LanguageMappingManager';
import { LanguageDetectionResult } from '../utils/syntax/SyntaxPatternMatcher';

export interface LanguageQueryScoring {
  language: string;
  confidence: number;
  method: 'extension' | 'content' | 'query_analysis' | 'fallback';
  metadata?: {
    originalExtension?: string;
    indicators?: string[];
    queryMatches?: number;
    totalQueries?: number;
  };
}

export class LanguageClassificationDetector {
  private logger: LoggerService;

  constructor() {
    this.logger = new LoggerService();
  }

  /**
   * 检测语言并返回分类信息
   */
  async detectLanguage(filePath: string, content?: string): Promise<LanguageDetectionResult> {
    // 1. 通过扩展名检测
    const extResult = this.detectByExtension(filePath);
    if (extResult && languageMappingManager.isLanguageSupported(extResult)) {
      return {
        language: extResult,
        confidence: 0.9,
        method: 'extension',
        metadata: {
          originalExtension: this.getFileExtension(filePath)
        }
      };
    }

    // 2. 如果有内容，通过内容检测
    if (content) {
      const contentResult = await this.detectByContent(content);
      if (contentResult && contentResult.confidence > 0.6) {
        return contentResult;
      }
    }

    // 3. 返回未检测到
    return {
      language: undefined,
      confidence: 0.0,
      method: 'fallback'
    };
  }

  /**
   * 基于扩展名检测语言
   */
  detectByExtension(filePath: string): string | undefined {
    return languageMappingManager.getLanguageByPath(filePath);
  }

  /**
   * 基于内容检测语言
   */
  async detectByContent(content: string): Promise<LanguageDetectionResult | undefined> {
    const lines = content.split('\n').slice(0, 50); // 只检查前50行
    
    // 计算每种语言的匹配度
    const languageScores = new Map<string, number>();
    const allLanguages = languageMappingManager.getAllSupportedLanguages();

    for (const language of allLanguages) {
      const score = await this.calculateLanguageScore(language, content, lines);
      if (score > 0) {
        languageScores.set(language, score);
      }
    }

    // 找到最高分的语言
    let bestLanguage: string | undefined;
    let bestScore = 0;

    for (const [language, score] of languageScores) {
      if (score > bestScore) {
        bestScore = score;
        bestLanguage = language;
      }
    }

    if (bestLanguage && bestScore > 0) {
      return {
        language: bestLanguage,
        confidence: Math.min(bestScore / 10, 1.0), // 归一化为 0-1
        method: 'content',
        metadata: {
          indicators: [`content_match_score: ${bestScore}`]
        }
      };
    }

    return undefined;
  }

  /**
   * 计算语言匹配分数
   */
  private async calculateLanguageScore(language: string, content: string, lines: string[]): Promise<number> {
    // 基于语言特征的内容模式匹配
    const contentPatterns: Record<string, RegExp[]> = {
      typescript: [
        /^import\s+.*from\s+['"][^'"]+['"]/,
        /^export\s+(default\s+)?(interface|type|class|function|const|let|var)/,
        /^interface\s+\w+/,
        /^type\s+\w+/,
        /:\s*\w+\s*=>/
      ],
      javascript: [
        /^import\s+.*from\s+['"][^'"]+['"]/,
        /^export\s+(class|function|const|let|var)/,
        /=>\s*\{/,
        /^function\s+\w+/
      ],
      python: [
        /^import\s+/,
        /^from\s+.*\s+import\s+/,
        /^def\s+\w+/,
        /^class\s+\w+/,
        /f["'][^"']*[""]/
      ],
      java: [
        /^import\s+/,
        /^package\s+/,
        /^public\s+(class|interface|enum)/,
        /^private|protected|public\s+\w+\s+\w+\s*\(/,
        /@\w+/
      ],
      go: [
        /^package\s+/,
        /^import\s+/,
        /^func\s+\w+/,
        /^type\s+\w+\s+struct/,
        /^var\s+\w+/,
        /^const\s+\w+/
      ],
      rust: [
        /^use\s+/,
        /^fn\s+\w+/,
        /^struct\s+\w+/,
        /^impl\s+\w+/,
        /^let\s+(mut\s+)?\w+/,
        /#\w+/
      ],
      html: [
        /^<!DOCTYPE\s+html>/i,
        /<html[^>]*>/i,
        /<head[^>]*>/i,
        /<body[^>]*>/i,
        /<div[^>]*>/i,
        /<script[^>]*>/i
      ],
      css: [
        /\.\w+\s*{/,
        /#\w+\s*{/,
        /@import/,
        /@media/,
        /html|body|margin|padding|display:\s*(flex|grid|block|inline)/
      ],
      json: [
        /^\s*\{/,
        /^\s*\[/,
        /"\w+"\s*:/,
        /true|false|null/
      ],
      yaml: [
        /^\w+\s*:/,
        /^\s*-\s+/,
        /^---/,
        /^\.\.\./,
        /true|false|null/
      ],
      php: [
        /<\?php/,
        /^function\s+\w+\s*\(.*\)\s*{/,
        /^class\s+\w+/,
        /^namespace\s+\w+/
      ],
      ruby: [
        /^def\s+\w+/,
        /^require\s+/,
        /^class\s+\w+/,
        /^\s*\w+\.|\bdo\s*\|/
      ],
      swift: [
        /^import\s+\w+/,
        /^func\s+\w+/,
        /^class\s+\w+/,
        /^struct\s+\w+/,
        /^let\s+\w+|var\s+\w+/
      ],
      kotlin: [
        /^package\s+\w+/,
        /^import\s+\w+/,
        /^fun\s+\w+/,
        /^class\s+\w+/,
        /^val\s+\w+|var\s+\w+/
      ],
      cpp: [
        /^#include/,
        /^using\s+namespace/,
        /^class\s+\w+/,
        /^template\s*<|std::/
      ],
      c: [
        /^#include/,
        /^typedef/,
        /^struct\s+\w+/,
        /^int\s+\w+\s*\(|void\s+\w+\s*\(|char\s+\w+/
      ],
      csharp: [
        /^using\s+\w+/,
        /^namespace\s+\w+/,
        /^class\s+\w+/,
        /^public\s+|private\s+|protected\s+/
      ],
      markdown: [
        /^#\s+/,
        /^\*\s+/,
        /^-\s+/,
        /^\d+\.\s+/,
        /```[\w]*$/,
        /\*\*[^*]+\*\*/,
        /\[([^\]]+)\]\(([^)]+)\)/
      ],
      xml: [
        /^<\?xml/,
        /<[^>]+>/,
        /<\/[^>]+>/,
        /<[^>]+\/>/
      ]
    };

    const patterns = contentPatterns[language] || [];
    let score = 0;

    for (const pattern of patterns) {
      const matches = lines.filter(line => pattern.test(line)).length;
      score += matches * 2; // 每个匹配给予2分
    }

    // 根据语言特性添加额外分数
    const lowerContent = content.toLowerCase();
    
    switch (language) {
      case 'typescript':
        if (lowerContent.includes('typescript') || lowerContent.includes('ts')) score += 1;
        break;
      case 'javascript':
        if (lowerContent.includes('javascript') || lowerContent.includes('js')) score += 1;
        break;
      case 'python':
        if (lowerContent.includes('python') || lowerContent.includes('py')) score += 1;
        break;
      case 'java':
        if (lowerContent.includes('java')) score += 1;
        break;
      case 'go':
        if (lowerContent.includes('go') && !lowerContent.includes('javascript')) score += 1;
        break;
      case 'rust':
        if (lowerContent.includes('rust') || lowerContent.includes('cargo')) score += 1;
        break;
      case 'php':
        if (lowerContent.includes('php')) score += 1;
        break;
      case 'ruby':
        if (lowerContent.includes('ruby') || lowerContent.includes('gem')) score += 1;
        break;
      case 'swift':
        if (lowerContent.includes('swift')) score += 1;
        break;
      case 'kotlin':
        if (lowerContent.includes('kotlin')) score += 1;
        break;
    }

    return score;
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot !== -1 ? filePath.substring(lastDot).toLowerCase() : '';
  }

  /**
   * 获取语言分类信息
   */
  getLanguageClassification(language: string): string | undefined {
    return languageMappingManager.getCategory(language);
  }

  /**
   * 获取高级编程语言列表
   */
  getAdvancedProgrammingLanguages(): string[] {
    return languageMappingManager.getAdvancedProgrammingLanguages();
  }

  /**
   * 获取基本编程语言列表
   */
  getBasicProgrammingLanguages(): string[] {
    return languageMappingManager.getBasicProgrammingLanguages();
  }

  /**
   * 获取数据格式语言列表
   */
  getDataFormatLanguages(): string[] {
    return languageMappingManager.getDataFormatLanguages();
  }

  /**
   * 获取特殊处理语言列表
   */
  getSpecialProcessingLanguages(): string[] {
    return languageMappingManager.getSpecialProcessingLanguages();
  }

  /**
   * 获取混合处理语言列表
   */
  getHybridProcessingLanguages(): string[] {
    return languageMappingManager.getHybridProcessingLanguages();
  }
}