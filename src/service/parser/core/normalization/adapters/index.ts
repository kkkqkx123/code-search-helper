/**
 * 语言适配器模块导出
 */

export { TypeScriptLanguageAdapter } from './TypeScriptLanguageAdapter';
export { PythonLanguageAdapter } from './PythonLanguageAdapter';
export { CLanguageAdapter } from './CLanguageAdapter';
export { CppLanguageAdapter } from './CppLanguageAdapter';
export { CSharpLanguageAdapter } from './CSharpLanguageAdapter';
export { RustLanguageAdapter } from './RustLanguageAdapter';
export { DefaultLanguageAdapter } from './DefaultLanguageAdapter';
export { HtmlLanguageAdapter } from './HtmlLanguageAdapter';
export { VueLanguageAdapter } from './VueLanguageAdapter';
export { JavaLanguageAdapter } from './JavaLanguageAdapter';
export { KotlinLanguageAdapter } from './KotlinLanguageAdapter';
export { CssLanguageAdapter } from './CssLanguageAdapter';

import { TypeScriptLanguageAdapter } from './TypeScriptLanguageAdapter';
import { PythonLanguageAdapter } from './PythonLanguageAdapter';
import { CLanguageAdapter } from './CLanguageAdapter';
import { CppLanguageAdapter } from './CppLanguageAdapter';
import { CSharpLanguageAdapter } from './CSharpLanguageAdapter';
import { RustLanguageAdapter } from './RustLanguageAdapter';
import { DefaultLanguageAdapter } from './DefaultLanguageAdapter';
import { HtmlLanguageAdapter } from './HtmlLanguageAdapter';
import { VueLanguageAdapter } from './VueLanguageAdapter';
import { JavaLanguageAdapter } from './JavaLanguageAdapter';
import { KotlinLanguageAdapter } from './KotlinLanguageAdapter';
import { CssLanguageAdapter } from './CssLanguageAdapter';
import { ILanguageAdapter } from '../types';

/**
 * 语言适配器工厂
 */
export class LanguageAdapterFactory {
  private static adapters: Map<string, () => ILanguageAdapter> = new Map<string, () => ILanguageAdapter>([
    ['typescript', () => new TypeScriptLanguageAdapter()],
    ['javascript', () => new TypeScriptLanguageAdapter()], // JavaScript使用TypeScript适配器
    ['tsx', () => new TypeScriptLanguageAdapter()],
    ['jsx', () => new TypeScriptLanguageAdapter()],
    ['python', () => new PythonLanguageAdapter()],
    ['c', () => new CLanguageAdapter()],
    ['cpp', () => new CppLanguageAdapter()],
    ['csharp', () => new CSharpLanguageAdapter()],
    ['c#', () => new CSharpLanguageAdapter()],
    ['rust', () => new RustLanguageAdapter()],
    ['html', () => new HtmlLanguageAdapter()],
    ['vue', () => new VueLanguageAdapter()],
    ['vue3', () => new VueLanguageAdapter()],
    ['java', () => new JavaLanguageAdapter()],
    ['kotlin', () => new KotlinLanguageAdapter()],
    ['kt', () => new KotlinLanguageAdapter()], // Kotlin文件扩展名
    ['kts', () => new KotlinLanguageAdapter()], // Kotlin脚本文件扩展名
    ['css', () => new CssLanguageAdapter()],
  ]);

  /**
   * 获取指定语言的适配器
   * @param language 编程语言
   * @returns 语言适配器实例
   */
  static getAdapter(language: string): ILanguageAdapter {
    const adapterFactory = this.adapters.get(language.toLowerCase());
    if (adapterFactory) {
      return adapterFactory();
    }

    // 返回默认适配器
    return new DefaultLanguageAdapter();
  }

  /**
   * 注册新的语言适配器
   * @param language 编程语言
   * @param adapterFactory 适配器工厂函数
   */
  static registerAdapter(language: string, adapterFactory: () => ILanguageAdapter): void {
    this.adapters.set(language.toLowerCase(), adapterFactory);
  }

  /**
   * 获取所有支持的语言
   * @returns 支持的语言列表
   */
  static getSupportedLanguages(): string[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * 检查是否支持指定语言
   * @param language 编程语言
   * @returns 是否支持
   */
  static isSupported(language: string): boolean {
    return this.adapters.has(language.toLowerCase());
  }
}