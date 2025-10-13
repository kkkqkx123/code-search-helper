/**
 * 语言检测结果接口
 */
export interface LanguageDetectionResult {
  language: string | undefined;
  confidence: number;
  method: 'extension' | 'content' | 'fallback';
}

/**
 * 语法模式匹配器接口
 */
export interface ISyntaxPatternMatcher {
  detectTypeScriptFeatures(content: string): number;
  detectPythonFeatures(content: string): number;
  detectJavaFeatures(content: string): number;
  detectGoFeatures(content: string): number;
  detectRustFeatures(content: string): number;
  detectJavaScriptFeatures(content: string): number;
  detectCppFeatures(content: string): number;
  detectCSharpFeatures(content: string): number;
  detectLanguageByContent(content: string): LanguageDetectionResult;
}

/**
 * 语法模式匹配器实现
 * 提供各种编程语言的语法特征检测功能
 */
export class SyntaxPatternMatcher implements ISyntaxPatternMatcher {
  // TypeScript/JavaScript 特征模式
  private static readonly TS_JS_PATTERNS = [
    /\b(function|const|let|var)\s+\w+/,
    /\b=>\s*/,
    /\bimport\s+.*\bfrom\s+/,
    /\bexport\s+(default\s+)?\w+/,
    /\bclass\s+\w+/,
    /\binterface\s+\w+/,
    /\btype\s+\w+\s*=/,
    /\benum\s+\w+/,
    /\bdeclare\s+/,
    /\bconsole\.(log|error|warn|info)/,
    /\bdocument\.(getElementById|querySelector)/,
    /\brequire\s*\(/,
    /\bwindow\./,
    /\basync\s+function/,
    /\bawait\s+/,
    /\bPromise\./,
    /\btry\s*{.*}\s*catch\s*\(/
  ];

  // Python 特征模式
  private static readonly PYTHON_PATTERNS = [
    /\bdef\s+\w+\s*\(/,
    /\bimport\s+\w+/,
    /\bfrom\s+\w+\s+import/,
    /\bclass\s+\w+.*:/,
    /\bif\s+.*:/,
    /\bfor\s+\w+\s+in\s+.*:/,
    /\bwhile\s+.*:/,
    /\btry\s*:/,
    /\bwith\s+.*as\s+\w+:/,
    /\bprint\s*\(/,
    /\bif\s+__name__\s*==\s*["']__main__["']/,
    /\bself\./,
    /\b__init__\s*\(/,
    /\blambda\s+/,
    /\breturn\s+/,
    /\byield\s+/
  ];

  // Java 特征模式
  private static readonly JAVA_PATTERNS = [
    /\bpublic\s+class\s+\w+/,
    /\bprivate\s+\w+\s+\w+/,
    /\bpublic\s+static\s+void\s+main/,
    /\bimport\s+java\./,
    /\bSystem\.out\.println/,
    /\bnew\s+\w+\(/,
    /\b@Override/,
    /\bthrows\s+\w+/,
    /\bpackage\s+[\w.]+/,
    /\binterface\s+\w+/,
    /\bextends\s+\w+/,
    /\bimplements\s+\w+/,
    /\bstatic\s+/,
    /\bfinal\s+/,
    /\bvoid\s+/
  ];

  // Go 特征模式
  private static readonly GO_PATTERNS = [
    /\bpackage\s+\w+/,
    /\bimport\s+["'][\w\/]+["']/,
    /\bfunc\s+\w+\s*\(/,
    /\btype\s+\w+\s+struct\s*{/,
    /\bfunc\s+\(.*\)\s*\w+\s*{/,
    /\bchan\s+\w+/,
    /\bgo\s+\w+\(/,
    /\binterface\s*{/,
    /:=\s*make\s*\(/,
    /\bfmt\.(Print|Scan)/,
    /\blen\s*\(/,
    /\bappend\s*\(/,
    /\bdefer\s+/,
    /\bselect\s*{/,
    /\brange\s+/,
    /\bgoroutine\s+/
  ];

  // Rust 特征模式
  private static readonly RUST_PATTERNS = [
    /\bfn\s+\w+/,
    /\bstruct\s+\w+/,
    /\bimpl\s+\w+/,
    /\buse\s+\w+/,
    /\blet\s+mut\s+/,
    /\b->\s/,
    /&str/,
    /\bprintln!/,
    /\bmatch\s+/,
    /\bOption<\w+>/,
    /\bResult<\w+,\s*\w+>/,
    /\bmut\s+/,
    /\bref\s+/,
    /\bmove\s+/,
    /\blifetime\s+/,
    /\btrait\s+\w+/,
    /\benum\s+\w+/,
    /\bmod\s+\w+/
  ];

  // C++ 特征模式
  private static readonly CPP_PATTERNS = [
    /#include\s+[<"]/,
    /\bint\s+main\s*\(/,
    /\bstd::\w+/,
    /\bcout\s*<</,
    /\bcin\s*>>/,
    /\busing\s+namespace\s+std/,
    /\bclass\s+\w+/,
    /\btemplate\s*</,
    /#define\s+\w+/,
    /\bnamespace\s+\w+/,
    /\bvirtual\s+/,
    /\boverride\s+/,
    /\bpublic\s*:/,
    /\bprivate\s*:/,
    /\bprotected\s*:/,
    /\bfriend\s+/
  ];

  // C# 特征模式
  private static readonly CSHARP_PATTERNS = [
    /\busing\s+[\w.]+/,
    /\bnamespace\s+\w+/,
    /\bpublic\s+class\s+\w+/,
    /\bprivate\s+\w+\s+\w+/,
    /\bpublic\s+static\s+void\s+Main/,
    /\bConsole\.(WriteLine|ReadLine)/,
    /\bnew\s+\w+\(/,
    /\boverride\s+/,
    /\bvirtual\s+/,
    /\binterface\s+\w+/,
    /\babstract\s+class/,
    /\bsealed\s+class/,
    /\bpartial\s+class/,
    /\basync\s+/,
    /\bawait\s+/,
    /\bvar\s+\w+\s*=/,
    /\bList<\w+>/,
    /\bDictionary<\w+,\s*\w+>/
  ];

  /**
   * 检测TypeScript特征
   * @param content 代码内容
   * @returns 匹配的特征数量
   */
  detectTypeScriptFeatures(content: string): number {
    return this.countPatternMatches(content, SyntaxPatternMatcher.TS_JS_PATTERNS);
  }

  /**
   * 检测JavaScript特征
   * @param content 代码内容
   * @returns 匹配的特征数量
   */
  detectJavaScriptFeatures(content: string): number {
    return this.countPatternMatches(content, SyntaxPatternMatcher.TS_JS_PATTERNS);
  }

  /**
   * 检测Python特征
   * @param content 代码内容
   * @returns 匹配的特征数量
   */
  detectPythonFeatures(content: string): number {
    return this.countPatternMatches(content, SyntaxPatternMatcher.PYTHON_PATTERNS);
  }

  /**
   * 检测Java特征
   * @param content 代码内容
   * @returns 匹配的特征数量
   */
  detectJavaFeatures(content: string): number {
    return this.countPatternMatches(content, SyntaxPatternMatcher.JAVA_PATTERNS);
  }

  /**
   * 检测Go特征
   * @param content 代码内容
   * @returns 匹配的特征数量
   */
  detectGoFeatures(content: string): number {
    return this.countPatternMatches(content, SyntaxPatternMatcher.GO_PATTERNS);
  }

  /**
   * 检测Rust特征
   * @param content 代码内容
   * @returns 匹配的特征数量
   */
  detectRustFeatures(content: string): number {
    return this.countPatternMatches(content, SyntaxPatternMatcher.RUST_PATTERNS);
  }

  /**
   * 检测C++特征
   * @param content 代码内容
   * @returns 匹配的特征数量
   */
  detectCppFeatures(content: string): number {
    return this.countPatternMatches(content, SyntaxPatternMatcher.CPP_PATTERNS);
  }

  /**
   * 检测C#特征
   * @param content 代码内容
   * @returns 匹配的特征数量
   */
  detectCSharpFeatures(content: string): number {
    return this.countPatternMatches(content, SyntaxPatternMatcher.CSHARP_PATTERNS);
  }

  /**
   * 检测TypeScript特有特征
   * @param content 代码内容
   * @returns 匹配的特征数量
   */
  detectTypeScriptSpecificFeatures(content: string): number {
    const tsSpecificPatterns = [
      /\binterface\s+\w+/,
      /\btype\s+\w+\s*=/,
      /\benum\s+\w+/,
      /\bdeclare\s+/,
      /\:\s*\w+\s*(\[\]|\&amp;|\|)/, // 类型注解
      /\:\s*\w+\s*=\s*\w+/, // 类型注解与默认值
      /\bextends\s+\w+\s*&lt;\w+&gt;/, // 泛型继承
      /\bimplements\s+\w+/,
      /\breadonly\s+\w+/,
      /\babstract\s+class/,
      /\bprivate\s+\w+/,
      /\bprotected\s+\w+/,
      /\bpublic\s+\w+/
    ];
    
    return this.countPatternMatches(content, tsSpecificPatterns);
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

    const contentLower = content.substring(0, Math.min(200, content.length)).toLowerCase();
    const languageScores: Array<{ language: string; score: number }> = [];

    // 首先检测TypeScript特定特征
    const tsSpecificScore = this.detectTypeScriptSpecificFeatures(contentLower);
    const jsScore = this.detectJavaScriptFeatures(contentLower);

    // 如果有TypeScript特定特征，优先认为是TypeScript
    if (tsSpecificScore > 0) {
      languageScores.push({
        language: 'typescript',
        score: tsSpecificScore + jsScore // TypeScript包含JavaScript特征
      });
    } else {
      languageScores.push({
        language: 'javascript',
        score: jsScore
      });
    }

    languageScores.push({
      language: 'python',
      score: this.detectPythonFeatures(contentLower)
    });

    languageScores.push({
      language: 'java',
      score: this.detectJavaFeatures(contentLower)
    });

    languageScores.push({
      language: 'go',
      score: this.detectGoFeatures(contentLower)
    });

    languageScores.push({
      language: 'rust',
      score: this.detectRustFeatures(contentLower)
    });

    languageScores.push({
      language: 'cpp',
      score: this.detectCppFeatures(contentLower)
    });

    languageScores.push({
      language: 'csharp',
      score: this.detectCSharpFeatures(contentLower)
    });

    // 找出得分最高的语言
    const topScore = languageScores.reduce((max, curr) => 
      curr.score > max.score ? curr : max, 
      { language: '', score: 0 }
    );

    // 如果最高分太低，返回未识别
    if (topScore.score < 1) {
      return {
        language: undefined,
        confidence: 0.0,
        method: 'fallback'
      };
    }

    // 计算置信度
    const totalScore = languageScores.reduce((sum, curr) => sum + curr.score, 0);
    const confidence = totalScore > 0 ? topScore.score / totalScore : 0;

    return {
      language: topScore.language,
      confidence: Math.min(confidence, 1.0),
      method: 'content'
    };
  }

  /**
   * 计算模式匹配数量
   * @param content 代码内容
   * @param patterns 正则表达式模式数组
   * @returns 匹配的特征数量
   */
  private countPatternMatches(content: string, patterns: RegExp[]): number {
    let matchCount = 0;
    
    for (const pattern of patterns) {
      if (pattern.test(content)) {
        matchCount++;
      }
    }
    
    return matchCount;
  }

  /**
   * 检测是否包含特定模式的特征
   * @param content 代码内容
   * @param pattern 正则表达式模式
   * @returns 是否匹配
   */
  hasPattern(content: string, pattern: RegExp): boolean {
    return pattern.test(content);
  }

  /**
   * 获取所有匹配的模式
   * @param content 代码内容
   * @param patterns 正则表达式模式数组
   * @returns 匹配的模式索引数组
   */
  getMatchingPatterns(content: string, patterns: RegExp[]): number[] {
    const matchingIndices: number[] = [];
    
    patterns.forEach((pattern, index) => {
      if (pattern.test(content)) {
        matchingIndices.push(index);
      }
    });
    
    return matchingIndices;
  }
}

/**
 * 单例实例，供整个应用使用
 */
export const syntaxPatternMatcher = new SyntaxPatternMatcher();