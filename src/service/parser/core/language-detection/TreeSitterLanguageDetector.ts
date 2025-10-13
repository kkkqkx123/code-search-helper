import { ParserLanguage } from '../parse/TreeSitterCoreService';
import { LanguageDetectionResult } from './LanguageDetector';

/**
 * TreeSitter专用的语言检测器
 * 扩展基础语言检测器，增加TreeSitter特定的检测逻辑
 */
export class TreeSitterLanguageDetector {
  /**
   * 基于TreeSitter解析器配置的语言检测
   */
  detectLanguageByParserConfig(
    filePath: string, 
    parsers: Map<string, ParserLanguage>,
    content?: string
  ): ParserLanguage | null {
    try {
      // 1. 安全提取文件扩展名
      const ext = this.extractFileExtension(filePath);
      if (!ext) {
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
   */
  private extractFileExtension(filePath: string): string {
    try {
      // 处理路径中的特殊字符和大小写
      const basename = filePath.split(/[\\/]/).pop()?.toLowerCase() || '';
      const lastDot = basename.lastIndexOf('.');

      // 确保扩展名有效
      if (lastDot <= 0 || lastDot === basename.length - 1) {
        return '';
      }

      return basename.substring(lastDot);
    } catch (error) {
      console.error('Failed to extract file extension:', error);
      return '';
    }
  }

  /**
   * 基于扩展名获取语言键
   */
  private getLanguageKeyByExtension(ext: string): string {
    const extToLangMap: Map<string, string> = new Map([
      ['.ts', 'typescript'],
      ['.tsx', 'typescript'],
      ['.js', 'javascript'],
      ['.jsx', 'javascript'],
      ['.py', 'python'],
      ['.java', 'java'],
      ['.go', 'go'],
      ['.rs', 'rust'],
      ['.cpp', 'cpp'],
      ['.cc', 'cpp'],
      ['.cxx', 'cpp'],
      ['.c++', 'cpp'],
      ['.h', 'c'],  // C头文件
      ['.hpp', 'cpp'], // C++头文件
      ['.c', 'c'],
      ['.cs', 'csharp'],
      ['.scala', 'scala'],
      ['.txt', 'text'],// 文本文件，需要内容检测
      ['.md', 'markdown'],// markdown文件，需要内容检测
    ]);

    return extToLangMap.get(ext) || '';
  }

  /**
   * 基于内容验证语言
   */
  private validateLanguageByContent(content: string, detectedLanguage: ParserLanguage): ParserLanguage | null {
    try {
      const contentLower = content.trim().toLowerCase();

      // Go语言特征检测
      if (detectedLanguage.name === 'Go') {
        const goPatterns = [
          /package\s+\w+/,
          /import\s+["'][\w\/]+["']/,
          /func\s+\w+\s*\(/,
          /type\s+\w+\s+struct\s*{/,
          /interface\s*{/,
          /chan\s+\w+/,
          /go\s+\w+\(/
        ];

        const goScore = goPatterns.filter(pattern => pattern.test(contentLower)).length;
        if (goScore >= 2) {  // 至少匹配2个Go特征
          return detectedLanguage;
        }
      }

      // TypeScript/JavaScript特征检测
      if (['TypeScript', 'JavaScript'].includes(detectedLanguage.name)) {
        const jsPatterns = [
          /(const|let|var)\s+\w+/,
          /function\s+\w+\s*\(/,
          /=>/,
          /import\s+.*from\s+/,
          /export\s+(default\s+)?(const|function|class)/,
          /console\.log/,
          /document\.getElementById/
        ];

        const jsScore = jsPatterns.filter(pattern => pattern.test(contentLower)).length;
        if (jsScore >= 2) {
          return detectedLanguage;
        }
      }

      // Python特征检测
      if (detectedLanguage.name === 'Python') {
        const pyPatterns = [
          /def\s+\w+\s*\(/,
          /import\s+\w+/,
          /from\s+\w+\s+import/,
          /class\s+\w+.*:/,
          /if\s+__name__\s*==\s*["']__main__["']/
        ];

        const pyScore = pyPatterns.filter(pattern => pattern.test(contentLower)).length;
        if (pyScore >= 2) {
          return detectedLanguage;
        }
      }

      return null; // 验证失败
    } catch (error) {
      console.error('Language content validation failed:', error);
      return detectedLanguage; // 验证出错时信任扩展名检测
    }
  }

  /**
   * 基于内容特征检测语言
   */
  private detectLanguageByContentFeatures(content: string, parsers: Map<string, ParserLanguage>): ParserLanguage | null {
    try {
      const contentLower = content.trim().toLowerCase();

      // Go特征检测 - 增强版本
      const goPatterns = [
        /package\s+\w+/,                    // package声明
        /import\s+["'][\w\/]+["']/,          // import语句
        /func\s+\w+\s*\(/,                   // 函数定义
        /type\s+\w+\s+struct\s*{/,           // 结构体定义
        /func\s+\(.*\)\s*\w+\s*{/,           // 方法定义
        /chan\s+\w+/,                        // channel
        /go\s+\w+\(/,                        // goroutine
        /interface\s*{/,                     // 接口定义
        /:=\s*make\s*\(/,                    // make函数
        /fmt\.(Print|Scan)/,                 // fmt包使用
        /len\s*\(/,                          // len函数
        /append\s*\(/                        // append函数
      ];
      const goScore = goPatterns.filter(pattern => pattern.test(contentLower)).length;
      if (goScore >= 3) {  // 降低阈值，提高检测灵敏度
        return parsers.get('go') || null;
      }

      // Python特征检测 - 增强版本
      const pyPatterns = [
        /def\s+\w+\s*\(/,                     // 函数定义
        /import\s+\w+/,                       // import语句
        /from\s+\w+\s+import/,                // from import语句
        /class\s+\w+.*:/,                     // 类定义
        /if\s+.*:/,                           // if语句
        /for\s+\w+\s+in\s+.*:/,               // for循环
        /while\s+.*:/,                        // while循环
        /try:/,                               // try语句
        /with\s+.*as\s+\w+:/,                 // with语句
        /print\s*\(/,                         // print语句
        /if\s+__name__\s*==\s*["']__main__["']/ // main检查
      ];
      const pyScore = pyPatterns.filter(pattern => pattern.test(contentLower)).length;
      if (pyScore >= 3) {
        return parsers.get('python') || null;
      }

      // TypeScript/JavaScript特征检测 - 增强版本
      const jsPatterns = [
        /(const|let|var)\s+\w+/,              // 变量声明
        /function\s+\w+\s*\(/,                // 函数定义
        /=>/,                                 // 箭头函数
        /import\s+.*from\s+/,                // import语句
        /export\s+(default\s+)?\w+/,         // export语句
        /class\s+\w+/,                        // 类定义
        /console\.(log|error|warn|info)/,    // console调用
        /document\.(getElementById|querySelector)/, // DOM操作
        /require\s*\(/,                       // CommonJS
        /window\./,                           // window对象
        /async\s+function/                    // async函数
      ];
      const jsScore = jsPatterns.filter(pattern => pattern.test(contentLower)).length;
      if (jsScore >= 3) {
        return parsers.get('typescript') || null;
      }

      // Java特征检测
      const javaPatterns = [
        /public\s+class\s+\w+/,               // 公共类
        /private\s+\w+\s+\w+/,                // 私有字段
        /public\s+static\s+void\s+main/,     // main方法
        /import\s+java\./,                    // Java导入
        /System\.out\.println/,               // 输出语句
        /new\s+\w+\(/,                        // 对象创建
        /@Override/,                          // 注解
        /throws\s+\w+/                        // 异常声明
      ];
      const javaScore = javaPatterns.filter(pattern => pattern.test(contentLower)).length;
      if (javaScore >= 3) {
        return parsers.get('java') || null;
      }

      // C/C++特征检测
      const cppPatterns = [
        /#include\s+[<"]/,                    // 头文件包含
        /int\s+main\s*\(/,                    // main函数
        /std::\w+/,                           // std命名空间
        /cout\s*<</,                          // 输出流
        /cin\s*>>/,                           // 输入流
        /using\s+namespace\s+std/,            // using声明
        /class\s+\w+/,                        // 类定义
        /template\s*</,                       // 模板
        /#define\s+\w+/                        // 宏定义
      ];
      const cppScore = cppPatterns.filter(pattern => pattern.test(contentLower)).length;
      if (cppScore >= 3) {
        return parsers.get('cpp') || null;
      }

      return null;
    } catch (error) {
      console.error('Language detection by content features failed:', error);
      return null;
    }
  }

  /**
   * 创建扩展名到TreeSitter解析器的映射
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
   */
  isLanguageSupported(language: string, parsers: Map<string, ParserLanguage>): boolean {
    const parser = parsers.get(language.toLowerCase());
    return parser ? parser.supported : false;
  }

  /**
   * 获取所有支持的语言列表
   */
  getSupportedLanguages(parsers: Map<string, ParserLanguage>): ParserLanguage[] {
    return Array.from(parsers.values()).filter(lang => lang.supported);
  }
}