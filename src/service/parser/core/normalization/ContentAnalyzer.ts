import { TopLevelStructure, NestedStructure, InternalStructure } from '../../../../utils/types/ContentTypes';
import { StandardizedQueryResult } from './types';
import { QueryResultNormalizer } from './QueryResultNormalizer';
import { TreeSitterCoreService } from '../parse/TreeSitterCoreService';
import { ASTStructureExtractor } from './ASTStructureExtractor';
import { StructureTypeConverter } from './utils/StructureTypeConverter';
import { LoggerService } from '../../../../utils/LoggerService';
import { LRUCache } from '../../../../utils/cache/LRUCache';
import { PerformanceMonitor } from '../../../../infrastructure/monitoring/PerformanceMonitor';
import { InfrastructureConfigService } from '../../../../infrastructure/config/InfrastructureConfigService';
import Parser from 'tree-sitter';

/**
 * 提取选项接口
 */
export interface ExtractionOptions {
  /** 是否包含顶级结构 */
  includeTopLevel?: boolean;
  /** 是否包含嵌套结构 */
  includeNested?: boolean;
  /** 是否包含内部结构 */
  includeInternal?: boolean;
  /** 最大嵌套层级 */
  maxNestingLevel?: number;
  /** 是否启用缓存 */
  enableCache?: boolean;
  /** 是否启用性能监控 */
  enablePerformanceMonitoring?: boolean;
  /** 是否启用调试模式 */
  debug?: boolean;
}

/**
 * 提取结果接口
 */
export interface ExtractionResult {
  /** 顶级结构 */
  topLevelStructures: TopLevelStructure[];
  /** 嵌套结构 */
  nestedStructures: NestedStructure[];
  /** 内部结构 */
  internalStructures: InternalStructure[];
  /** 提取统计信息 */
  stats: {
    totalStructures: number;
    processingTime: number;
    cacheHit: boolean;
    language: string;
  };
}

/**
 * 带关系结构的接口
 */
export interface StructureWithRelationships {
  /** 顶级结构 */
  topLevelStructures: TopLevelStructure[];
  /** 嵌套结构 */
  nestedStructures: NestedStructure[];
  /** 内部结构 */
  internalStructures: InternalStructure[];
  /** 结构关系 */
  relationships: {
    nesting: Array<{
      parent: string;
      child: string;
      type: 'contains' | 'extends' | 'implements';
    }>;
    references: Array<{
      from: string;
      to: string;
      type: 'function_call' | 'variable_reference' | 'type_reference';
    }>;
    dependencies: Array<{
      from: string;
      to: string;
      type: 'import' | 'inheritance' | 'implementation';
    }>;
  };
  /** 提取统计信息 */
  stats: {
    totalStructures: number;
    totalRelationships: number;
    processingTime: number;
    cacheHit: boolean;
    language: string;
  };
}

/**
 * 统一内容分析器
 * 整合所有结构提取功能，提供一次性提取所有结构的接口
 * 利用normalization系统的全部功能
 */
export class UnifiedContentAnalyzer {
  private logger: LoggerService;
  private cache: LRUCache<string, ExtractionResult>;
  private performanceMonitor?: PerformanceMonitor;
  private typeConverter: StructureTypeConverter;

  constructor(
    private queryNormalizer: QueryResultNormalizer,
    private treeSitterService: TreeSitterCoreService,
    private astStructureExtractor: ASTStructureExtractor
  ) {
    this.logger = new LoggerService();
    
    // 初始化缓存
    this.cache = new LRUCache(50, { enableStats: true });
    
    // 初始化性能监控
    this.performanceMonitor = new PerformanceMonitor(this.logger, new InfrastructureConfigService(this.logger, {
      get: () => ({}),
      set: () => { },
      has: () => false,
      clear: () => { }
    } as any));
    
    // 初始化类型转换器
    this.typeConverter = new StructureTypeConverter();
  }

