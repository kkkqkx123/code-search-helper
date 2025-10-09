import { injectable } from 'inversify';
import { LoggerService } from '../../../utils/LoggerService';

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
    this.shebangPatterns = new Map([
      ['#!/bin/bash', 'shell'],
      ['#!/bin/sh', 'shell'],
      ['#!/usr/bin/env bash', 'shell'],
      ['#!/usr/bin/env sh', 'shell'],
      ['#!/usr/bin/env python', 'python'],
      ['#!/usr/bin/env python3', 'python'],
      ['#!/usr/bin/env python2', 'python'],
      ['#!/usr/bin/python', 'python'],
      ['#!/usr/bin/python3', 'python'],
      ['#!/usr/bin/env node', 'javascript'],
      ['#!/usr/bin/env nodejs', 'javascript'],
      ['#!/usr/bin/node', 'javascript'],
      ['#!/usr/bin/env ruby', 'ruby'],
      ['#!/usr/bin/env perl', 'perl'],
      ['#!/usr/bin/env php', 'php'],
      ['#!/usr/bin/env lua', 'lua'],
      ['#!/usr/bin/env awk', 'awk'],
      ['#!/usr/bin/env sed', 'sed'],
      ['#!/usr/bin/env tcl', 'tcl'],
      ['#!/usr/bin/env expect', 'expect'],
      ['!/usr/bin/env fish', 'fish'],
      ['!/usr/bin/env zsh', 'zsh'],
      ['!/usr/bin/env ksh', 'ksh'],
      ['!/usr/bin/env csh', 'csh'],
      ['!/usr/bin/env tcsh', 'tcsh']
    ]);

    // 语法模式 - 基于代码特征的检测
    this.syntaxPatterns = new Map([
      ['python', [
        /^import\s+\w+/m,
        /^from\s+\w+\s+import/m,
        /^def\s+\w+\s*\(/m,
        /^class\s+\w+/m,
        /print\s*\(/m,
        /self\./m,
        /if\s+__name__\s*==\s*['"']__main__['"']/m,
        /#\s*.*$/m, // Python注释
        /\"\"\"[\s\S]*?\"\"\"/m, // Python多行注释
        /'''[\\s\\S]*?'''/m
      ]],
      ['javascript', [
        /function\s+\w+\s*\(/m,
        /const\s+\w+\s*=/m,
        /let\s+\w+\s*=/m,
        /var\s+\w+\s*=/m,
        /import\s+.*from\s+['"`]/m,
        /export\s+(default\s+)?/m,
        /require\s*\(/m,
        /module\.exports/m,
        /console\.log/m,
        /=>\s*{/m, // 箭头函数
        /\/\*[\s\S]*?\*\//m, // 多行注释
        /\/\/.*$/m // 单行注释
      ]],
      ['typescript', [
        // JavaScript的所有模式
        ...this.syntaxPatterns.get('javascript') || [],
        // TypeScript特有模式
        /interface\s+\w+/m,
        /type\s+\w+\s*=/m,
        /declare\s+/m,
        /as\s+\w+/m,
        /:\s*(string|number|boolean|void|any|unknown)/m,
        /Promise<[^>]+>/m,
        /Array<[^>]+>/m,
        /enum\s+\w+/m,
        /abstract\s+class/m,
        /implements\s+\w+/m,
        /extends\s+\w+/m,
        /private\s+/m,
        /public\s+/m,
        /protected\s+/m,
        /readonly\s+/m
      ]],
      ['java', [
        /public\s+class\s+\w+/m,
        /private\s+class\s+\w+/m,
        /package\s+[\w.]+/m,
        /import\s+[\w.]+/m,
        /public\s+static\s+void\s+main/m,
        /System\.out\.println/m,
        /@\w+/m, // 注解
        /extends\s+\w+/m,
        /implements\s+\w+/m,
        /throws\s+\w+/m,
        /@\w+/m
      ]],
      ['cpp', [
        /#include\s*<[^>]+>/m,
        /#include\s*"[^"]+"/m,
        /using\s+namespace\s+\w+/m,
        /std::/m,
        /cout\s*<</m,
        /cin\s*>>/m,
        /template\s*<[^>]*>/m,
        /class\s+\w+/m,
        /namespace\s+\w+/m,
        /\/\*[\s\S]*?\*\//m,
        /\/\/.*$/m
      ]],
      ['c', [
        /#include\s*<[^>]+>/m,
        /#include\s*"[^"]+"/m,
        /printf\s*\(/m,
        /scanf\s*\(/m,
        /malloc\s*\(/m,
        /free\s*\(/m,
        /struct\s+\w+/m,
        /typedef\s+/m,
        /\/\*[\s\S]*?\*\//m,
        /\/\/.*$/m
      ]],
      ['go', [
        /package\s+\w+/m,
        /import\s*\(/m,
        /import\s+"[^"]+"/m,
        /func\s+\w+\s*\(/m,
        /go\s+\w+\s*\(/m,
        /chan\s+\w+/m,
        /select\s*{/m,
        /defer\s+/m,
        /range\s+/m,
        /\/\/.*$/m,
        /\/\*[\s\S]*?\*\//m
      ]],
      ['rust', [
        /use\s+[\w:]+/m,
        /fn\s+\w+\s*\(/m,
        /let\s+mut\s+\w+/m,
        /let\s+\w+/m,
        /impl\s+\w+/m,
        /struct\s+\w+/m,
        /enum\s+\w+/m,
        /match\s+\w+\s*{/m,
        /Some\(/m,
        /None/m,
        /Ok\(/m,
        /Err\(/m,
        /->\s+\w+/m,
        /\/\/.*$/m,
        /\/\*[\s\S]*?\*\//m
      ]],
      ['ruby', [
        /require\s+['"`][^'"`]+['"`]/m,
        /def\s+\w+/m,
        /class\s+\w+/m,
        /module\s+\w+/m,
        /puts\s+/m,
        /print\s+/m,
        /@\w+/m, // 实例变量
        /\$ \w+/m, // 全局变量
        /\w+\s*do\s*\|/m,
        /end\s*$/m,
        /#\s*.*$/m
      ]],
      ['php', [
        /<\?php/m,
        /\$\w+\s*=/m, // 变量
        /function\s+\w+\s*\(/m,
        /class\s+\w+/m,
        /echo\s+/m,
        /print\s+/m,
        /include\s+/m,
        /require\s+/m,
        /namespace\s+\w+/m,
        /use\s+\w+/m,
        /\/\*[\s\S]*?\*\//m,
        /\/\/.*$/m
      ]],
      ['shell', [
        /#!/bin\/[a-z]+/m,
        /\$\{?\w+\}?/m, // 变量
        /function\s+\w+\s*\(\s*\)/m,
        /if\s+\[/m,
        /for\s+\w+/m,
        /while\s+/m,
        /echo\s+/m,
        /export\s+\w+/m,
        /#\s*.*$/m
      ]],
      ['json', [
        /^\s*\{[\s\S]*\}\s*$/m,
        /^\s*\[[\s\S]*\]\s*$/m,
        /"\w+"\s*:/m,
        /:\s*"[^"]*"/m,
        /:\s*\d+/m,
        /:\s*(true|false|null)/m
      ]],
      ['yaml', [
        /^\w+:\s*.*$/m,
        /^\s+-\s+/m,
        /^\s*\w+:\s*\n(\s{2,}.*\n)*/m,
        /true|false|null/m,
        /#\s*.*$/m
      ]],
      ['html', [
        /<!DOCTYPE\s+html>/i,
        /<html[^>]*>/i,
        /<head[^>]*>/i,
        /<body[^>]*>/i,
        /<div[^>]*>/i,
        /<script[^>]*>/i,
        /<style[^>]*>/i,
        /<link[^>]*>/i,
        /<meta[^>]*>/i,
        /<!--[\s\S]*?-->/m
      ]],
      ['css', [
        /\w+\s*\{\s*[^}]*\}/m,
        /\.\w+\s*\{/m, // 类选择器
        /#\w+\s*\{/m, // ID选择器
        /@\w+/m, // @规则
        /color\s*:/m,
        /background\s*:/m,
        /margin\s*:/m,
        /padding\s*:/m,
        /\/\*[\s\S]*?\*\//m
      ]],
      ['sql', [
        /SELECT\s+.+\s+FROM\s+/i,
        /INSERT\s+INTO\s+/i,
        /UPDATE\s+.+\s+SET\s+/i,
        /DELETE\s+FROM\s+/i,
        /CREATE\s+TABLE\s+/i,
        /ALTER\s+TABLE\s+/i,
        /DROP\s+TABLE\s+/i,
        /WHERE\s+/i,
        /ORDER\s+BY\s+/i,
        /GROUP\s+BY\s+/i,
        /HAVING\s+/i,
        /JOIN\s+/i,
        /--\s*.*$/m,
        /\/\*[\s\S]*?\*\//m
      ]],
      ['dockerfile', [
        /FROM\s+\w+/i,
        /RUN\s+/i,
        /COPY\s+/i,
        /ADD\s+/i,
        /CMD\s+/i,
        /ENTRYPOINT\s+/i,
        /ENV\s+/i,
        /EXPOSE\s+/i,
        /VOLUME\s+/i,
        /WORKDIR\s+/i,
        /USER\s+/i,
        /#\s*.*$/m
      ]],
      ['markdown', [
        /^#\s+.*$/m, // 标题
        /^\*\*.*\*\*$/m, // 粗体
        /\*.*\*/m, // 斜体
        /\[.*\]\(.*\)/m, // 链接
        /!\[.*\]\(.*\)/m, // 图片
        /```[\s\S]*?```/m, // 代码块
        /^>\s+.*$/m, // 引用
        /^\d+\.\s+.*$/m, // 有序列表
        /^-\s+.*$/m, // 无序列表
        /^\*\s+.*$/m,
        /^\+\s+.*$/m
      ]],
      ['xml', [
        /<\?xml\s+version/i,
        /<[^>]+>/m,
        /<\/[^>]+>/m,
        /<[^\/>]+\/>/m, // 自闭合标签
        /<!--[\s\S]*?-->/m
      ]],
      ['toml', [
        /^\w+\s*=\s*".*"/m,
        /^\w+\s*=\s*\d+/m,
        /^\w+\s*=\s*(true|false)/m,
        /^\[\w+\]$/m,
        /#\s*.*$/m
      ]],
      ['ini', [
        /^\[\w+\]$/m,
        /^\w+\s*=\s*.*$/m,
        /;\s*.*$/m,
        /#\s*.*$/m
      ]],
      ['makefile', [
        /^\w+:\s*$/m,
        /^\w+:\s+.*$/m,
        /^\t\w+/m, // 命令
        /\$\(\w+\)/m, // 变量
        /\$\{\w+\}/m, // 变量
        /ifeq\s+/m,
        /endif/m,
        /#\s*.*$/m
      ]],
      ['cmake', [
        /cmake_minimum_required\s*\(/m,
        /project\s*\(/m,
        /add_executable\s*\(/m,
        /add_library\s*\(/m,
        /target_link_libraries\s*\(/m,
        /find_package\s*\(/m,
        /include_directories\s*\(/m,
        /set\s*\(/m,
        /message\s*\(/m,
        /#\s*.*$/m
      ]],
      ['perl', [
        /use\s+\w+/m,
        /my\s+\$\w+/m,
        /our\s+\$\w+/m,
        /sub\s+\w+/m,
        /\$\w+\s*=/m,
        /print\s+/m,
        /if\s*\(/m,
        /#\s*.*$/m
      ]],
      ['lua', [
        /require\s+['"`][^'"`]+['"`]/m,
        /function\s+\w+/m,
        /local\s+\w+/m,
        /print\s*\(/m,
        /if\s+/m,
        /for\s+/m,
        /while\s+/m,
        /--\s*.*$/m,
        /--\[\[ [\s\S]*? \]\]/m
      ]],
      ['r', [
        /library\s*\(/m,
        /<-/m,
        /function\s*\(/m,
        /for\s*\(/m,
        /if\s*\(/m,
        /print\s*\(/m,
        /#\s*.*$/m
      ]],
      ['matlab', [
        /function\s+\w+/m,
        /end\s*$/m,
        /disp\s*\(/m,
        /fprintf\s*\(/m,
        /if\s+/m,
        /for\s+/m,
        /while\s+/m,
        /%\s*.*$/m
      ]]
    ]);

    // 文件结构模式
    this.fileStructurePatterns = new Map([
      ['dockerfile', /^(FROM|RUN|COPY|ADD|CMD|ENTRYPOINT|ENV|EXPOSE|VOLUME|WORKDIR|USER)/i],
      ['makefile', /^[a-zA-Z_][a-zA-Z0-9_]*\s*:/m],
      ['cmake', /^(cmake_minimum_required|project|add_executable|add_library)/i],
      ['python', /^(import|from|def|class)\s+/m]
    ]);
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

    let bestMatch = { language: 'unknown', confidence: 0, indicators: [] };

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
    
    for (const [pattern, language] of this.shebangPatterns) {
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
    let bestMatch = { language: 'unknown', confidence: 0, indicators: [] };

    for (const [language, patterns] of this.syntaxPatterns) {
      let matches = 0;
      const indicators: string[] = [];

      for (const pattern of patterns) {
        if (pattern.test(firstFewLines)) {
          matches++;
          indicators.push(pattern.source);
        }
      }

      const totalPatterns = patterns.length;
      const confidence = matches / totalPatterns;

      if (confidence > bestMatch.confidence && matches >= 2) {
        bestMatch = {
          language,
          confidence,
          indicators: indicators.slice(0, 3) // 最多保留3个指示器
        };
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
    let bestMatch = { language: 'unknown', confidence: 0, indicators: [] };

    for (const [language, pattern] of this.fileStructurePatterns) {
      if (pattern.test(firstFewLines)) {
        return {
          language,
          confidence: 0.7,
          indicators: [`structure: ${pattern.source}`]
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