/**
 * 语言相关工具类统一导出
 */

import { fileUtils } from './FileUtils';
import { languageExtensionMap } from './LanguageExtensionMap';
import { languageFeatureDetector } from './LanguageFeatureDetector';
import { languageWeightsProvider } from './LanguageWeights';

// 基础工具类
export { LanguageExtensionMap, languageExtensionMap } from './LanguageExtensionMap';
export type { ILanguageExtensionMap } from './LanguageExtensionMap';

export { FileUtils, fileUtils } from './FileUtils';
export type { IFileUtils } from './FileUtils';

export { LanguageWeights, LanguageWeightsProvider, languageWeightsProvider } from './LanguageWeights';
export type { ILanguageWeights } from './LanguageWeights';

export { LanguageFeatureDetector, languageFeatureDetector } from './LanguageFeatureDetector';
export type { ILanguageFeatureDetector } from './LanguageFeatureDetector';

// 便捷导出
export const languageUtils = {
  extensionMap: languageExtensionMap,
  fileUtils,
  weightsProvider: languageWeightsProvider,
  featureDetector: languageFeatureDetector
};