  /**
   * 提取所有结构
   * @param content 源代码内容
   * @param language 编程语言
   * @param options 提取选项
   * @returns 提取结果
   */
  async extractAllStructures(
    content: string, 
    language: string,
    options: ExtractionOptions = {}
  ): Promise<ExtractionResult> {
    const startTime = Date.now();
    const {
      includeTopLevel = true,
      includeNested = true,
      includeInternal = true,
      maxNestingLevel = 5,
      enableCache = true,
      enablePerformanceMonitoring = true,
      debug = false
    } = options;

    // 生成缓存键
    const cacheKey = this.generateCacheKey(content, language, options);
    
    // 检查缓存
    if (enableCache && this.cache.has(cacheKey)) {
      this.performanceMonitor?.updateCacheHitRate(true);
      const cachedResult = this.cache.get(cacheKey)!;
      this.logger.debug(`使用缓存结果 (${language})`);
      return {
        ...cachedResult,
        stats: {
          ...cachedResult.stats,
          cacheHit: true
        }
      };
    }

    try {
      // 解析AST
      const parseResult = await this.parseContent(content, language);
      if (!parseResult || !parseResult.ast) {
        throw new Error(`Failed to parse ${language} content`);
      }

      // 并行提取所有结构
      const extractionPromises: Promise<any>[] = [];
      
      if (includeTopLevel) {
        extractionPromises.push(
          this.astStructureExtractor.extractTopLevelStructuresFromAST(content, language, parseResult.ast)
        );
      }
      
      if (includeNested) {
        extractionPromises.push(
          this.extractNestedStructuresWithLevel(content, parseResult.ast, maxNestingLevel, language)
        );
      }
      
      if (includeInternal) {
        extractionPromises.push(
          this.astStructureExtractor.extractInternalStructuresFromAST(content, parseResult.ast, parseResult.ast)
        );
      }

      // 等待所有提取完成
      const results = await Promise.all(extractionPromises);
      
      // 组装结果
      const extractionResult: ExtractionResult = {
        topLevelStructures: includeTopLevel ? results[0] : [],
        nestedStructures: includeNested ? (includeTopLevel ? results[1] : results[0]) : [],
        internalStructures: includeInternal ? results[results.length - 1] : [],
        stats: {
          totalStructures: 0,
          processingTime: Date.now() - startTime,
          cacheHit: false,
          language
        }
      };

      // 计算总结构数
      extractionResult.stats.totalStructures = 
        extractionResult.topLevelStructures.length +
        extractionResult.nestedStructures.length +
        extractionResult.internalStructures.length;

      // 缓存结果
      if (enableCache) {
        this.cache.set(cacheKey, extractionResult);
      }

      // 更新性能监控
      if (enablePerformanceMonitoring) {
        this.performanceMonitor?.recordQueryExecution(Date.now() - startTime);
        this.performanceMonitor?.updateCacheHitRate(false);
      }

      this.logger.debug(`提取完成 (${language}): ${extractionResult.stats.totalStructures} 个结构, ${extractionResult.stats.processingTime}ms`);
      
      return extractionResult;
    } catch (error) {
      this.logger.error(`提取结构失败 (${language}):`, error);
      
      // 返回空结果
      return {
        topLevelStructures: [],
        nestedStructures: [],
        internalStructures: [],
        stats: {
          totalStructures: 0,
          processingTime: Date.now() - startTime,
          cacheHit: false,
          language
        }
      };
    }
  }

  /**
   * 提取带关系的结构
   * @param content 源代码内容
   * @param language 编程语言
   * @returns 带关系的结构
   */
  async extractWithRelationships(
    content: string, 
    language: string
  ): Promise<StructureWithRelationships> {
    const startTime = Date.now();
    
    try {
      // 首先提取所有结构
      const extractionResult = await this.extractAllStructures(content, language, {
        includeTopLevel: true,
        includeNested: true,
        includeInternal: true,
        maxNestingLevel: 5
      });

      // 分析关系
      const relationships = await this.analyzeRelationships(
        extractionResult.topLevelStructures,
        extractionResult.nestedStructures,
        extractionResult.internalStructures,
        content
      );

      return {
        ...extractionResult,
        relationships,
        stats: {
          totalStructures: extractionResult.stats.totalStructures,
          totalRelationships: relationships.nesting.length + relationships.references.length + relationships.dependencies.length,
          processingTime: Date.now() - startTime,
          cacheHit: extractionResult.stats.cacheHit,
          language
        }
      };
    } catch (error) {
      this.logger.error(`提取带关系结构失败 (${language}):`, error);
      
      // 返回空结果
      return {
        topLevelStructures: [],
        nestedStructures: [],
        internalStructures: [],
        relationships: {
          nesting: [],
          references: [],
          dependencies: []
        },
        stats: {
          totalStructures: 0,
          totalRelationships: 0,
          processingTime: Date.now() - startTime,
          cacheHit: false,
          language
        }
      };
    }
  }

  /**
   * 解析内容
   * @param content 源代码内容
   * @param language 编程语言
   * @returns 解析结果
   */
  private async parseContent(content: string, language: string): Promise<any> {
    try {
      if (this.treeSitterService.isInitialized()) {
        return await this.treeSitterService.parseCode(content, language);
      }
      throw new Error('TreeSitterService not initialized');
    } catch (error) {
      this.logger.error(`解析内容失败 (${language}):`, error);
      throw error;
    }
  }

