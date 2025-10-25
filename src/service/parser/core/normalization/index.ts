/**
 * 查询结果标准化转换模块
 */

// 类型定义
export * from './types';

// 核心组件
export { QueryResultNormalizer } from './QueryResultNormalizer';

// 基础架构
export { BaseLanguageAdapter } from './BaseLanguageAdapter';
export { LanguageAdapterFactory } from './LanguageAdapterFactory';
export { QueryTypeMapper } from './QueryTypeMappings';

// 语言适配器
export * from './adapters';

// 便捷导出
import { QueryResultNormalizer } from './QueryResultNormalizer';
import { LanguageAdapterFactory } from './LanguageAdapterFactory';

/**
 * 创建标准化器实例的便捷函数
 */
export function createQueryResultNormalizer(options?: import('./types').NormalizationOptions) {
  return new QueryResultNormalizer(options);
}

/**
 * 获取语言适配器的便捷函数
 */
export async function getLanguageAdapter(language: string) {
  return LanguageAdapterFactory.getAdapter(language);
}

/**
 * 注册语言适配器的便捷函数
 */
export function registerLanguageAdapter(
  language: string, 
  adapterFactory: () => import('./types').ILanguageAdapter
) {
  console.warn('registerLanguageAdapter is deprecated, please use LanguageAdapterFactory.registerCustomAdapter');
}

/**
 * 获取支持的语言列表
 */
export function getSupportedLanguages(): string[] {
  return LanguageAdapterFactory.getSupportedLanguages();
}