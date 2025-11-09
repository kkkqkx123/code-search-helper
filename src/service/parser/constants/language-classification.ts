/**
 * 语言分类相关工具函数
 * 包含语言家族、编译类型、编程范式等分类逻辑
 */

import { LanguageFamily } from './language-family';

/**
 * 语言分类工具函数集合
 */
export const LanguageClassificationUtils = {
  /**
   * 获取语言家族
   */
  getLanguageFamily(language: string): LanguageFamily {
    const familyMap: Record<string, LanguageFamily> = {
      javascript: LanguageFamily.JAVASCRIPT,
      typescript: LanguageFamily.JAVASCRIPT,
      java: LanguageFamily.JAVA,
      c: LanguageFamily.C,
      cpp: LanguageFamily.C,
      csharp: LanguageFamily.C,
      python: LanguageFamily.PYTHON,
      ruby: LanguageFamily.SCRIPTING,
      php: LanguageFamily.SCRIPTING,
      perl: LanguageFamily.SCRIPTING,
      html: LanguageFamily.MARKUP,
      xml: LanguageFamily.MARKUP,
      css: LanguageFamily.STYLE,
      scss: LanguageFamily.STYLE,
      less: LanguageFamily.STYLE,
      json: LanguageFamily.DATA,
      yaml: LanguageFamily.DATA,
      yml: LanguageFamily.DATA,
      sql: LanguageFamily.DATA,
      haskell: LanguageFamily.FUNCTIONAL,
      lisp: LanguageFamily.FUNCTIONAL,
      clojure: LanguageFamily.FUNCTIONAL,
      fsharp: LanguageFamily.FUNCTIONAL
    };
    return familyMap[language.toLowerCase()] || LanguageFamily.UNKNOWN;
  },

  /**
   * 检测是否为编译型语言
   */
  isCompiledLanguage(language: string): boolean {
    const compiledLangs = ['java', 'c', 'cpp', 'csharp', 'go', 'rust', 'swift', 'kotlin', 'scala', 'dart', 'haskell', 'objc'];
    return compiledLangs.includes(language.toLowerCase());
  },

  /**
   * 检测是否为解释型语言
   */
  isInterpretedLanguage(language: string): boolean {
    const interpretedLangs = ['javascript', 'typescript', 'python', 'ruby', 'php', 'perl', 'lua', 'bash', 'sh', 'powershell', 'r', 'matlab'];
    return interpretedLangs.includes(language.toLowerCase());
  },

  /**
   * 检测是否为脚本语言
   */
  isScriptingLanguage(language: string): boolean {
    const scriptingLangs = ['javascript', 'typescript', 'python', 'ruby', 'php', 'perl', 'lua', 'bash', 'sh', 'powershell'];
    return scriptingLangs.includes(language.toLowerCase());
  },

  /**
   * 检测是否为标记语言
   */
  isMarkupLanguage(language: string): boolean {
    const markupLangs = ['html', 'xml', 'svg', 'xhtml'];
    return markupLangs.includes(language.toLowerCase());
  },

  /**
   * 检测是否为样式语言
   */
  isStyleLanguage(language: string): boolean {
    const styleLangs = ['css', 'scss', 'sass', 'less', 'stylus'];
    return styleLangs.includes(language.toLowerCase());
  },

  /**
   * 检测是否支持面向对象
   */
  supportsOOP(language: string): boolean {
    const oopLangs = ['java', 'cpp', 'csharp', 'python', 'ruby', 'php', 'javascript', 'typescript', 'swift', 'kotlin', 'scala', 'dart', 'go'];
    return oopLangs.includes(language.toLowerCase());
  },

  /**
   * 检测是否支持函数式编程
   */
  supportsFunctional(language: string): boolean {
    const functionalLangs = ['javascript', 'typescript', 'python', 'haskell', 'lisp', 'clojure', 'fsharp', 'scala', 'swift', 'kotlin', 'rust', 'go'];
    return functionalLangs.includes(language.toLowerCase());
  },

  /**
   * 检测是否支持异步编程
   */
  supportsAsync(language: string): boolean {
    const asyncLangs = ['javascript', 'typescript', 'python', 'csharp', 'java', 'rust', 'go', 'swift', 'kotlin', 'dart'];
    return asyncLangs.includes(language.toLowerCase());
  },

  /**
   * 检测是否支持泛型
   */
  supportsGenerics(language: string): boolean {
    const genericLangs = ['java', 'cpp', 'csharp', 'typescript', 'swift', 'kotlin', 'scala', 'dart', 'rust', 'fsharp', 'haskell'];
    return genericLangs.includes(language.toLowerCase());
  },

  /**
   * 检测是否支持模块系统
   */
  supportsModules(language: string): boolean {
    const moduleLangs = ['javascript', 'typescript', 'python', 'java', 'csharp', 'rust', 'go', 'swift', 'kotlin', 'scala', 'dart', 'php'];
    return moduleLangs.includes(language.toLowerCase());
  }
};