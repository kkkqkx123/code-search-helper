/**
 * Parser工具类统一导出
 */

import { languageUtils } from './language';
import { syntaxUtils } from './syntax';

// 语言相关工具
export * from './language';

// 语法相关工具
export * from './syntax';

// 明确导出常用工具
export { languageExtensionMap, fileUtils } from './language';

// 便捷导出
export { languageUtils } from './language';
export { syntaxUtils } from './syntax';

// 统一工具对象
export const parserUtils = {
  language: languageUtils,
  syntax: syntaxUtils
};