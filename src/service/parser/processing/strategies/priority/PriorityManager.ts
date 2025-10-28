import { injectable, inject } from 'inversify';
import { LoggerService } from '../../../../../utils/LoggerService';
import { TYPES } from '../../../../../types';
import * as fs from 'fs';
import * as path from 'path';
import {
  DEFAULT_PRIORITIES,
  LANGUAGE_SPECIFIC_PRIORITIES,
  FILE_TYPE_PRIORITIES,
  FALLBACK_PATHS,
  ADAPTIVE_WEIGHTS
} from '../../constants/priority-constants';

export interface StrategyPriorityConfig {
  defaultPriorities: Record<string, number>;
  languageSpecificPriorities: Record<string, Record<string, number>>;
  fileTypePriorities: Record<string, Record<string, number>>;
  fallbackPaths: Record<string, string[]>;
  adaptiveWeights: {
    performanceWeight: number;
    successRateWeight: number;
    complexityWeight: number;
  };
}

export interface PerformanceStats {
  executionCount: number;
  totalTime: number;
  successCount: number;
  averageTime: number;
  successRate: number;
}

export interface StrategyContext {
  filePath?: string;
  language?: string;
  content?: string;
  fileSize?: number;
  hasAST?: boolean;
}

@injectable()
export class PriorityManager {
  private config: StrategyPriorityConfig;
  private performanceStats: Map<string, PerformanceStats> = new Map();
  private logger?: LoggerService;
  private configPath: string;

  constructor(
    @inject(TYPES.LoggerService) logger?: LoggerService
  ) {
    this.logger = logger;
    this.configPath = this.getConfigPath();
    this.config = this.loadConfig();
  }

  /**
   * 获取策略优先级
   */
  getPriority(strategyName: string, context: StrategyContext): number {
    // 1. 检查文件类型特定优先级
    const fileTypePriority = this.getFileTypePriority(strategyName, context.filePath);
    if (fileTypePriority !== null) {
      return fileTypePriority;
    }

    // 2. 检查语言特定优先级
    const languagePriority = this.getLanguagePriority(strategyName, context.language);
    if (languagePriority !== null) {
      return languagePriority;
    }

    // 3. 使用默认优先级
    return this.config.defaultPriorities[strategyName] || 999;
  }

  /**
   * 获取降级路径
   */
  getFallbackPath(failedStrategy: string, failureReason: string): string[] {
    const basePath = this.config.fallbackPaths[failedStrategy] || 
                    ['universal_bracket', 'universal_line', 'minimal_fallback'];

    // 根据失败原因调整降级路径
    if (failureReason.includes('AST') || failureReason.includes('TreeSitter')) {
      return basePath.filter(strategy => 
        !strategy.includes('ast') && !strategy.includes('Structure') && 
        !strategy.includes('Syntax') && !strategy.includes('hierarchical')
      );
    }

    return basePath;
  }

  /**
   * 更新性能统计
   */
  updatePerformance(strategyName: string, executionTime: number, success: boolean): void {
    const stats = this.performanceStats.get(strategyName) || {
      executionCount: 0,
      totalTime: 0,
      successCount: 0,
      averageTime: 0,
      successRate: 0
    };

    stats.executionCount++;
    stats.totalTime += executionTime;
    stats.averageTime = stats.totalTime / stats.executionCount;
    
    if (success) {
      stats.successCount++;
    }
    stats.successRate = stats.successCount / stats.executionCount;

    this.performanceStats.set(strategyName, stats);
  }

  /**
   * 基于性能数据动态调整优先级
   */
  adjustPriority(strategyName: string): number {
    const stats = this.performanceStats.get(strategyName);
    if (!stats || stats.executionCount < 10) {
      return this.config.defaultPriorities[strategyName] || 999;
    }

    const basePriority = this.config.defaultPriorities[strategyName] || 999;
    const performanceScore = this.calculatePerformanceScore(stats);
    
    // 根据性能得分调整优先级（性能越好，优先级越高）
    return Math.max(0, basePriority - Math.floor(performanceScore * 5));
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats(): Map<string, PerformanceStats> {
    return new Map(this.performanceStats);
  }

  /**
   * 清空性能统计
   */
  clearPerformanceStats(): void {
    this.performanceStats.clear();
    this.logger?.debug('Performance stats cleared');
  }

  /**
   * 重新加载配置
   */
  reloadConfig(): void {
    this.config = this.loadConfig();
    this.logger?.debug('Priority configuration reloaded');
  }

  /**
   * 获取当前配置
   */
  getConfig(): StrategyPriorityConfig {
    return { ...this.config };
  }

  private calculatePerformanceScore(stats: PerformanceStats): number {
    const { performanceWeight, successRateWeight, complexityWeight } = this.config.adaptiveWeights;
    
    const timeScore = 1 - Math.min(stats.averageTime / 1000, 1); // 时间越短得分越高
    const successScore = stats.successRate;
    
    return (timeScore * performanceWeight + successScore * successRateWeight) / 
           (performanceWeight + successRateWeight);
  }

  private getFileTypePriority(strategyName: string, filePath?: string): number | null {
    if (!filePath) return null;

    const extension = filePath.split('.').pop()?.toLowerCase();
    if (!extension) return null;

    const fileTypeConfig = this.config.fileTypePriorities[`.${extension}`];
    return fileTypeConfig?.[strategyName] ?? null;
  }

  private getLanguagePriority(strategyName: string, language?: string): number | null {
    if (!language) return null;
    
    const languageConfig = this.config.languageSpecificPriorities[language.toLowerCase()];
    return languageConfig?.[strategyName] ?? null;
  }

  private getConfigPath(): string {
    // 优先使用环境变量指定的配置文件
    const envConfigPath = process.env.STRATEGY_PRIORITY_CONFIG_PATH;
    if (envConfigPath && fs.existsSync(envConfigPath)) {
      return envConfigPath;
    }

    // 根据环境选择配置文件
    const env = process.env.NODE_ENV || 'development';
    const configDir = path.join(process.cwd(), 'config');
    
    const configFiles = [
      `strategy-priorities.${env}.json`,
      'strategy-priorities.json'
    ];

    for (const configFile of configFiles) {
      const fullPath = path.join(configDir, configFile);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    // 如果没有找到配置文件，使用默认路径
    return path.join(configDir, 'strategy-priorities.json');
  }

  private loadConfig(): StrategyPriorityConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const configData = fs.readFileSync(this.configPath, 'utf-8');
        const config = JSON.parse(configData);
        this.logger?.info(`Loaded priority configuration from ${this.configPath}`);
        return config;
      }
    } catch (error) {
      this.logger?.error(`Failed to load configuration from ${this.configPath}:`, error);
    }

    this.logger?.warn('Using default priority configuration');
    return this.getDefaultConfig();
  }

  private getDefaultConfig(): StrategyPriorityConfig {
    return {
      defaultPriorities: DEFAULT_PRIORITIES,
      languageSpecificPriorities: LANGUAGE_SPECIFIC_PRIORITIES,
      fileTypePriorities: FILE_TYPE_PRIORITIES,
      fallbackPaths: FALLBACK_PATHS,
      adaptiveWeights: ADAPTIVE_WEIGHTS
    };
  }
}