  /**
   * 提取嵌套结构（带层级控制）
   * @param content 源代码内容
   * @param ast AST节点
   * @param maxLevel 最大层级
   * @param language 编程语言
   * @returns 嵌套结构数组
   */
  private async extractNestedStructuresWithLevel(
    content: string,
    ast: Parser.SyntaxNode,
    maxLevel: number,
    language: string
  ): Promise<NestedStructure[]> {
    const allNestedStructures: NestedStructure[] = [];
    
    // 从顶级结构开始递归提取
    const topLevelStructures = await this.astStructureExtractor.extractTopLevelStructuresFromAST(content, language, ast);
    
    for (const topLevelStructure of topLevelStructures) {
      if (topLevelStructure.node) {
        const nestedStructures = await this.extractNestedStructuresRecursive(
          content,
          topLevelStructure.node,
          1,
          maxLevel,
          ast
        );
        allNestedStructures.push(...nestedStructures);
      }
    }
    
    return allNestedStructures;
  }

  /**
   * 递归提取嵌套结构
   * @param content 源代码内容
   * @param parentNode 父节点
   * @param currentLevel 当前层级
   * @param maxLevel 最大层级
   * @param ast AST根节点
   * @returns 嵌套结构数组
   */
  private async extractNestedStructuresRecursive(
    content: string,
    parentNode: Parser.SyntaxNode,
    currentLevel: number,
    maxLevel: number,
    ast: Parser.SyntaxNode
  ): Promise<NestedStructure[]> {
    if (currentLevel > maxLevel) {
      return [];
    }
    
    try {
      const nestedStructures = await this.astStructureExtractor.extractNestedStructuresFromAST(
        content,
        parentNode,
        currentLevel,
        ast
      );
      
      // 递归提取更深层的嵌套结构
      const deeperStructures: NestedStructure[] = [];
      for (const nestedStructure of nestedStructures) {
        if (nestedStructure.parentNode) {
          const deeper = await this.extractNestedStructuresRecursive(
            content,
            nestedStructure.parentNode,
            currentLevel + 1,
            maxLevel,
            ast
          );
          deeperStructures.push(...deeper);
        }
      }
      
      return [...nestedStructures, ...deeperStructures];
    } catch (error) {
      this.logger.warn(`递归提取嵌套结构失败 (层级 ${currentLevel}):`, error);
      return [];
    }
  }

  /**
   * 分析结构关系
   * @param topLevelStructures 顶级结构
   * @param nestedStructures 嵌套结构
   * @param internalStructures 内部结构
   * @param content 源代码内容
   * @returns 关系信息
   */
  private async analyzeRelationships(
    topLevelStructures: TopLevelStructure[],
    nestedStructures: NestedStructure[],
    internalStructures: InternalStructure[],
    content: string
  ): Promise<{
    nesting: Array<{ parent: string; child: string; type: 'contains' | 'extends' | 'implements' }>;
    references: Array<{ from: string; to: string; type: 'function_call' | 'variable_reference' | 'type_reference' }>;
    dependencies: Array<{ from: string; to: string; type: 'import' | 'inheritance' | 'implementation' }>;
  }> {
    const relationships = {
      nesting: [] as Array<{ parent: string; child: string; type: 'contains' | 'extends' | 'implements' }>,
      references: [] as Array<{ from: string; to: string; type: 'function_call' | 'variable_reference' | 'type_reference' }>,
      dependencies: [] as Array<{ from: string; to: string; type: 'import' | 'inheritance' | 'implementation' }>
    };

    try {
      // 分析嵌套关系
      this.analyzeNestingRelationships(topLevelStructures, nestedStructures, relationships.nesting);
      
      // 分析引用关系
      this.analyzeReferenceRelationships(topLevelStructures, nestedStructures, internalStructures, content, relationships.references);
      
      // 分析依赖关系
      this.analyzeDependencyRelationships(topLevelStructures, nestedStructures, relationships.dependencies);
    } catch (error) {
      this.logger.warn('分析关系失败:', error);
    }

    return relationships;
  }

  /**
   * 分析嵌套关系
   */
  private analyzeNestingRelationships(
    topLevelStructures: TopLevelStructure[],
    nestedStructures: NestedStructure[],
    nestingRelationships: Array<{ parent: string; child: string; type: 'contains' | 'extends' | 'implements' }>
  ): void {
    // 简化的嵌套关系分析
    for (const nested of nestedStructures) {
      // 查找包含此嵌套结构的顶级结构
      const containingTopLevel = topLevelStructures.find(topLevel => 
        topLevel.location.startLine <= nested.location.startLine &&
        topLevel.location.endLine >= nested.location.endLine
      );
      
      if (containingTopLevel) {
        nestingRelationships.push({
          parent: containingTopLevel.name,
          child: nested.name,
          type: 'contains'
        });
      }
    }
  }

