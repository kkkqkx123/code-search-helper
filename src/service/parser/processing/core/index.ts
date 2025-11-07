/**
 * 核心模块统一导出
 * 提供处理系统的核心接口和类型定义
 */

// 导出所有接口
export * from './interfaces/IProcessingStrategy';
export * from './interfaces/IStrategyFactory';
export * from './interfaces/IProcessingContext';
export * from './interfaces/IPostProcessor';
export * from './interfaces/IConfigManager';
export * from './interfaces/IOverlapCalculator';

// 导出所有类型
export * from './types/ProcessingTypes';
export * from './types/ContextTypes';
export * from './types/ResultTypes';
export * from './types/ConfigTypes';

// 版本信息
export const CORE_MODULE_VERSION = '1.0.0';

// 模块元数据
export const CORE_MODULE_INFO = {
  name: 'processing-core',
  version: CORE_MODULE_VERSION,
  description: '代码处理模块核心接口和类型定义',
  author: 'Code Search Helper Team',
  dependencies: [] as string[],
  exports: [
    'interfaces/IProcessingStrategy',
    'interfaces/IStrategyFactory',
    'interfaces/IProcessingContext',
    'interfaces/IPostProcessor',
    'interfaces/IConfigManager',
    'types/ProcessingTypes',
    'types/ContextTypes',
    'types/ResultTypes',
    'types/ConfigTypes'
  ]
};