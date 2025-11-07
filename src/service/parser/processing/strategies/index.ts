/**
 * 策略模块统一导出
 * 提供所有策略实现的统一访问接口
 */

// 基类导出
export { BaseStrategy } from './base/BaseStrategy';

// 策略实现导出
export { LineStrategy } from './implementations/LineStrategy';
export { SemanticStrategy } from './implementations/SemanticStrategy';
export { ASTStrategy } from './implementations/ASTStrategy';
export { BracketStrategy } from './implementations/BracketStrategy';
export { FunctionStrategy } from './implementations/FunctionStrategy';
export { ClassStrategy } from './implementations/ClassStrategy';
export { ImportStrategy } from './implementations/ImportStrategy';
// 导出额外的策略实现
export { ASTSegmentationStrategy } from './implementations/ASTSegmentationStrategy';
export { BracketSegmentationStrategy } from './implementations/BracketSegmentationStrategy';
export { LayeredHTMLStrategy } from './implementations/LayeredHTMLStrategy';
export { LineSegmentationStrategy } from './implementations/LineSegmentationStrategy';
export { MarkdownSegmentationStrategy } from './implementations/MarkdownSegmentationStrategy';
export { SemanticSegmentationStrategy } from './implementations/SemanticSegmentationStrategy';
export { StandardizationSegmentationStrategy } from './implementations/StandardizationSegmentationStrategy';
export { XMLSegmentationStrategy } from './implementations/XMLSegmentationStrategy';

// 策略类型导出
export type { IProcessingStrategy } from '../core/interfaces/IProcessingStrategy';
export type { StrategyConfig, StrategyPerformanceStats } from '../types/Strategy';

/**
 * 策略工厂函数
 * 根据策略名称创建策略实例
 */
export function createStrategy(strategyName: string, config?: any): any {
  switch (strategyName) {
    case 'line':
    case 'line-strategy':
      return new (require('./implementations/LineStrategy').LineStrategy)(config);

    case 'semantic':
    case 'semantic-strategy':
      return new (require('./implementations/SemanticStrategy').SemanticStrategy)(config);

    case 'ast':
    case 'ast-strategy':
      return new (require('./implementations/ASTStrategy').ASTStrategy)(config);

    case 'bracket':
    case 'bracket-strategy':
      return new (require('./implementations/BracketStrategy').BracketStrategy)(config);

    case 'function':
    case 'function-strategy':
      return new (require('./implementations/FunctionStrategy').FunctionStrategy)(config);

    case 'class':
    case 'class-strategy':
      return new (require('./implementations/ClassStrategy').ClassStrategy)(config);

    case 'import':
    case 'import-strategy':
      return new (require('./implementations/ImportStrategy').ImportStrategy)(config);
    // 新增的策略
    case 'ast-segmentation':
      return new (require('./implementations/ASTSegmentationStrategy').ASTSegmentationStrategy)(config);

    case 'bracket-segmentation':
      return new (require('./implementations/BracketSegmentationStrategy').BracketSegmentationStrategy)(config);

    case 'layered-html':
      return new (require('./implementations/LayeredHTMLStrategy').LayeredHTMLStrategy)(config);

    case 'line-segmentation':
      return new (require('./implementations/LineSegmentationStrategy').LineSegmentationStrategy)(config);

    case 'markdown-segmentation':
      return new (require('./implementations/MarkdownSegmentationStrategy').MarkdownSegmentationStrategy)(config);

    case 'semantic-segmentation':
      return new (require('./implementations/SemanticSegmentationStrategy').SemanticSegmentationStrategy)(config);

    case 'standardization-segmentation':
      return new (require('./implementations/StandardizationSegmentationStrategy').StandardizationSegmentationStrategy)(config);

    case 'xml-segmentation':
      return new (require('./implementations/XMLSegmentationStrategy').XMLSegmentationStrategy)(config);

    default:
      throw new Error(`Unknown strategy: ${strategyName}`);
  }
}

/**
 * 获取所有可用策略名称
 */
export function getAvailableStrategies(): string[] {
  return [
    'line-strategy',
    'semantic-strategy',
    'ast-strategy',
    'bracket-strategy',
    'function-strategy',
    'class-strategy',
    'import-strategy'
  ];
}

/**
 * 策略配置预设
 */
