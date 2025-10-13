/**
 * Parser工具类统一导出
 */

// 语言相关工具
export * from './language';

// 语法相关工具
export * from './syntax';

// 便捷导出
export { languageUtils } from './language';
export { syntaxUtils } from './syntax';

// 统一工具对象
export const parserUtils = {
  language: languageUtils,
  syntax: syntaxUtils
};