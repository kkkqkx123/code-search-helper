// 统一处理层类型定义
// 整合了所有相关类型定义

// 重新导出核心接口
export {
  ISplitStrategy,
  IStrategyProvider,
  ChunkingOptions,
  CodeChunk,
  CodeChunkMetadata,
  ASTNode,
  StrategyConfiguration,
  StrategyManagerConfig,
  StrategyExecutionContext,
  StrategyExecutionResult
} from '../../interfaces/ISplitStrategy';

export {
  IStrategyProvider as IStrategyProviderInterface
} from '../../interfaces/IStrategyProvider';

// 重新导出配置类型
export {
  UnifiedConfig,
  UniversalProcessingConfig
} from '../../config/UnifiedConfigManager';

// 重新导出检测类型
export {
  DetectionResult,
  FileFeatures,
  LanguageDetectionInfo
} from '../detection/UnifiedDetectionService';

// 重新导出处理类型
export {
  ProcessingResult,
  ProcessingContext
} from '../coordination/UnifiedProcessingCoordinator';

// 扩展类型定义
export interface ProcessingStats {
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  averageProcessingTime: number;
  totalProcessingTime: number;
  languageStats: Map<string, {
    count: number;
    totalTime: number;
    errors: number;
    averageTime: number;
    errorRate: number;
  }>;
  strategyStats: Map<string, {
    count: number;
    totalTime: number;
    errors: number;
    averageTime: number;
    errorRate: number;
  }>;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  details: {
    strategyManager: boolean;
    detectionService: boolean;
    configManager: boolean;
    totalStrategies: number;
    supportedLanguages: number;
    memoryUsage?: NodeJS.MemoryUsage;
    cacheStats?: {
      size: number;
      hitRate: number;
      missRate: number;
    };
  };
  recommendations?: string[];
}

export interface ProcessingOptions extends ChunkingOptions {
  // 处理选项
  enableFallback?: boolean;
  maxRetries?: number;
  forceStrategy?: string;
  enableParallel?: boolean;
  
  // 监控选项
  enableMetrics?: boolean;
  enableLogging?: boolean;
  enableProfiling?: boolean;
  
  // 缓存选项
  enableCache?: boolean;
  cacheTTL?: number;
  cacheSize?: number;
  
  // 性能选项
  timeout?: number;
  maxConcurrency?: number;
  memoryLimit?: number;
}

export interface BatchProcessingOptions {
  // 批处理选项
  maxConcurrency?: number;
  failFast?: boolean;
  continueOnError?: boolean;
  
  // 进度报告
  enableProgress?: boolean;
  progressCallback?: (completed: number, total: number, current: string) => void;
  
  // 结果聚合
  aggregateResults?: boolean;
  resultFilter?: (result: ProcessingResult) => boolean;
}

export interface StrategyProviderInfo {
  name: string;
  description: string;
  version: string;
  author: string;
  supportedLanguages: string[];
  priority: number;
  capabilities: {
    supportsAST: boolean;
    supportsStreaming: boolean;
    supportsParallel: boolean;
    supportsCaching: boolean;
  };
  dependencies: string[];
  configuration: StrategyConfiguration;
}

export interface LanguageInfo {
  name: string;
  extensions: string[];
  mimeTypes: string[];
  confidence: number;
  features: {
    isStructured: boolean;
    hasImports: boolean;
    hasExports: boolean;
    hasFunctions: boolean;
    hasClasses: boolean;
    isCaseSensitive: boolean;
  };
  processingHints: {
    preferredStrategy: string;
    fallbackStrategies: string[];
    complexityThreshold: number;
    sizeThreshold: number;
  };
}

export interface ProcessingMetrics {
  // 时间指标
  processingTime: number;
  detectionTime: number;
  strategySelectionTime: number;
  executionTime: number;
  
  // 内存指标
  memoryUsage: NodeJS.MemoryUsage;
  peakMemoryUsage: number;
  
  // 质量指标
  chunkCount: number;
  averageChunkSize: number;
  totalChunkSize: number;
  compressionRatio: number;
  
  // 错误指标
  errorCount: number;
  warningCount: number;
  retryCount: number;
  fallbackCount: number;
}

export interface ProcessingEvent {
  type: 'start' | 'progress' | 'complete' | 'error' | 'warning';
  timestamp: Date;
  source: string;
  data: any;
  metadata?: any;
}

export interface ProcessingEventListener {
  onEvent(event: ProcessingEvent): void;
}

export interface ProcessingCache {
  get(key: string): Promise<ProcessingResult | null>;
  set(key: string, value: ProcessingResult, ttl?: number): Promise<void>;
  delete(key: string): Promise<boolean>;
  clear(): Promise<void>;
  stats(): Promise<{
    size: number;
    hitRate: number;
    missRate: number;
    evictions: number;
  }>;
}

export interface ProcessingLogger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  setLevel(level: 'debug' | 'info' | 'warn' | 'error'): void;
}

export interface ProcessingProfiler {
  startProfile(name: string): void;
  endProfile(name: string): number;
  getProfile(name: string): { duration: number; count: number; average: number };
  getAllProfiles(): Map<string, { duration: number; count: number; average: number }>;
  clearProfiles(): void;
}

// 错误类型
export class ProcessingError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ProcessingError';
  }
}

export class StrategyError extends ProcessingError {
  constructor(
    message: string,
    public strategyName: string,
    details?: any,
    cause?: Error
  ) {
    super(message, 'STRATEGY_ERROR', details, cause);
    this.name = 'StrategyError';
  }
}

export class DetectionError extends ProcessingError {
  constructor(
    message: string,
    public filePath: string,
    details?: any,
    cause?: Error
  ) {
    super(message, 'DETECTION_ERROR', details, cause);
    this.name = 'DetectionError';
  }
}

export class ConfigurationError extends ProcessingError {
  constructor(
    message: string,
    public configPath?: string,
    details?: any,
    cause?: Error
  ) {
    super(message, 'CONFIGURATION_ERROR', details, cause);
    this.name = 'ConfigurationError';
  }
}

// 常量定义
export const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  enableFallback: true,
  maxRetries: 3,
  enableParallel: false,
  enableMetrics: true,
  enableLogging: true,
  enableProfiling: false,
  enableCache: true,
  cacheTTL: 300000, // 5分钟
  cacheSize: 1000,
  timeout: 30000, // 30秒
  maxConcurrency: 4,
  memoryLimit: 512 * 1024 * 1024 // 512MB
};

export const DEFAULT_BATCH_PROCESSING_OPTIONS: BatchProcessingOptions = {
  maxConcurrency: 4,
  failFast: false,
  continueOnError: true,
  enableProgress: true,
  aggregateResults: true
};

export const SUPPORTED_LANGUAGES = [
  'typescript', 'javascript', 'python', 'java', 'c', 'cpp',
  'csharp', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin',
  'scala', 'html', 'css', 'json', 'yaml', 'toml', 'xml',
  'markdown', 'text'
] as const;

export const PROCESSING_STRATEGIES = [
  'treesitter_ast',
  'syntax_aware',
  'semantic',
  'function',
  'class',
  'module',
  'line_based',
  'minimal_fallback'
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];
export type ProcessingStrategy = typeof PROCESSING_STRATEGIES[number];