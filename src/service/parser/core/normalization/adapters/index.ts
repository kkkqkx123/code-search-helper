/**
 * 语言适配器模块导出
 */

export { TypeScriptLanguageAdapter } from './TypeScriptLanguageAdapter';
export { JavaScriptLanguageAdapter } from './JavaScriptLanguageAdapter';
export { PythonLanguageAdapter } from './PythonLanguageAdapter';
export { CLanguageAdapter } from './CLanguageAdapter';
export { CppLanguageAdapter } from './CppLanguageAdapter';
export { CSharpLanguageAdapter } from './CSharpLanguageAdapter';
export { RustLanguageAdapter } from './RustLanguageAdapter';
export { GoLanguageAdapter } from './GoLanguageAdapter';
export { DefaultLanguageAdapter } from './DefaultLanguageAdapter';
export { HtmlLanguageAdapter } from './HtmlLanguageAdapter';
export { VueLanguageAdapter } from './VueLanguageAdapter';
export { JavaLanguageAdapter } from './JavaLanguageAdapter';
export { KotlinLanguageAdapter } from './KotlinLanguageAdapter';
export { CssLanguageAdapter } from './CssLanguageAdapter';
export { ConfigLanguageAdapter } from './ConfigLanguageAdapter';
export { TOMLConfigAdapter } from './TOMLConfigAdapter';
export { YAMLConfigAdapter } from './YAMLConfigAdapter';
export { JSONConfigAdapter } from './JSONConfigAdapter';

import { TypeScriptLanguageAdapter } from './TypeScriptLanguageAdapter';
import { JavaScriptLanguageAdapter } from './JavaScriptLanguageAdapter';
import { PythonLanguageAdapter } from './PythonLanguageAdapter';
import { CLanguageAdapter } from './CLanguageAdapter';
import { CppLanguageAdapter } from './CppLanguageAdapter';
import { CSharpLanguageAdapter } from './CSharpLanguageAdapter';
import { RustLanguageAdapter } from './RustLanguageAdapter';
import { GoLanguageAdapter } from './GoLanguageAdapter';
import { DefaultLanguageAdapter } from './DefaultLanguageAdapter';
import { HtmlLanguageAdapter } from './HtmlLanguageAdapter';
import { VueLanguageAdapter } from './VueLanguageAdapter';
import { JavaLanguageAdapter } from './JavaLanguageAdapter';
import { KotlinLanguageAdapter } from './KotlinLanguageAdapter';
import { CssLanguageAdapter } from './CssLanguageAdapter';
import { ConfigLanguageAdapter } from './ConfigLanguageAdapter';
import { TOMLConfigAdapter } from './TOMLConfigAdapter';
import { YAMLConfigAdapter } from './YAMLConfigAdapter';
import { JSONConfigAdapter } from './JSONConfigAdapter';
import { ILanguageAdapter } from '../types';
import { LanguageAdapterFactory } from '../LanguageAdapterFactory';

/**
 * 重新导出增强的语言适配器工厂
 * 保持向后兼容性
 */
export { LanguageAdapterFactory } from '../LanguageAdapterFactory';

/**
 * @deprecated 请使用新的 LanguageAdapterFactory.getAdapter() 方法
 * 获取指定语言的适配器
 * @param language 编程语言
 * @returns 语言适配器实例
 */
export async function getAdapter(language: string): Promise<ILanguageAdapter> {
  return LanguageAdapterFactory.getAdapter(language);
}

/**
 * @deprecated 请使用新的 LanguageAdapterFactory.registerAdapter() 方法
 * 注册新的语言适配器
 * @param language 编程语言
 * @param adapterFactory 适配器工厂函数
 */
export function registerAdapter(language: string, adapterFactory: () => ILanguageAdapter): void {
  // 注意：新工厂不支持这种注册方式，这里仅保持兼容性
  console.warn('registerAdapter is deprecated, please use LanguageAdapterFactory.registerCustomAdapter');
}

/**
 * @deprecated 请使用新的 LanguageAdapterFactory.getSupportedLanguages() 方法
 * 获取所有支持的语言
 * @returns 支持的语言列表
 */
export function getSupportedLanguages(): string[] {
  return LanguageAdapterFactory.getSupportedLanguages();
}

/**
 * @deprecated 请使用新的 LanguageAdapterFactory.isLanguageSupported() 方法
 * 检查是否支持指定语言
 * @param language 编程语言
 * @returns 是否支持
 */
export function isSupported(language: string): boolean {
  return LanguageAdapterFactory.isLanguageSupported(language);
}