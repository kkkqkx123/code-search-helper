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
 * 策略工厂函数 - 简化版本
 * 根据策略名称创建策略实例
 */
export function createStrategy(strategyName: string, config?: any): any {
  switch (strategyName) {
    // 核心策略映射 - 直接映射到实现类
    case 'binary':
      return {
        execute: async (content: string) => ({
          chunks: [{ content, metadata: { type: 'binary' } }],
          success: true
        })
      };

    case 'markdown':
      return new (require('./implementations/MarkdownSegmentationStrategy').MarkdownSegmentationStrategy)(config);

    case 'xml':
      return new (require('./implementations/XMLSegmentationStrategy').XMLSegmentationStrategy)(config);

    case 'html':
      return new (require('./implementations/HybridHTMLStrategy').HybridHTMLStrategy)(config);

    case 'ast':
      return new (require('./implementations/ASTCodeSplitter').ASTCodeSplitter)(config);

    case 'bracket':
      return new (require('./implementations/BracketSegmentationStrategy').BracketSegmentationStrategy)(config);

    case 'line':
      return new (require('./implementations/LineSegmentationStrategy').LineSegmentationStrategy)(config);

    case 'text':
      return new (require('./implementations/UniversalTextStrategy').UniversalTextStrategy)(config);

    // 语义策略映射到括号策略
    case 'semantic':
      return new (require('./implementations/BracketSegmentationStrategy').BracketSegmentationStrategy)(config);

    // 最小化兼容性映射 - 只保留必要的
    case 'universal-text-segmentation':
      return new (require('./implementations/UniversalTextStrategy').UniversalTextStrategy)(config);

    case 'treesitter_ast':
      return new (require('./implementations/ASTCodeSplitter').ASTCodeSplitter)(config);

    case 'markdown_specialized':
      return new (require('./implementations/MarkdownSegmentationStrategy').MarkdownSegmentationStrategy)(config);

    case 'xml_specialized':
      return new (require('./implementations/XMLSegmentationStrategy').XMLSegmentationStrategy)(config);

    case 'html_layered':
      return new (require('./implementations/HybridHTMLStrategy').HybridHTMLStrategy)(config);

    case 'universal_bracket':
      return new (require('./implementations/BracketSegmentationStrategy').BracketSegmentationStrategy)(config);

    case 'universal_line':
      return new (require('./implementations/LineSegmentationStrategy').LineSegmentationStrategy)(config);

    case 'emergency_single_chunk':
      return {
        execute: async (content: string) => ({
          chunks: [{ content, metadata: { type: 'emergency' } }],
          success: true
        })
      };

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
 * 策略配置预设 - 更新为简化名称
 */
export const StrategyPresets = {
  /**
  * 小文件策略配置
  */
  smallFile: {
    'bracket': {
      maxChunkSize: 800,
      minChunkSize: 50,
      maxImbalance: 1
    },
    'line': {
      maxChunkSize: 500,
      minChunkSize: 50
    }
  },

  /**
  * 中等文件策略配置
  */
  mediumFile: {
    'bracket': {
      maxChunkSize: 1500,
      minChunkSize: 100,
      maxImbalance: 2
    },
    'line': {
      maxChunkSize: 1000,
      minChunkSize: 100
    }
  },

  /**
  * 大文件策略配置
  */
  largeFile: {
    'bracket': {
      maxChunkSize: 3000,
      minChunkSize: 200,
      maxImbalance: 3
    },
    'line': {
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