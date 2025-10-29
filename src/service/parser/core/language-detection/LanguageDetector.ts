/**
 * 核心语言检测服务接口
 */
export interface ILanguageDetector {
  /**
   * 检测语言
   * @param filePath 文件路径
   * @param content 代码内容（可选）
   * @returns 语言检测结果
   */
  detectLanguage(filePath: string, content?: string): Promise<LanguageDetectionResult>;

  /**
   * 同步检测语言 - 仅基于文件扩展名
   * @param filePath 文件路径
   * @returns 编程语言名称或undefined
   */
  detectLanguageSync(filePath: string): string | undefined;

  /**
   * 根据扩展名检测语言
   * @param ext 文件扩展名
   * @returns 编程语言名称或undefined
   */
  detectLanguageByExtension(ext: string): string | undefined;

  /**
   * 获取支持的语言列表
   * @returns 支持的语言列表
   */
  getSupportedLanguages(): string[];

  /**
   * 检查语言是否支持AST解析
   * @param language 编程语言名称
   * @returns 是否支持AST解析
   */
  isLanguageSupportedForAST(language: string | undefined): boolean;

  /**
   * 验证语言检测结果
   * @param content 代码内容
   * @param detectedLanguage 检测到的语言
   * @returns 验证结果
   */
  validateLanguageDetection(content: string, detectedLanguage: string): boolean;
}

/**
 * 语言检测结果接口
 */
export interface LanguageDetectionResult {
  language: string | undefined;
  confidence: number;
  method: 'extension' | 'content' | 'backup' | 'hybrid' | 'fallback';
  metadata?: {
    originalExtension?: string;
    indicators?: string[];
  };
}

/**
 * 核心语言检测服务实现
 * 提供基础的语言检测功能，不包含高级业务逻辑
 */
export class LanguageDetector implements ILanguageDetector {
  private static readonly languageExtensionMap = new Map<string, string[]>([
    ['typescript', ['.ts', '.tsx']],
    ['javascript', ['.js', '.jsx']],
    ['python', ['.py']],
    ['java', ['.java']],
    ['c', ['.c', '.h']],
    ['cpp', ['.cpp', '.cxx', '.cc', '.hpp', '.hxx']],
    ['csharp', ['.cs']],
    ['go', ['.go']],
    ['rust', ['.rs']],
    ['php', ['.php']],
    ['ruby', ['.rb']],
    ['swift', ['.swift']],
    ['kotlin', ['.kt', '.kts']],
    ['scala', ['.scala']],
    ['html', ['.html', '.htm']],
    ['css', ['.css']],
    ['json', ['.json']],
    ['yaml', ['.yaml', '.yml']],
    ['toml', ['.toml']],
    ['xml', ['.xml']],
    ['markdown', ['.md', '.markdown']],
    ['text', ['.txt']]
  ]);

  /**
   * 检测语言
   */
  async detectLanguage(filePath: string, content?: string): Promise<LanguageDetectionResult> {
    // 1. 尝试通过扩展名检测
    const extensionResult = this.detectLanguageSync(filePath);
    if (extensionResult && extensionResult !== 'unknown') {
      return {
        language: extensionResult,
        confidence: 0.9,
        method: 'extension',
        metadata: {
          originalExtension: this.getFileExtension(filePath)
        }
      };
    }

    // 2. 如果扩展名检测失败，尝试内容检测
    if (content) {
      const contentDetection = this.detectLanguageByContent(content);
      if (contentDetection.confidence > 0.5) {
        return contentDetection;
      }
    }

    return {
      language: undefined,
      confidence: 0.0,
      method: 'fallback'
    };
  }

  /**
   * 同步检测语言 - 仅基于文件扩展名
   */
  detectLanguageSync(filePath: string): string | undefined {
    const ext = this.getFileExtension(filePath);
    if (!ext) return undefined;

    for (const [language, extensions] of LanguageDetector.languageExtensionMap) {
      if (extensions.includes(ext.toLowerCase())) {
        return language;
      }
    }

    return undefined;
  }

  /**
   * 根据扩展名检测语言
   */
 detectLanguageByExtension(ext: string): string | undefined {
    for (const [language, extensions] of LanguageDetector.languageExtensionMap) {
      if (extensions.includes(ext.toLowerCase())) {
        return language;
      }
    }

    return undefined;
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return Array.from(LanguageDetector.languageExtensionMap.keys());
  }

  /**
   * 检查语言是否支持AST解析
   */
  isLanguageSupportedForAST(language: string | undefined): boolean {
    if (!language) return false;
    
    // 假设所有已知语言都支持AST解析
    return this.getSupportedLanguages().includes(language.toLowerCase());
  }

