/**
 * 策略模块统一导出
 * 提供所有策略实现的统一访问接口
 */

// 基类导出
export { BaseStrategy } from './base/BaseStrategy';

// 策略实现导出 - 优化后保留的策略
export { BracketSegmentationStrategy } from './implementations/BracketSegmentationStrategy';
export { HybridHTMLStrategy } from './implementations/HybridHTMLStrategy';
export { LineSegmentationStrategy } from './implementations/LineSegmentationStrategy';
export { MarkdownSegmentationStrategy } from './implementations/MarkdownSegmentationStrategy';
export { XMLSegmentationStrategy } from './implementations/XMLSegmentationStrategy';
export { ASTCodeSplitter } from './implementations/ASTCodeSplitter';
export { UniversalTextStrategy } from './implementations/UniversalTextStrategy';

// 策略类型导出
export type { IProcessingStrategy } from '../core/interfaces/IProcessingStrategy';
export type { StrategyConfig, StrategyPerformanceStats } from '../types/Strategy';

// 导入统一优先级常量
import { UNIFIED_STRATEGY_PRIORITIES } from '../../constants/StrategyPriorities';

/**
 * 策略工厂函数
 * 根据策略名称创建策略实例
 */
export function createStrategy(strategyName: string, config?: any): any {
  switch (strategyName) {
    case 'line':
    case 'line-strategy':
      return new (require('./implementations/LineSegmentationStrategy').LineSegmentationStrategy)(config);

    // 移除的策略: semantic, ast, function, class, import, ast-segmentation

    case 'bracket-segmentation':
      return new (require('./implementations/BracketSegmentationStrategy').BracketSegmentationStrategy)(config);

    case 'layered-html':
      return new (require('./implementations/HybridHTMLStrategy').HybridHTMLStrategy)(config);

    case 'line-segmentation':
      return new (require('./implementations/LineSegmentationStrategy').LineSegmentationStrategy)(config);

    case 'markdown-segmentation':
      return new (require('./implementations/MarkdownSegmentationStrategy').MarkdownSegmentationStrategy)(config);

    case 'xml-segmentation':
      return new (require('./implementations/XMLSegmentationStrategy').XMLSegmentationStrategy)(config);

    case 'universal-text-segmentation':
      return new (require('./implementations/UniversalTextStrategy').UniversalTextStrategy)(config);

    default:
      throw new Error(`Unknown strategy: ${strategyName}`);
  }
}

/**
 * 获取所有可用策略名称
 */
export function getAvailableStrategies(): string[] {
  return Object.keys(UNIFIED_STRATEGY_PRIORITIES);
}

/**
 * 策略配置预设
 */
export const StrategyPresets = {
  /**
  * 小文件策略配置 - 优化后
  */
  smallFile: {
    'bracket-segmentation': {
      maxChunkSize: 800,
      minChunkSize: 50,
      maxImbalance: 1
    },
    'line-segmentation': {
      maxChunkSize: 500,
      minChunkSize: 50
    }
  },

  /**
  * 中等文件策略配置 - 优化后
  */
  mediumFile: {
    'bracket-segmentation': {
      maxChunkSize: 1500,
      minChunkSize: 100,
      maxImbalance: 2
    },
    'line-segmentation': {
      maxChunkSize: 1000,
      minChunkSize: 100
    }
  },

  /**
  * 大文件策略配置 - 优化后
  */
  largeFile: {
    'bracket-segmentation': {
      maxChunkSize: 3000,
      minChunkSize: 200,
      maxImbalance: 3
    },
    'line-segmentation': {
      maxChunkSize: 2000,
      minChunkSize: 200
    }
  }
};

/**
 * 根据文件大小选择策略配置预设
 */
export function selectStrategyPreset(fileSize: number): any {
  if (fileSize < 1000) {
    return StrategyPresets.smallFile;
  } else if (fileSize < 10000) {
    return StrategyPresets.mediumFile;
  } else {
    return StrategyPresets.largeFile;
  }
}
