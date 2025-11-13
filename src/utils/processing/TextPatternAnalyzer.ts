import { TopLevelStructure, NestedStructure, InternalStructure, LanguagePattern } from '../types/ContentTypes';

/**
 * 文本模式分析器
 * 负责基于文本模式匹配进行代码结构分析
 * 作为AST分析的降级方案
 */
export class TextPatternAnalyzer {

  /**
   * 提取顶级结构
   * 基于文本模式匹配提取代码中的顶级结构
   */
  static extractTopLevelStructures(content: string, language: string): TopLevelStructure[] {
    const structures: TopLevelStructure[] = [];
    const lines = content.split('\n');

    // 根据语言定义不同的模式
    const patterns = this.getLanguagePatterns(language);

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern.regex);

      for (const match of matches) {
        const startLine = this.getLineNumber(content, match.index!);
        const endLine = this.findStructureEnd(content, startLine, pattern.type);

        structures.push({
          type: pattern.type,
          name: this.extractName(match, pattern.type),
          content: lines.slice(startLine - 1, endLine).join('\n'),
          location: {
            startLine,
            endLine
          },
          node: null, // 文本模式没有AST节点
          metadata: {
            language,
            confidence: pattern.confidence || 0.8
          }
        });
      }
    }

    return structures;
  }

  /**
   * 提取嵌套结构
   */
  static extractNestedStructures(
    content: string,
    parentNode: any,
    level: number
  ): NestedStructure[] {
    const structures: NestedStructure[] = [];

    // 基于文本模式匹配的嵌套结构提取
    const patterns = [
      { type: 'method', regex: /\b(function|def|func)\s+(\w+)\s*\([^)]*\)/g },
      { type: 'nested_class', regex: /\b(class|struct)\s+(\w+)/g },
      { type: 'nested_function', regex: /\b(function|def|func)\s+(\w+)\s*\([^)]*\)/g },
      { type: 'control-flow', regex: /\b(if|for|while|switch|case)\s*\([^)]*\)/g },
      { type: 'expression', regex: /\b(return|throw|yield)\s+[^;]+/g },
      { type: 'config-item', regex: /\b\w+\s*:\s*[^,\n]+/g },
      { type: 'section', regex: /\[[^\]]+\]/g },
      { type: 'key', regex: /\b\w+\s*=/g },
      { type: 'value', regex: /=\s*[^,\n]+/g },
      { type: 'array', regex: /\[[^\]]*\]/g },
      { type: 'table', regex: /\{[^}]*\}/g },
      { type: 'dependency', regex: /\b(import|require|include)\s+[^;\n]+/g },
      { type: 'type-def', regex: /\b(type|typedef|interface)\s+\w+/g },
      { type: 'call', regex: /\b\w+\s*\([^)]*\)/g },
      { type: 'data-flow', regex: /\b\w+\s*->\s*\w+/g },
      { type: 'parameter-flow', regex: /\b\w+\s*:\s*\w+/g },
      { type: 'union', regex: /\b\w+\s*\|\s*\w+/g },
      { type: 'annotation', regex: /@\w+/g }
    ];

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern.regex);

      for (const match of matches) {
        const startLine = this.getLineNumber(content, match.index!);
        const endLine = this.findStructureEnd(content, startLine, pattern.type);

        structures.push({
          type: pattern.type,
          name: match[2] || 'unknown',
          content: content.split('\n').slice(startLine - 1, endLine).join('\n'),
          location: {
            startLine,
            endLine
          },
          parentNode,
          level,
          metadata: {
            nestingLevel: level,
            confidence: 0.7
          }
        });
      }
    }

    return structures;
  }

  /**
   * 提取内部结构
   */
  static extractInternalStructures(content: string, parentNode: any): InternalStructure[] {
    const structures: InternalStructure[] = [];
    const lines = content.split('\n');

    // 提取重要变量声明
    const variablePattern = /\b(const|let|var)\s+(\w+)\s*=\s*([^;]+)/g;
    let match;

    while ((match = variablePattern.exec(content)) !== null) {
      const lineNum = this.getLineNumber(content, match.index);

      structures.push({
        type: 'variable',
        name: match[2],
        content: match[0],
        location: {
          startLine: lineNum,
          endLine: lineNum
        },
        parentNode,
        importance: 'medium',
        metadata: {
          variableType: match[1],
          confidence: 0.8
        }
      });
    }

    // 提取控制流结构
    const controlFlowPatterns = [
      { type: 'if', regex: /\bif\s*\([^)]+\)/g, importance: 'high' as const },
      { type: 'for', regex: /\bfor\s*\([^)]+\)/g, importance: 'high' as const },
      { type: 'while', regex: /\bwhile\s*\([^)]+\)/g, importance: 'high' as const },
      { type: 'switch', regex: /\bswitch\s*\([^)]+\)/g, importance: 'high' as const }
    ];

    for (const pattern of controlFlowPatterns) {
      const matches = content.matchAll(pattern.regex);

      for (const match of matches) {
        const lineNum = this.getLineNumber(content, match.index!);

        structures.push({
          type: pattern.type,
          name: pattern.type,
          content: match[0],
          location: {
            startLine: lineNum,
            endLine: lineNum
          },
          parentNode,
          importance: pattern.importance,
          metadata: {
            confidence: 0.9
          }
        });
      }
    }

    return structures;
  }

  /**
   * 获取语言模式
   */
  private static getLanguagePatterns(language: string): LanguagePattern[] {
    const patterns: Record<string, LanguagePattern[]> = {
      javascript: [
        { type: 'function', regex: /\bfunction\s+(\w+)\s*\([^)]*\)/g, confidence: 0.9 },
        { type: 'class', regex: /\bclass\s+(\w+)/g, confidence: 0.9 },
        { type: 'variable', regex: /\b(?:const|let|var)\s+(\w+)\s*=/g, confidence: 0.8 },
        { type: 'import', regex: /\bimport\s+.*?from\s+['"]([^'"]+)['"]/g, confidence: 0.9 },
        { type: 'export', regex: /\bexport\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g, confidence: 0.9 }
      ],
      typescript: [
        { type: 'function', regex: /\bfunction\s+(\w+)\s*\([^)]*\)/g, confidence: 0.9 },
        { type: 'class', regex: /\bclass\s+(\w+)/g, confidence: 0.9 },
        { type: 'interface', regex: /\binterface\s+(\w+)/g, confidence: 0.9 },
        { type: 'variable', regex: /\b(?:const|let|var)\s+(\w+)\s*:/g, confidence: 0.8 },
        { type: 'import', regex: /\bimport\s+.*?from\s+['"]([^'"]+)['"]/g, confidence: 0.9 },
        { type: 'export', regex: /\bexport\s+(?:default\s+)?(?:function|class|interface|const|let|var)\s+(\w+)/g, confidence: 0.9 }
      ],
      python: [
        { type: 'function', regex: /\bdef\s+(\w+)\s*\([^)]*\):/g, confidence: 0.9 },
        { type: 'class', regex: /\bclass\s+(\w+):/g, confidence: 0.9 },
        { type: 'import', regex: /\b(?:import|from)\s+(\w+)/g, confidence: 0.9 },
        { type: 'variable', regex: /^(\w+)\s*=/gm, confidence: 0.7 }
      ],
      java: [
        { type: 'class', regex: /\b(?:public\s+)?class\s+(\w+)/g, confidence: 0.9 },
        { type: 'interface', regex: /\b(?:public\s+)?interface\s+(\w+)/g, confidence: 0.9 },
        { type: 'method', regex: /\b(?:public|private|protected)?\s*(?:static\s+)?(?:\w+\s+)?(\w+)\s*\([^)]*\)/g, confidence: 0.8 },
        { type: 'import', regex: /\bimport\s+([\w.]+);/g, confidence: 0.9 }
      ],
      go: [
        { type: 'function', regex: /\bfunc\s+(\w+)\s*\([^)]*\)/g, confidence: 0.9 },
        { type: 'struct', regex: /\btype\s+(\w+)\s+struct/g, confidence: 0.9 },
        { type: 'interface', regex: /\btype\s+(\w+)\s+interface/g, confidence: 0.9 },
        { type: 'import', regex: /\bimport\s+['"]([^'"]+)['"]/g, confidence: 0.9 }
      ],
      rust: [
        { type: 'function', regex: /\bfn\s+(\w+)\s*\([^)]*\)/g, confidence: 0.9 },
        { type: 'struct', regex: /\bstruct\s+(\w+)/g, confidence: 0.9 },
        { type: 'enum', regex: /\benum\s+(\w+)/g, confidence: 0.9 },
        { type: 'trait', regex: /\btrait\s+(\w+)/g, confidence: 0.9 },
        { type: 'impl', regex: /\bimpl\s+(\w+)/g, confidence: 0.9 }
      ],
      cpp: [
        { type: 'function', regex: /\b\w+\s+(\w+)\s*\([^)]*\)/g, confidence: 0.8 },
        { type: 'class', regex: /\bclass\s+(\w+)/g, confidence: 0.9 },
        { type: 'struct', regex: /\bstruct\s+(\w+)/g, confidence: 0.9 },
        { type: 'include', regex: /\b#include\s+[<"]([^>"]+)[>"]/g, confidence: 0.9 }
      ],
      c: [
        { type: 'function', regex: /\b\w+\s+(\w+)\s*\([^)]*\)/g, confidence: 0.8 },
        { type: 'struct', regex: /\bstruct\s+(\w+)/g, confidence: 0.9 },
        { type: 'include', regex: /\b#include\s+[<"]([^>"]+)[>"]/g, confidence: 0.9 }
      ],
      json: [
        { type: 'object', regex: /\{[^}]*\}/g, confidence: 0.9 },
        { type: 'array', regex: /\[[^\]]*\]/g, confidence: 0.9 },
        { type: 'key_value', regex: /"([^"]+)"\s*:/g, confidence: 0.9 }
      ],
      yaml: [
        { type: 'key_value', regex: /^(\w+):\s*/gm, confidence: 0.9 },
        { type: 'array', regex: /^-\s+/gm, confidence: 0.9 },
        { type: 'section', regex: /^\w+:\s*$/gm, confidence: 0.9 }
      ]
    };

    return patterns[language] || patterns.javascript; // 默认使用JavaScript模式
  }

  /**
   * 获取行号
   */
  private static getLineNumber(content: string, index: number): number {
    const beforeIndex = content.substring(0, index);
    return beforeIndex.split('\n').length;
  }

  /**
   * 查找结构结束行
   */
  private static findStructureEnd(content: string, startLine: number, structureType: string): number {
    const lines = content.split('\n');
    let braceCount = 0;
    let inBlock = false;

    for (let i = startLine - 1; i < lines.length; i++) {
      const line = lines[i];

      // 检查大括号平衡
      const openBraces = (line.match(/\{/g) || []).length;
      const closeBraces = (line.match(/\}/g) || []).length;

      if (openBraces > 0) {
        braceCount += openBraces;
        inBlock = true;
      }

      if (closeBraces > 0) {
        braceCount -= closeBraces;
      }

      // 如果在块中且大括号平衡，则结构结束
      if (inBlock && braceCount === 0) {
        return i + 1;
      }

      // 对于没有大括号的结构（如Python），使用缩进判断
      if (structureType === 'function' || structureType === 'class') {
        const trimmedLine = line.trim();
        if (trimmedLine === '' && i > startLine) {
          // 空行可能表示结构结束
          return i;
        }
      }
    }

    // 如果没有找到明确的结束，返回文件末尾
    return lines.length;
  }

  /**
   * 提取名称
   */
  private static extractName(match: RegExpMatchArray, structureType: string): string {
    switch (structureType) {
      case 'function':
      case 'method':
      case 'class':
      case 'interface':
      case 'struct':
      case 'enum':
      case 'trait':
      case 'variable':
        return match[1] || match[2] || 'unknown';
      case 'import':
        return match[1] || 'import';
      case 'export':
        return match[1] || 'export';
      case 'key_value':
        return match[1] || 'key';
      default:
        return match[0] || 'unknown';
    }
  }

  /**
   * 检测代码语言（基于文件内容）
   */
  static detectLanguageFromContent(content: string): string {
    const patterns = {
      javascript: [/function\s+\w+\s*\(/, /\bconst\s+\w+\s*=/, /\blet\s+\w+\s*=/, /=>\s*{/],
      typescript: [/interface\s+\w+/, /type\s+\w+\s*=/, /:\s*\w+\[\]/, /as\s+\w+/],
      python: [/def\s+\w+\s*\(/, /class\s+\w+:/, /import\s+\w+/, /from\s+\w+\s+import/],
      java: [/public\s+class\s+\w+/, /public\s+interface\s+\w+/, /package\s+[\w.]+;/, /import\s+[\w.]+;/],
      go: [/func\s+\w+\s*\(/, /type\s+\w+\s+struct/, /package\s+\w+/, /import\s+\(/],
      rust: [/fn\s+\w+\s*\(/, /struct\s+\w+/, /enum\s+\w+/, /use\s+[\w:]+;/],
      cpp: [/#include\s*<\w+>/, /class\s+\w+/, /namespace\s+\w+/, /std::/],
      c: [/#include\s*<\w+>/, /struct\s+\w+/, /typedef\s+/, /\*\w+\s*=/],
      json: [/^\s*\{/, /^\s*\[/, /"\w+"\s*:/],
      yaml: [/^\w+\s*:/, /^-\s+\w+/, /^\s*\|/]
    };

    for (const [language, languagePatterns] of Object.entries(patterns)) {
      const matchCount = languagePatterns.filter(pattern => pattern.test(content)).length;
      if (matchCount >= 2) { // 至少匹配2个模式才认为是该语言
        return language;
      }
    }

    return 'text'; // 默认为纯文本
  }

  /**
   * 分析代码复杂度（基于文本）
   */
  static analyzeComplexityFromText(content: string): {
    cyclomaticComplexity: number;
    cognitiveComplexity: number;
    nestingDepth: number;
    linesOfCode: number;
  } {
    const lines = content.split('\n');
    const linesOfCode = lines.length;

    // 简单的文本模式匹配计算复杂度
    const complexityPatterns = [
      /\bif\b/g,
      /\bwhile\b/g,
      /\bfor\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /\?/g  // 三元运算符
    ];

    let cyclomaticComplexity = 1; // 基础复杂度
    complexityPatterns.forEach(pattern => {
      const matches = content.match(pattern);
      if (matches) {
        cyclomaticComplexity += matches.length;
      }
    });

    // 简单的嵌套深度计算
    let maxNestingDepth = 0;
    let currentNestingDepth = 0;

    lines.forEach(line => {
      const trimmedLine = line.trim();

      // 检查开始嵌套的语句
      if (/\b(if|while|for|switch|try|catch)\b/.test(trimmedLine)) {
        currentNestingDepth++;
        maxNestingDepth = Math.max(maxNestingDepth, currentNestingDepth);
      }

      // 简单的结束嵌套检测（不精确，但作为降级方案）
      if (/^\s*}\s*$/.test(trimmedLine)) {
        currentNestingDepth = Math.max(0, currentNestingDepth - 1);
      }
    });

    return {
      cyclomaticComplexity,
      cognitiveComplexity: cyclomaticComplexity, // 简化处理
      nestingDepth: maxNestingDepth,
      linesOfCode
    };
  }
}