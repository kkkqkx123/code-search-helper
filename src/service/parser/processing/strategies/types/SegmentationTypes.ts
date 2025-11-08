/**
 * 分段处理相关类型定义
 */

/**
 * 分块选项接口
 */
export interface ChunkingOptions {
  /** 最大块大小 */
  maxChunkSize?: number;
  
  /** 最小块大小 */
  minChunkSize?: number;
  
  /** 重叠大小 */
  overlapSize?: number;
  
  /** 每块最大行数 */
  maxLinesPerChunk?: number;
  
  /** 每块最小行数 */
  minLinesPerChunk?: number;
  
  /** 是否启用智能分块 */
  enableIntelligentChunking?: boolean;
  
  /** 内存限制（MB） */
  memoryLimitMB?: number;
  
  /** 错误阈值 */
  errorThreshold?: number;
  
  /** 自定义参数 */
  customParams?: Record<string, any>;
}

/**
 * 增强分块选项接口
 */
export interface EnhancedChunkingOptions extends ChunkingOptions {
  /** 高级配置 */
  advanced?: {
    /** 语义权重 */
    semanticWeight?: number;
    
    /** 语法权重 */
    syntacticWeight?: number;
    
    /** 结构权重 */
    structuralWeight?: number;
    
    /** 是否启用去重 */
    enableChunkDeduplication?: boolean;
    
    /** 去重阈值 */
    deduplicationThreshold?: number;
  };
}

/**
 * 分块预设枚举
 */
export enum ChunkingPreset {
  /** 小块预设 */
  SMALL = 'small',
  
  /** 平衡预设 */
  BALANCED = 'balanced',
  
  /** 大块预设 */
  LARGE = 'large',
  
  /** 高重叠预设 */
  HIGH_OVERLAP = 'high_overlap'
}

/**
 * 分块预设工厂类
 */
export class ChunkingPresetFactory {
  /**
   * 创建预设配置
   * @param preset 预设类型
   * @returns 分块选项
   */
  static createPreset(preset: ChunkingPreset): ChunkingOptions {
    switch (preset) {
      case ChunkingPreset.SMALL:
        return {
          maxChunkSize: 500,
          minChunkSize: 50,
          overlapSize: 50,
          maxLinesPerChunk: 20,
          minLinesPerChunk: 1,
          enableIntelligentChunking: true
        };
      
      case ChunkingPreset.BALANCED:
        return {
          maxChunkSize: 1000,
          minChunkSize: 100,
          overlapSize: 100,
          maxLinesPerChunk: 50,
          minLinesPerChunk: 5,
          enableIntelligentChunking: true
        };
      
      case ChunkingPreset.LARGE:
        return {
          maxChunkSize: 2000,
          minChunkSize: 200,
          overlapSize: 200,
          maxLinesPerChunk: 100,
          minLinesPerChunk: 10,
          enableIntelligentChunking: true
        };
      
      case ChunkingPreset.HIGH_OVERLAP:
        return {
          maxChunkSize: 1000,
          minChunkSize: 100,
          overlapSize: 300,
          maxLinesPerChunk: 50,
          minLinesPerChunk: 5,
          enableIntelligentChunking: true
        };
      
      default:
        return this.createPreset(ChunkingPreset.BALANCED);
    }
  }
}

/**
 * 默认分块选项
 */
export const DEFAULT_CHUNKING_OPTIONS: Required<ChunkingOptions> = {
  maxChunkSize: 1000,
  minChunkSize: 100,
  overlapSize: 100,
  maxLinesPerChunk: 50,
  minLinesPerChunk: 5,
  enableIntelligentChunking: true,
  memoryLimitMB: 512,
  errorThreshold: 10,
  customParams: {}
};

/**
 * 默认增强分块选项
 */
export const DEFAULT_ENHANCED_CHUNKING_OPTIONS: Required<EnhancedChunkingOptions> = {
  ...DEFAULT_CHUNKING_OPTIONS,
  advanced: {
    semanticWeight: 0.4,
    syntacticWeight: 0.3,
    structuralWeight: 0.2,
    enableChunkDeduplication: true,
    deduplicationThreshold: 0.8
  }
};

/**
 * 通用分块选项接口
 */
export interface UniversalChunkingOptions extends EnhancedChunkingOptions {
  /** 策略类型 */
  strategy?: string;
  
  /** 语言特定配置 */
  languageConfig?: Record<string, ChunkingOptions>;
}

/**
 * 分段上下文接口
 */
export interface SegmentationContext {
  /** 内容 */
  content: string;
  
  /** 编程语言 */
  language: string;
  
  /** 文件路径 */
  filePath?: string;
  
  /** 分块选项 */
  options: ChunkingOptions;
  
  /** 自定义元数据 */
  metadata?: Record<string, any>;
}

/**
 * 分段处理器接口
 */
export interface ISegmentationProcessor {
  /**
   * 处理分段
   * @param context 分段上下文
   * @returns 处理后的代码块数组
   */
  process(context: SegmentationContext): Promise<any[]>;
  
  /**
   * 验证上下文
   * @param context 分段上下文
   * @returns 是否有效
   */
  validateContext(context: SegmentationContext): boolean;
}

/**
 * 性能统计接口
 */
export interface PerformanceStats {
  /** 总执行次数 */
  totalExecutions: number;
  
  /** 成功执行次数 */
  successfulExecutions: number;
  
  /** 平均执行时间 */
  averageExecutionTime: number;
  
  /** 最后执行时间 */
  lastExecutionTime: number;
  
  /** 错误次数 */
  errorCount: number;
  
  /** 自定义指标 */
  [key: string]: any;
}

/**
 * 文本分割器接口
 */
export interface ITextSplitter {
  /**
   * 分割文本
   * @param content 文本内容
   * @param language 编程语言
   * @param filePath 文件路径
   * @param options 分块选项
   * @returns 代码块数组
   */
  split(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions
  ): Promise<CodeChunk[]>;
}

/**
 * 分段上下文管理器接口
 */
export interface ISegmentationContextManager {
  /**
   * 创建分段上下文
   * @param content 内容
   * @param language 语言
   * @param filePath 文件路径
   * @param options 选项
   * @returns 分段上下文
   */
  createContext(
    content: string,
    language: string,
    filePath?: string,
    options?: ChunkingOptions
  ): SegmentationContext;
  
  /**
   * 验证分段上下文
   * @param context 分段上下文
   * @returns 是否有效
   */
  validateContext(context: SegmentationContext): boolean;
}

/**
 * 保护协调器接口
 */
export interface IProtectionCoordinator {
  /**
   * 检查是否应该保护
   * @param context 分段上下文
   * @returns 是否应该保护
   */
  shouldProtect(context: SegmentationContext): boolean;
  
  /**
   * 应用保护措施
   * @param chunks 代码块数组
   * @param context 分段上下文
   * @returns 保护后的代码块数组
   */
  applyProtection(chunks: CodeChunk[], context: SegmentationContext): CodeChunk[];
}

/**
 * 配置管理器接口
 */
export interface IConfigurationManager {
  /**
   * 获取配置
   * @returns 配置
   */
  getConfig(): any;
  
  /**
   * 合并选项
   * @param baseOptions 基础选项
   * @param overrideOptions 覆盖选项
   * @returns 合并后的选项
   */
  mergeOptions(baseOptions: any, overrideOptions: any): any;
}

// 导入相关类型，避免循环依赖
import type { CodeChunk } from '../../types/CodeChunk';