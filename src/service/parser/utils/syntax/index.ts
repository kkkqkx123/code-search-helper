/**
 * 语法相关工具类统一导出
 */

import { structureDetector } from './StructureDetector';
import { syntaxPatternMatcher } from './SyntaxPatternMatcher';

// 语法模式匹配和结构检测
export { SyntaxPatternMatcher, syntaxPatternMatcher } from './SyntaxPatternMatcher';
export type { ISyntaxPatternMatcher, LanguageDetectionResult } from './SyntaxPatternMatcher';

export { StructureDetector, structureDetector } from './StructureDetector';
export type { IStructureDetector } from './StructureDetector';

// 便捷导出
export const syntaxUtils = {
  patternMatcher: syntaxPatternMatcher,
  structureDetector: structureDetector
};