  /**
   * 验证语言检测结果
   */
  validateLanguageDetection(content: string, detectedLanguage: string): boolean {
    if (!content || !detectedLanguage) return false;

    const contentLower = content.trim().toLowerCase();
    const language = detectedLanguage.toLowerCase();

    // 基于内容的特征检测
    const languagePatterns: Record<string, RegExp> = {
      javascript: /function\s+\w+|import\s+|export\s+|=>|const\s+\w+\s*=|let\s+\w+\s*=|var\s+\w+\s*=|<\w+[^>]*>/,
      python: /def\s+\w+|import\s+|from\s+\w+\s+import|class\s+\w+|if\s+__name__\s*==\s*['"]__main__['"]/,
      java: /public\s+class\s+\w+|import\s+java|package\s+\w+|public\s+static\s+void\s+main/,
      go: /package\s+\w+|import\s+\(|func\s+\w+|import\s+"[^"]+"/,
      rust: /fn\s+\w+|use\s+\w+|mod\s+\w+|impl\s+\w+|let\s+(mut\s+)?\w+/,
      c: /#include|typedef|struct\s+\w+|int\s+\w+\s*\(|void\s+\w+\s*\(|char\s+\w+/,
      cpp: /#include|using\s+namespace|class\s+\w+|template\s*<|std::/,
      typescript: /import\s+.*from|export\s+(default\s+)?(class|interface|type|function|const|let|var)|interface\s+\w+|type\s+\w+|:\s*\w+\s*=>/,
      php: /<\?php|function\s+\w+\s*\(.*\)\s*{|class\s+\w+|namespace\s+\w+/,
      ruby: /def\s+\w+|require\s+|class\s+\w+|module\s+\w+|^\s*\w+\.|\bdo\s*\|/,
      swift: /import\s+\w+|func\s+\w+|class\s+\w+|struct\s+\w+|let\s+\w+|var\s+\w+/,
      kotlin: /package\s+\w+|import\s+\w+|fun\s+\w+|class\s+\w+|val\s+\w+|var\s+\w+/,
      scala: /import\s+\w+|def\s+\w+|class\s+\w+|object\s+\w+|val\s+\w+|var\s+\w+/,
      html: /<!DOCTYPE|<html|<head|<body|<div|<span|<p|<h\d|<a|<img/,
      css: /\.\w+\s*{|#\w+\s*{|@import|@media|html|body|margin|padding|display:\s*(flex|grid|block|inline)/,
      json: /^[\s\n\r]*[{[]|[\]}][\s\n\r]*$|"[^"]*"\s*:\s*|true|false|null/,
      yaml: /^\w+:\s*|^-|^\.\.\.|^---|true|false|null|^\d{4}-\d{2}-\d{2}/,
      xml: /<\?xml|<\w+|<\/\w+>|<\w+\/>/
    };

    const pattern = languagePatterns[language];
    if (pattern) {
      return pattern.test(contentLower);
    }

    // 如果没有特定模式，至少检查是否包含一些基本代码特征
    const basicCodePattern = /(\w+\s*=\s*|\w+\s*\(|\w+\s*:\s*|function|class|import|def|if\s+|for\s+|while\s+)/;
    return basicCodePattern.test(contentLower);
  }

  /**
   * 根据内容检测语言
   */
  detectLanguageByContent(content: string): LanguageDetectionResult {
    const lines = content.split('\n').slice(0, 50); // 只检查前50行
    let bestMatch = { language: 'unknown', confidence: 0 };

    const contentPatterns: Record<string, RegExp[]> = {
      typescript: [
        /^import\s+.*from\s+['"][^'"]+['"];?$/,
        /^export\s+(interface|type|class|function|const|let|var)\s+/,
        /^interface\s+\w+/,
        /^type\s+\w+/,
        /^\s*\w+\s*:\s*\w+/,
        /<[^>]*>/g
      ],
      javascript: [
        /^import\s+.*from\s+['"][^'"]+['"];?$/,
        /^export\s+(class|function|const|let|var)\s+/,
        /^const\s+\w+\s*=\s*\(/,
        /^function\s+\w+/,
        /=>\s*\{/
      ],
      python: [
        /^import\s+/,
        /^from\s+.*\s+import\s+/,
        /^def\s+\w+/,
        /^class\s+\w+/,
        /^\s+\w+\s*:/,
        /f["'][^"']*["']/
      ],
      java: [
        /^import\s+/,
        /^package\s+/,
        /^public\s+(class|interface|enum)\s+\w+/,
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
      markdown: [
        /^#\s+/,
        /^\*\s+/,
        /^-\s+/,
        /^\d+\.\s+/,
        /```[\w]*$/,
        /\*\*[^*]+\*\*/,
        /\[([^\]]+)\]\(([^)]+)\)/
      ],
      json: [
        /^\s*\{/,
        /^\s*\[/,
        /"\w+"\s*:/,
        /^\s*"/,
        /true|false|null/
      ],
      yaml: [
        /^\w+\s*:/,
        /^\s*-\s+/,
        /^---/,
        /^\.\.\./,
        /true|false|null/
      ],
      xml: [
        /^<\?xml/,
        /<[^>]+>/,
        /<\/[^>]+>/,
        /<[^>]+\/>/
      ]
    };

    for (const [language, patterns] of Object.entries(contentPatterns)) {
      let languageMatches = 0;
      for (const pattern of patterns) {
        const matches = lines.filter(line => pattern.test(line)).length;
        languageMatches += matches;
      }
      // Increase confidence calculation to make content detection more effective
      // Base confidence is matches/lines, but we add a bonus for multiple pattern matches
      const baseConfidence = languageMatches / lines.length;
      const patternBonus = Math.min(languageMatches * 0.1, 0.3); // Max 0.3 bonus
      const confidence = Math.min(baseConfidence + patternBonus, 1.0);

      if (confidence > bestMatch.confidence) {
        bestMatch = { language, confidence };
      }
    }

    return {
      language: bestMatch.language !== 'unknown' ? bestMatch.language : undefined,
      confidence: bestMatch.confidence,
      method: 'content',
      metadata: { indicators: [] } // 简化返回值
    };
  }

  /**
   * 获取文件扩展名
   */
  private getFileExtension(filePath: string): string {
    const lastDot = filePath.lastIndexOf('.');
    return lastDot !== -1 ? filePath.substring(lastDot).toLowerCase() : '';
  }
}