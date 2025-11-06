/**
 * 关系提取器管理器
 * 管理多个关系提取器的注册、调度和执行
 */

import Parser from 'tree-sitter';
import { RelationshipResult, RelationshipType, RelationshipCategory } from '../types/RelationshipTypes';
import { SymbolTable } from '../types';
import { BaseRelationshipExtractor, RelationshipExtractionContext, globalExtractorRegistry } from './BaseRelationshipExtractor';

/**
 * 提取器注册信息接口
 */
export interface ExtractorRegistration {
  /** 提取器实例 */
  extractor: BaseRelationshipExtractor;
  /** 优先级 */
  priority: number;
  /** 支持的语言 */
  supportedLanguages: string[];
  /** 支持的关系类型 */
  supportedRelationshipTypes: RelationshipType[];
  /** 是否启用 */
  enabled: boolean;
  /** 注册时间 */
  registeredAt: Date;
}

/**
 * 提取器执行结果接口
 */
export interface ExtractorExecutionResult {
  /** 提取器名称 */
  extractorName: string;
  /** 提取的关系 */
  relationships: RelationshipResult[];
  /** 执行时间（毫秒） */
  executionTime: number;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: Error;
  /** 元数据 */
  metadata?: any;
}

/**
 * 关系提取器管理器配置接口
 */
export interface RelationshipExtractorManagerConfig {
  /** 是否启用并行执行 */
  enableParallelExecution?: boolean;
  /** 最大并行数 */
  maxParallelExecutions?: number;
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 缓存大小 */
  cacheSize?: number;
  /** 是否启用调试模式 */
  debug?: boolean;
  /** 默认优先级 */
  defaultPriority?: number;
}

/**
 * 关系提取器管理器
 */
export class RelationshipExtractorManager {
  private extractors: Map<string, ExtractorRegistration> = new Map();
  private config: RelationshipExtractorManagerConfig;
  private cache: Map<string, RelationshipResult[]> = new Map();
  private debugMode: boolean;

  constructor(config: RelationshipExtractorManagerConfig = {}) {
    this.config = {
      enableParallelExecution: config.enableParallelExecution ?? false,
      maxParallelExecutions: config.maxParallelExecutions ?? 4,
      enableCache: config.enableCache ?? true,
      cacheSize: config.cacheSize ?? 1000,
      debug: config.debug ?? false,
      defaultPriority: config.defaultPriority ?? 100
    };
    this.debugMode = this.config.debug!;
  }

  /**
   * 注册关系提取器
   */
  registerExtractor(
    name: string,
    extractor: BaseRelationshipExtractor,
    options: {
      priority?: number;
      supportedLanguages?: string[];
      enabled?: boolean;
    } = {}
  ): void {
    const registration: ExtractorRegistration = {
      extractor,
      priority: options.priority ?? this.config.defaultPriority!,
      supportedLanguages: options.supportedLanguages ?? ['*'],
      supportedRelationshipTypes: extractor.getSupportedRelationshipTypes(),
      enabled: options.enabled ?? true,
      registeredAt: new Date()
    };

    this.extractors.set(name, registration);
    this.logDebug(`Extractor registered: ${name}`, registration);
  }

  /**
   * 注销关系提取器
   */
  unregisterExtractor(name: string): boolean {
    const removed = this.extractors.delete(name);
    if (removed) {
      this.logDebug(`Extractor unregistered: ${name}`);
    }
    return removed;
  }

  /**
   * 获取提取器
   */
  getExtractor(name: string): BaseRelationshipExtractor | undefined {
    const registration = this.extractors.get(name);
    return registration?.extractor;
  }

  /**
   * 获取所有提取器
   */
  getAllExtractors(): Map<string, ExtractorRegistration> {
    return new Map(this.extractors);
  }