export const StrategyPresets = {
  /**
   * 小文件策略配置
   */
  smallFile: {
    'line-strategy': {
      maxLinesPerChunk: 20,
      minLinesPerChunk: 3,
      overlapLines: 2
    },
    'semantic-strategy': {
      maxChunkSize: 500,
      minChunkSize: 50,
      semanticThreshold: 0.6
    },
    'ast-strategy': {
      maxFunctionSize: 1000,
      maxClassSize: 1500,
      minFunctionLines: 3,
      minClassLines: 2
    },
    'bracket-strategy': {
      maxChunkSize: 800,
      minChunkSize: 50,
      maxImbalance: 1
    },
    'function-strategy': {
      maxFunctionSize: 1000,
      maxClassSize: 1500,
      minFunctionLines: 3,
      minClassLines: 2
    },
    'class-strategy': {
      maxClassSize: 1500,
      minClassLines: 2,
      keepMethodsTogether: true
    },
    'import-strategy': {
      maxImportGroupSize: 200,
      groupImports: true
    }
  },

  /**
   * 中等文件策略配置
   */
  mediumFile: {
    'line-strategy': {
      maxLinesPerChunk: 50,
      minLinesPerChunk: 5,
      overlapLines: 5
    },
    'semantic-strategy': {
      maxChunkSize: 1000,
      minChunkSize: 100,
      semanticThreshold: 0.7
    },
    'ast-strategy': {
      maxFunctionSize: 2000,
      maxClassSize: 3000,
      minFunctionLines: 5,
      minClassLines: 3
    },
    'bracket-strategy': {
      maxChunkSize: 1500,
      minChunkSize: 100,
      maxImbalance: 2
    },
    'function-strategy': {
      maxFunctionSize: 2000,
      maxClassSize: 3000,
      minFunctionLines: 5,
      minClassLines: 3
    },
    'class-strategy': {
      maxClassSize: 3000,
      minClassLines: 3,
      keepMethodsTogether: true
    },
    'import-strategy': {
      maxImportGroupSize: 500,
      groupImports: true
    }
  },

  /**
   * 大文件策略配置
   */
  largeFile: {
    'line-strategy': {
      maxLinesPerChunk: 100,
      minLinesPerChunk: 10,
      overlapLines: 10
    },
    'semantic-strategy': {
      maxChunkSize: 2000,
      minChunkSize: 200,
      semanticThreshold: 0.8
    },
    'ast-strategy': {
      maxFunctionSize: 3000,
      maxClassSize: 5000,
      minFunctionLines: 10,
      minClassLines: 5
    },
    'bracket-strategy': {
      maxChunkSize: 3000,
      minChunkSize: 200,
      maxImbalance: 3
    },
    'function-strategy': {
      maxFunctionSize: 3000,
      maxClassSize: 5000,
      minFunctionLines: 10,
      minClassLines: 5
    },
    'class-strategy': {
      maxClassSize: 5000,
      minClassLines: 5,
      keepMethodsTogether: true
    },
    'import-strategy': {
      maxImportGroupSize: 1000,
      groupImports: true
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

/**
 * 策略优先级映射
 */
export const StrategyPriorities = {
  'line-strategy': 100,
  'semantic-strategy': 80,
  'bracket-strategy': 70,
  'ast-strategy': 60,
  'function-strategy': 50,
  'class-strategy': 45,
  'import-strategy': 30,
  'ast-segmentation': 85,
  'bracket-segmentation': 75,
  'semantic-segmentation': 82,
  'standardization-segmentation': 78,
  'xml-segmentation': 65,
  'layered-html': 70,
  'line-segmentation': 90,
  'markdown-segmentation': 75
};

/**
 * 根据语言获取推荐的策略
 */
export function getRecommendedStrategies(language: string): string[] {
  const languageStrategies: Record<string, string[]> = {
    'typescript': ['ast-strategy', 'function-strategy', 'class-strategy', 'semantic-strategy', 'bracket-strategy', 'import-strategy', 'line-strategy'],
    'javascript': ['ast-strategy', 'function-strategy', 'class-strategy', 'semantic-strategy', 'bracket-strategy', 'import-strategy', 'line-strategy'],
    'python': ['function-strategy', 'class-strategy', 'semantic-strategy', 'ast-strategy', 'import-strategy', 'line-strategy'],
    'java': ['ast-strategy', 'function-strategy', 'class-strategy', 'bracket-strategy', 'import-strategy', 'semantic-strategy', 'line-strategy'],
    'c': ['bracket-strategy', 'function-strategy', 'semantic-strategy', 'import-strategy', 'line-strategy'],
    'cpp': ['bracket-strategy', 'function-strategy', 'class-strategy', 'ast-strategy', 'import-strategy', 'semantic-strategy', 'line-strategy'],
    'csharp': ['ast-strategy', 'function-strategy', 'class-strategy', 'bracket-strategy', 'import-strategy', 'semantic-strategy', 'line-strategy'],
    'go': ['function-strategy', 'class-strategy', 'semantic-strategy', 'ast-strategy', 'import-strategy', 'line-strategy'],
    'rust': ['bracket-strategy', 'function-strategy', 'class-strategy', 'semantic-strategy', 'ast-strategy', 'import-strategy', 'line-strategy'],
    'php': ['function-strategy', 'class-strategy', 'semantic-strategy', 'ast-strategy', 'import-strategy', 'line-strategy'],
    'ruby': ['function-strategy', 'class-strategy', 'semantic-strategy', 'import-strategy', 'line-strategy'],
    'swift': ['ast-strategy', 'function-strategy', 'class-strategy', 'bracket-strategy', 'import-strategy', 'semantic-strategy', 'line-strategy'],
    'kotlin': ['ast-strategy', 'function-strategy', 'class-strategy', 'semantic-strategy', 'bracket-strategy', 'import-strategy', 'line-strategy'],
    'scala': ['ast-strategy', 'function-strategy', 'class-strategy', 'bracket-strategy', 'semantic-strategy', 'import-strategy', 'line-strategy']
  };

  return languageStrategies[language.toLowerCase()] || ['semantic-strategy', 'line-strategy'];
}