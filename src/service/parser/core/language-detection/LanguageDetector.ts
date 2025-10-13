import * as path from 'path';

/**
 * 语言检测结果接口
 */
export interface LanguageDetectionResult {
  language: string | undefined;
  confidence: number;
  method: 'extension' | 'content' | 'fallback';
}

/**
 * 语言特征检测器
 * 负责根据文件扩展名和内容检测编程语言
 */
export class LanguageDetector {
  private static readonly LANGUAGE_MAP: Record<string, string> = {
    '.js': 'javascript',
    '.ts': 'typescript',
    '.jsx': 'javascript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'cpp',
    '.cs': 'csharp',
    '.go': 'go',
    '.rs': 'rust',
    '.php': 'php',
    '.rb': 'ruby',
    '.swift': 'swift',
    '.kt': 'kotlin',
    '.scala': 'scala',
    '.md': 'markdown',
    '.txt': 'text',  // 文本文件，需要内容检测
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

  /**
   * 智能语言检测 - 根据文件路径和内容推断语言
   */
  async detectLanguage(filePath: string, content?: string): Promise<LanguageDetectionResult> {
    // 1. 首先尝试通过文件扩展名检测
    const ext = path.extname(filePath).toLowerCase();
    const languageByExt = this.detectLanguageByExtension(ext);
    
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

    // 3. 如果是通用扩展名或未知类型，进一步检查内容
    if (this.shouldAnalyzeContent(ext)) {
      return this.detectLanguageByContent(content);
    }

    return {
      language: undefined,
      confidence: 0.0,
      method: 'fallback'
    };
  }

  /**
   * 同步语言检测 - 仅基于文件扩展名
   */
  detectLanguageSync(filePath: string): string | undefined {
    const ext = path.extname(filePath).toLowerCase();
    return this.detectLanguageByExtension(ext);
  }

  /**
   * 根据文件扩展名检测语言
   */
  private detectLanguageByExtension(ext: string): string | undefined {
    return LanguageDetector.LANGUAGE_MAP[ext];
  }

  /**
   * 判断是否需要分析内容
   */
  private shouldAnalyzeContent(ext: string): boolean {
    const contentBasedExtensions = ['.md', '.txt', ''];
    return contentBasedExtensions.includes(ext) || !LanguageDetector.LANGUAGE_MAP[ext];
  }

  /**
   * 根据内容检测语言
   */
  private detectLanguageByContent(content: string): LanguageDetectionResult {
    const firstFewLines = content.substring(0, Math.min(200, content.length)).toLowerCase();

    // 检查TypeScript/JavaScript特征 - 增强检测，避免误判
    const tsResult = this.detectTypeScript(firstFewLines);
    if (tsResult.confidence > 0.7) {
      return tsResult;
    }

    // 检查Python特征
    const pythonResult = this.detectPython(firstFewLines);
    if (pythonResult.confidence > 0.7) {
      return pythonResult;
    }

    // 检查Java特征
    const javaResult = this.detectJava(firstFewLines);
    if (javaResult.confidence > 0.7) {
      return javaResult;
    }

    // 检查Go特征 - 增强检测
    const goResult = this.detectGo(firstFewLines);
    if (goResult.confidence > 0.7) {
      return goResult;
    }

    // 检查Rust特征
    const rustResult = this.detectRust(firstFewLines);
    if (rustResult.confidence > 0.7) {
      return rustResult;
    }

    return {
      language: undefined,
      confidence: 0.0,
      method: 'fallback'
    };
  }

  /**
   * 检测TypeScript/JavaScript
   */
  private detectTypeScript(content: string): LanguageDetectionResult {
    const hasJSKeywords = content.includes('function') || content.includes('const') ||
                         content.includes('let') || content.includes('var');
    const hasTSKeywords = content.includes('interface') || content.includes('type ') ||
                         content.includes('declare') || content.includes('enum ');
    const hasJSX = content.includes('jsx') || content.includes('react');
    const hasModuleSyntax = content.includes('import') || content.includes('export');
    const hasArrowFunction = content.includes('=>');
    
    let confidence = 0;
    if (hasJSKeywords) confidence += 0.3;
    if (hasTSKeywords) confidence += 0.4;
    if (hasJSX) confidence += 0.2;
    if (hasModuleSyntax) confidence += 0.3;
    if (hasArrowFunction) confidence += 0.2;

    // 必须有关键词特征，避免纯内容误判
    if ((hasJSKeywords || hasTSKeywords || hasJSX) && (hasModuleSyntax || hasArrowFunction)) {
      return {
        language: 'typescript',
        confidence: Math.min(confidence, 1.0),
        method: 'content'
      };
    }

    return {
      language: undefined,
      confidence: 0,
      method: 'content'
    };
  }

  /**
   * 检测Python
   */
  private detectPython(content: string): LanguageDetectionResult {
    const features = [
      content.includes('import '),
      content.includes('from '),
      content.includes('def '),
      content.includes('class '),
      content.includes('print('),
      content.includes('__init__'),
      content.includes('self.')
    ];

    const confidence = features.filter(Boolean).length / features.length;

    if (confidence >= 0.4) {
      return {
        language: 'python',
        confidence,
        method: 'content'
      };
    }

    return {
      language: undefined,
      confidence: 0,
      method: 'content'
    };
  }

  /**
   * 检测Java
   */
  private detectJava(content: string): LanguageDetectionResult {
    const features = [
      content.includes('public '),
      content.includes('private '),
      content.includes('class '),
      content.includes('import '),
      content.includes('package '),
      content.includes('static '),
      content.includes('void '),
      content.includes('String[]')
    ];

    const confidence = features.filter(Boolean).length / features.length;

    if (confidence >= 0.4) {
      return {
        language: 'java',
        confidence,
        method: 'content'
      };
    }

    return {
      language: undefined,
      confidence: 0,
      method: 'content'
    };
  }

  /**
   * 检测Go - 增强检测
   */
  private detectGo(content: string): LanguageDetectionResult {
    const features = [
      content.includes('package '),
      content.includes('func '),
      content.includes('type '),
      content.includes('struct '),
      content.includes('interface '),
      content.includes('chan '),
      content.includes('go '),
      content.includes('fmt.'),
      content.includes('make('),
      content.includes(':=')
    ];

    const confidence = features.filter(Boolean).length / features.length;

    if (confidence >= 0.3) {  // 至少需要3个Go特征（10个特征中的30%）
      return {
        language: 'go',
        confidence,
        method: 'content'
      };
    }

    return {
      language: undefined,
      confidence: 0,
      method: 'content'
    };
  }

  /**
   * 检测Rust
   */
  private detectRust(content: string): LanguageDetectionResult {
    const features = [
      content.includes('fn '),
      content.includes('struct '),
      content.includes('impl '),
      content.includes('use '),
      content.includes('let mut'),
      content.includes('-> '),
      content.includes('&str'),
      content.includes('println!'),
      content.includes('match '),
      content.includes('Option<')
    ];

    const confidence = features.filter(Boolean).length / features.length;

    if (confidence >= 0.3) {
      return {
        language: 'rust',
        confidence,
        method: 'content'
      };
    }

    return {
      language: undefined,
      confidence: 0,
      method: 'content'
    };
  }

  /**
   * 获取支持的语言列表
   */
  getSupportedLanguages(): string[] {
    return Array.from(new Set(Object.values(LanguageDetector.LANGUAGE_MAP)));
  }

  /**
   * 检查语言是否支持AST解析
   */
  isLanguageSupportedForAST(language: string | undefined): boolean {
    if (!language) return false;
    
    const supportedLanguages = ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'cpp', 'c', 'csharp'];
    return supportedLanguages.includes(language);
  }
}