  /**
   * 按关系类型获取提取器
   */
  getExtractorsByRelationshipType(relationshipType: RelationshipType): ExtractorRegistration[] {
    const results: ExtractorRegistration[] = [];
    
    for (const registration of this.extractors.values()) {
      if (registration.enabled && 
          registration.supportedRelationshipTypes.includes(relationshipType)) {
        results.push(registration);
      }
    }
    
    // 按优先级排序
    return results.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 按语言获取提取器
   */
  getExtractorsByLanguage(language: string): ExtractorRegistration[] {
    const results: ExtractorRegistration[] = [];
    
    for (const registration of this.extractors.values()) {
      if (registration.enabled && 
          (registration.supportedLanguages.includes('*') || 
           registration.supportedLanguages.includes(language))) {
        results.push(registration);
      }
    }
    
    // 按优先级排序
    return results.sort((a, b) => a.priority - b.priority);
  }

  /**
   * 启用提取器
   */
  enableExtractor(name: string): boolean {
    const registration = this.extractors.get(name);
    if (registration) {
      registration.enabled = true;
      this.logDebug(`Extractor enabled: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * 禁用提取器
   */
  disableExtractor(name: string): boolean {
    const registration = this.extractors.get(name);
    if (registration) {
      registration.enabled = false;
      this.logDebug(`Extractor disabled: ${name}`);
      return true;
    }
    return false;
  }

  /**
   * 提取所有关系
   */
  async extractAllRelationships(
    context: RelationshipExtractionContext
  ): Promise<RelationshipResult[]> {
    const extractors = this.getExtractorsByLanguage(context.language);
    
    if (extractors.length === 0) {
      this.logWarning(`No extractors found for language: ${context.language}`);
      return [];
    }

    // 生成缓存键
    const cacheKey = this.generateCacheKey(context);
    
    // 检查缓存
    if (this.config.enableCache && this.cache.has(cacheKey)) {
      this.logDebug('Cache hit for relationship extraction', { cacheKey });
      return this.cache.get(cacheKey)!;
    }

    // 执行提取
    const results = this.config.enableParallelExecution
      ? await this.executeExtractorsParallel(extractors, context)
      : await this.executeExtractorsSequential(extractors, context);

    // 存储到缓存
    if (this.config.enableCache) {
      this.manageCacheSize();
      this.cache.set(cacheKey, results);
      this.logDebug('Cached relationship extraction results', { 
        cacheKey, 
        count: results.length 
      });
    }

    return results;
  }

  /**
   * 按关系类型提取关系
   */
  async extractRelationshipsByType(
    relationshipType: RelationshipType,
    context: RelationshipExtractionContext
  ): Promise<RelationshipResult[]> {
    const extractors = this.getExtractorsByRelationshipType(relationshipType);
    
    if (extractors.length === 0) {
      this.logWarning(`No extractors found for relationship type: ${relationshipType}`);
      return [];
    }

    const results = this.config.enableParallelExecution
      ? await this.executeExtractorsParallel(extractors, context)
      : await this.executeExtractorsSequential(extractors, context);

    // 过滤结果
    return results.filter(relationship => relationship.type === relationshipType);
  }

  /**
   * 顺序执行提取器
   */
  private async executeExtractorsSequential(
    extractors: ExtractorRegistration[],
    context: RelationshipExtractionContext
  ): Promise<RelationshipResult[]> {
    const allResults: RelationshipResult[] = [];
    const executionResults: ExtractorExecutionResult[] = [];

    for (const registration of extractors) {
      const startTime = Date.now();
      
      try {
        this.logDebug(`Executing extractor: ${registration.extractor.getName()}`);
        
        const relationships = await registration.extractor.extractRelationshipsWithCache(context);
        const executionTime = Date.now() - startTime;
        
        allResults.push(...relationships);
        
        const result: ExtractorExecutionResult = {
          extractorName: registration.extractor.getName(),
          relationships,
          executionTime,
          success: true
        };
        
        executionResults.push(result);
        this.logDebug(`Extractor completed: ${registration.extractor.getName()}`, {
          count: relationships.length,
          executionTime
        });
        
      } catch (error) {
        const executionTime = Date.now() - startTime;
        
        const result: ExtractorExecutionResult = {
          extractorName: registration.extractor.getName(),
          relationships: [],
          executionTime,
          success: false,
          error: error as Error
        };
        
        executionResults.push(result);
        this.logError(`Extractor failed: ${registration.extractor.getName()}`, error as Error);
      }
    }

    // 去重
    const deduplicatedResults = this.deduplicateRelationships(allResults);
    
    this.logDebug('Sequential execution completed', {
      totalExtractors: extractors.length,
      successfulExtractors: executionResults.filter(r => r.success).length,
      totalRelationships: allResults.length,
      deduplicatedRelationships: deduplicatedResults.length
    });

    return deduplicatedResults;
  }

  /**
   * 并行执行提取器
   */
  private async executeExtractorsParallel(
    extractors: ExtractorRegistration[],
    context: RelationshipExtractionContext
  ): Promise<RelationshipResult[]> {
    const maxParallel = this.config.maxParallelExecutions!;
    const chunks = this.chunkArray(extractors, maxParallel);
    const allResults: RelationshipResult[] = [];

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (registration) => {
        const startTime = Date.now();
        
        try {
          this.logDebug(`Executing extractor in parallel: ${registration.extractor.getName()}`);
          
          const relationships = await registration.extractor.extractRelationshipsWithCache(context);
          const executionTime = Date.now() - startTime;
          
          this.logDebug(`Parallel extractor completed: ${registration.extractor.getName()}`, {
            count: relationships.length,
            executionTime
          });
          
          return {
            extractorName: registration.extractor.getName(),
            relationships,
            executionTime,
            success: true
          } as ExtractorExecutionResult;
          
        } catch (error) {
          const executionTime = Date.now() - startTime;
          
          this.logError(`Parallel extractor failed: ${registration.extractor.getName()}`, error as Error);
          
          return {
            extractorName: registration.extractor.getName(),
            relationships: [],
            executionTime,
            success: false,
            error: error as Error
          } as ExtractorExecutionResult;
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      
      // 收集成功的结果
      for (const result of chunkResults) {
        if (result.success) {
          allResults.push(...result.relationships);
        }
      }
    }

    // 去重
    const deduplicatedResults = this.deduplicateRelationships(allResults);
    
    this.logDebug('Parallel execution completed', {
      totalExtractors: extractors.length,
      totalRelationships: allResults.length,
      deduplicatedRelationships: deduplicatedResults.length
    });

    return deduplicatedResults;
  }

  /**
   * 去重关系
   */
  private deduplicateRelationships(relationships: RelationshipResult[]): RelationshipResult[] {
    const seen = new Set<string>();
    const deduplicated: RelationshipResult[] = [];

    for (const relationship of relationships) {
      const key = this.generateRelationshipKey(relationship);
      
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(relationship);
      }
    }

    return deduplicated;
  }

  /**
   * 生成关系键
   */
  private generateRelationshipKey(relationship: RelationshipResult): string {
    return `${relationship.source}:${relationship.target}:${relationship.type}`;
  }

  /**
   * 数组分块
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(context: RelationshipExtractionContext): string {
    const { filePath, language, astNode } = context;
    const nodeHash = `${astNode.type}:${astNode.startPosition.row}:${astNode.startPosition.column}`;
    return `${language}:${filePath}:${nodeHash}`;
  }

  /**
   * 管理缓存大小
   */
  private manageCacheSize(): void {
    if (this.cache.size >= this.config.cacheSize!) {
      // 简单的LRU：删除第一个元素
      const firstKey = this.cache.keys().next().value!;
      this.cache.delete(firstKey);
    }
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    this.logDebug('Relationship extractor cache cleared');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): { size: number; maxSize: number } {
    return {
      size: this.cache.size,
      maxSize: this.config.cacheSize!
    };
  }

  /**
   * 获取管理器统计
   */
  getStats(): {
    totalExtractors: number;
    enabledExtractors: number;
    supportedLanguages: string[];
    supportedRelationshipTypes: RelationshipType[];
    cacheStats: { size: number; maxSize: number };
  } {
    const enabledExtractors = Array.from(this.extractors.values()).filter(r => r.enabled);
    const supportedLanguages = new Set<string>();
    const supportedRelationshipTypes = new Set<RelationshipType>();

    for (const registration of this.extractors.values()) {
      registration.supportedLanguages.forEach(lang => supportedLanguages.add(lang));
      registration.supportedRelationshipTypes.forEach(type => supportedRelationshipTypes.add(type));
    }

    return {
      totalExtractors: this.extractors.size,
      enabledExtractors: enabledExtractors.length,
      supportedLanguages: Array.from(supportedLanguages),
      supportedRelationshipTypes: Array.from(supportedRelationshipTypes),
      cacheStats: this.getCacheStats()
    };
  }

  /**
   * 健康检查所有提取器
   */
  async healthCheckAll(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [name, registration] of this.extractors) {
      try {
        results[name] = await registration.extractor.healthCheck();
      } catch (error) {
        this.logError(`Health check failed for extractor: ${name}`, error as Error);
        results[name] = false;
      }
    }

    return results;
  }

  /**
   * 销毁管理器
   */
  async destroy(): Promise<void> {
    // 销毁所有提取器
    for (const registration of this.extractors.values()) {
      try {
        await registration.extractor.destroy();
      } catch (error) {
        this.logError(`Failed to destroy extractor: ${registration.extractor.getName()}`, error as Error);
      }
    }

    // 清空数据
    this.extractors.clear();
    this.clearCache();
    
    this.logDebug('Relationship extractor manager destroyed');
  }

  /**
   * 记录调试信息
   */
  private logDebug(message: string, data?: any): void {
    if (this.debugMode) {
      console.log(`[RelationshipExtractorManager] ${message}`, data);
    }
  }

  /**
   * 记录错误信息
   */
  private logError(message: string, error?: Error): void {
    console.error(`[RelationshipExtractorManager] ${message}`, error);
  }

  /**
   * 记录警告信息
   */
  private logWarning(message: string, data?: any): void {
    console.warn(`[RelationshipExtractorManager] ${message}`, data);
  }
}