  /**
   * 分析引用关系
   */
  private analyzeReferenceRelationships(
    topLevelStructures: TopLevelStructure[],
    nestedStructures: NestedStructure[],
    internalStructures: InternalStructure[],
    content: string,
    referenceRelationships: Array<{ from: string; to: string; type: 'function_call' | 'variable_reference' | 'type_reference' }>
  ): void {
    // 简化的引用关系分析
    const allStructures = [...topLevelStructures, ...nestedStructures, ...internalStructures];
    
    for (const structure of allStructures) {
      // 在内容中查找对其他结构的引用
      for (const otherStructure of allStructures) {
        if (structure.name !== otherStructure.name && 
            structure.content.includes(otherStructure.name)) {
          referenceRelationships.push({
            from: structure.name,
            to: otherStructure.name,
            type: this.determineReferenceType(structure, otherStructure)
          });
        }
      }
    }
  }

  /**
   * 分析依赖关系
   */
  private analyzeDependencyRelationships(
    topLevelStructures: TopLevelStructure[],
    nestedStructures: NestedStructure[],
    dependencyRelationships: Array<{ from: string; to: string; type: 'import' | 'inheritance' | 'implementation' }>
  ): void {
    // 简化的依赖关系分析
    const allStructures = [...topLevelStructures, ...nestedStructures];
    
    for (const structure of allStructures) {
      if (structure.type === 'import') {
        // 导入语句创建依赖关系
        dependencyRelationships.push({
          from: structure.name,
          to: structure.content,
          type: 'import'
        });
      }
      
      if (structure.type === 'class' || structure.type === 'interface') {
        // 类和接口可能有继承关系
        for (const otherStructure of allStructures) {
          if (structure.content.includes(`extends ${otherStructure.name}`)) {
            dependencyRelationships.push({
              from: structure.name,
              to: otherStructure.name,
              type: 'inheritance'
            });
          }
          
          if (structure.content.includes(`implements ${otherStructure.name}`)) {
            dependencyRelationships.push({
              from: structure.name,
              to: otherStructure.name,
              type: 'implementation'
            });
          }
        }
      }
    }
  }

  /**
   * 确定引用类型
   */
  private determineReferenceType(
    fromStructure: any,
    toStructure: any
  ): 'function_call' | 'variable_reference' | 'type_reference' {
    if (toStructure.type === 'function' || toStructure.type === 'method') {
      return 'function_call';
    }
    
    if (toStructure.type === 'variable') {
      return 'variable_reference';
    }
    
    return 'type_reference';
  }

  /**
   * 生成缓存键
   */
  private generateCacheKey(content: string, language: string, options: ExtractionOptions): string {
    const optionsHash = this.hashOptions(options);
    const contentHash = this.hashContent(content);
    return `${language}:${contentHash}:${optionsHash}`;
  }

  /**
   * 哈希内容
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash).toString(36);
  }

  /**
   * 哈希选项
   */
  private hashOptions(options: ExtractionOptions): string {
    return JSON.stringify({
      includeTopLevel: options.includeTopLevel,
      includeNested: options.includeNested,
      includeInternal: options.includeInternal,
      maxNestingLevel: options.maxNestingLevel
    });
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return this.performanceMonitor?.getStats();
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    details: {
      queryNormalizer: boolean;
      treeSitterService: boolean;
      astStructureExtractor: boolean;
    };
    errors: string[];
  }> {
    const errors: string[] = [];
    const details = {
      queryNormalizer: false,
      treeSitterService: false,
      astStructureExtractor: false
    };
    
    // 检查各个组件
    try {
      if (this.queryNormalizer && typeof this.queryNormalizer.normalize === 'function') {
        details.queryNormalizer = true;
      } else {
        errors.push('QueryResultNormalizer不可用');
      }
    } catch (error) {
      errors.push(`QueryResultNormalizer检查失败: ${error}`);
    }
    
    try {
      if (this.treeSitterService && typeof this.treeSitterService.parseCode === 'function') {
        details.treeSitterService = true;
      } else {
        errors.push('TreeSitterCoreService不可用');
      }
    } catch (error) {
      errors.push(`TreeSitterCoreService检查失败: ${error}`);
    }
    
    try {
      if (this.astStructureExtractor && typeof this.astStructureExtractor.extractTopLevelStructuresFromAST === 'function') {
        details.astStructureExtractor = true;
      } else {
        errors.push('ASTStructureExtractor不可用');
      }
    } catch (error) {
      errors.push(`ASTStructureExtractor检查失败: ${error}`);
    }
    
    return {
      healthy: errors.length === 0,
      details,
      errors
    };
  }
}