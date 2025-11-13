import Parser from 'tree-sitter';
import { HtmlHelperMethods } from './HtmlHelperMethods';
import { StructuralRelationshipExtractor } from './StructuralRelationshipExtractor';
import { DependencyRelationshipExtractor } from './DependencyRelationshipExtractor';
import { ReferenceRelationshipExtractor } from './ReferenceRelationshipExtractor';
import { 
  HtmlRelationship, 
  RelationshipExtractionOptions, 
  RelationshipExtractionResult,
  DEFAULT_RELATIONSHIP_OPTIONS 
} from './HtmlRelationshipTypes';
import { LoggerService } from '../../../../../../utils/LoggerService';

/**
 * HTML关系提取器主类
 * 协调各种关系提取器，提供统一的关系提取接口
 */
export class HtmlRelationshipExtractor {
  private logger: LoggerService;
  private structuralExtractor: StructuralRelationshipExtractor;
  private dependencyExtractor: DependencyRelationshipExtractor;
  private referenceExtractor: ReferenceRelationshipExtractor;
  private cache: Map<string, RelationshipExtractionResult> = new Map();

  constructor() {
    this.logger = new LoggerService();
    this.structuralExtractor = new StructuralRelationshipExtractor();
    this.dependencyExtractor = new DependencyRelationshipExtractor();
    this.referenceExtractor = new ReferenceRelationshipExtractor();
  }

  /**
   * 提取所有HTML关系
   * @param ast AST根节点
   * @param options 提取选项
   * @returns 关系提取结果
   */
  async extractAllRelationships(
    ast: Parser.SyntaxNode,
    options: Partial<RelationshipExtractionOptions> = {}
  ): Promise<RelationshipExtractionResult> {
    const startTime = Date.now();
    const mergedOptions = { ...DEFAULT_RELATIONSHIP_OPTIONS, ...options };
    
    // 生成缓存键
    const cacheKey = this.generateCacheKey(ast, mergedOptions);
    
    // 检查缓存
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.logger.debug('使用缓存的关系提取结果');
      return cached;
    }

    const relationships: HtmlRelationship[] = [];
    const extractionPromises: Promise<void>[] = [];

    try {
      // 并行提取各类关系
      if (mergedOptions.extractStructural) {
        extractionPromises.push(
          this.extractWithStats('structural', () => {
            const structuralRels = this.structuralExtractor.extractRelationships(ast);
            relationships.push(...structuralRels);
          })
        );
      }

      if (mergedOptions.extractDependencies) {
        extractionPromises.push(
          this.extractWithStats('dependencies', () => {
            const dependencyRels = this.dependencyExtractor.extractRelationships(ast);
            relationships.push(...dependencyRels);
          })
        );
      }

      if (mergedOptions.extractReferences) {
        extractionPromises.push(
          this.extractWithStats('references', () => {
            const referenceRels = this.referenceExtractor.extractRelationships(ast);
            relationships.push(...referenceRels);
          })
        );
      }

      // 等待所有提取完成
      await Promise.all(extractionPromises);

      // 过滤关系（根据选项）
      const filteredRelationships = this.filterRelationships(relationships, mergedOptions);

      // 计算统计信息
      const stats = this.calculateStats(filteredRelationships);
      const extractionTime = Date.now() - startTime;

      const result: RelationshipExtractionResult = {
        relationships: filteredRelationships,
        stats,
        extractionTime
      };

      // 缓存结果
      this.cache.set(cacheKey, result);

      this.logger.info(`HTML关系提取完成: ${filteredRelationships.length} 个关系，耗时 ${extractionTime}ms`);
      
      return result;

    } catch (error) {
      this.logger.error('HTML关系提取失败:', error);
      
      // 返回空结果而不是抛出错误
      const errorResult: RelationshipExtractionResult = {
        relationships: [],
        stats: {
          structural: 0,
          dependencies: 0,
          references: 0,
          semantic: 0,
          total: 0
        },
        extractionTime: Date.now() - startTime
      };

      return errorResult;
    }
  }

  /**
   * 提取特定类型的关系
   * @param ast AST根节点
   * @param relationshipType 关系类型
   * @param options 提取选项
   * @returns 关系数组
   */
  async extractRelationshipsByType(
    ast: Parser.SyntaxNode,
    relationshipType: 'structural' | 'dependencies' | 'references',
    options: Partial<RelationshipExtractionOptions> = {}
  ): Promise<HtmlRelationship[]> {
    const mergedOptions = { ...DEFAULT_RELATIONSHIP_OPTIONS, ...options };
    
    switch (relationshipType) {
      case 'structural':
        if (!mergedOptions.extractStructural) return [];
        return this.structuralExtractor.extractRelationships(ast);
        
      case 'dependencies':
        if (!mergedOptions.extractDependencies) return [];
        return this.dependencyExtractor.extractRelationships(ast);
        
      case 'references':
        if (!mergedOptions.extractReferences) return [];
        return this.referenceExtractor.extractRelationships(ast);
        
      default:
        this.logger.warn(`未知的关系类型: ${relationshipType}`);
        return [];
    }
  }

  /**
   * 获取关系统计信息
   * @param relationships 关系数组
   * @returns 详细统计信息
   */
  getDetailedStats(relationships: HtmlRelationship[]): {
    structural: any;
    dependencies: any;
    references: any;
    summary: {
      total: number;
      byType: Record<string, number>;
      bySource: Record<string, number>;
      byTarget: Record<string, number>;
    };
  } {
    const structuralRels = relationships.filter(rel => 
      ['parent-child', 'sibling', 'ancestor'].includes(rel.type)
    ) as any[];
    
    const dependencyRels = relationships.filter(rel => 
      ['resource-dependency', 'script-dependency', 'style-dependency'].includes(rel.type)
    ) as any[];
    
    const referenceRels = relationships.filter(rel => 
      ['id-reference', 'class-reference', 'name-reference', 'for-reference'].includes(rel.type)
    ) as any[];

    const structuralStats = structuralRels.length > 0 ? 
      this.structuralExtractor.getRelationshipStats(structuralRels) : null;
    
    const dependencyStats = dependencyRels.length > 0 ? 
      this.dependencyExtractor.getRelationshipStats(dependencyRels) : null;
    
    const referenceStats = referenceRels.length > 0 ? 
      this.referenceExtractor.getRelationshipStats(referenceRels) : null;

    // 计算汇总统计
    const byType: Record<string, number> = {};
    const bySource: Record<string, number> = {};
    const byTarget: Record<string, number> = {};

    for (const rel of relationships) {
      byType[rel.type] = (byType[rel.type] || 0) + 1;
      bySource[rel.source] = (bySource[rel.source] || 0) + 1;
      byTarget[rel.target] = (byTarget[rel.target] || 0) + 1;
    }

    return {
      structural: structuralStats,
      dependencies: dependencyStats,
      references: referenceStats,
      summary: {
        total: relationships.length,
        byType,
        bySource,
        byTarget
      }
    };
  }

  /**
   * 验证关系完整性
   * @param relationships 关系数组
   * @returns 验证结果
   */
  validateRelationships(relationships: HtmlRelationship[]): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    orphanedReferences: string[];
    circularReferences: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const orphanedReferences: string[] = [];
    const circularReferences: string[] = [];

    // 检查关系完整性
    for (const rel of relationships) {
      // 检查必需字段
      if (!rel.type) errors.push('关系缺少type字段');
      if (!rel.source) errors.push('关系缺少source字段');
      if (!rel.target) errors.push('关系缺少target字段');
      if (!rel.metadata) warnings.push('关系缺少metadata字段');

      // 检查引用完整性
      if (rel.type.includes('reference')) {
        const refRel = rel as any;
        if (!refRel.referenceValue) {
          orphanedReferences.push(`${rel.source} -> ${rel.target}`);
        }
      }
    }

    // 检查循环引用
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    for (const rel of relationships) {
      if (this.hasCircularReference(rel, relationships, visited, recursionStack)) {
        circularReferences.push(`${rel.source} -> ${rel.target}`);
      }
    }

    const isValid = errors.length === 0;

    return {
      isValid,
      errors,
      warnings,
      orphanedReferences,
      circularReferences
    };
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.cache.clear();
    HtmlHelperMethods.clearCache();
    this.logger.debug('HTML关系提取器缓存已清理');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    relationshipCache: number;
    helperCache: number;
  } {
    return {
      relationshipCache: this.cache.size,
      helperCache: HtmlHelperMethods.getCacheStats().size
    };
  }

  /**
   * 生成缓存键
   * @param ast AST根节点
   * @param options 提取选项
   * @returns 缓存键
   */
  private generateCacheKey(ast: Parser.SyntaxNode, options: RelationshipExtractionOptions): string {
    const astHash = `${ast.id}_${ast.startPosition.row}_${ast.startPosition.column}`;
    const optionsHash = JSON.stringify(options);
    return `html_relationships_${astHash}_${optionsHash}`;
  }

  /**
   * 带统计的提取方法
   * @param type 提取类型
   * @param extractFn 提取函数
   */
  private async extractWithStats(type: string, extractFn: () => void): Promise<void> {
    const startTime = Date.now();
    try {
      extractFn();
      const duration = Date.now() - startTime;
      this.logger.debug(`${type}关系提取完成，耗时 ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`${type}关系提取失败，耗时 ${duration}ms:`, error);
      throw error;
    }
  }

  /**
   * 过滤关系
   * @param relationships 关系数组
   * @param options 过滤选项
   * @returns 过滤后的关系
   */
  private filterRelationships(
    relationships: HtmlRelationship[],
    options: RelationshipExtractionOptions
  ): HtmlRelationship[] {
    let filtered = [...relationships];

    // 过滤外部资源
    if (!options.includeExternal) {
      filtered = filtered.filter(rel => {
        if ('isExternal' in rel) {
          return !(rel as any).isExternal;
        }
        return true;
      });
    }

    // 去重
    filtered = this.deduplicateRelationships(filtered);

    return filtered;
  }

  /**
   * 去除重复关系
   * @param relationships 关系数组
   * @returns 去重后的关系
   */
  private deduplicateRelationships(relationships: HtmlRelationship[]): HtmlRelationship[] {
    const seen = new Set<string>();
    const deduplicated: HtmlRelationship[] = [];

    for (const rel of relationships) {
      const key = `${rel.type}_${rel.source}_${rel.target}`;
      if (!seen.has(key)) {
        seen.add(key);
        deduplicated.push(rel);
      }
    }

    return deduplicated;
  }

  /**
   * 计算统计信息
   * @param relationships 关系数组
   * @returns 统计信息
   */
  private calculateStats(relationships: HtmlRelationship[]): {
    structural: number;
    dependencies: number;
    references: number;
    semantic: number;
    total: number;
  } {
    const stats = {
      structural: 0,
      dependencies: 0,
      references: 0,
      semantic: 0,
      total: relationships.length
    };

    for (const rel of relationships) {
      switch (rel.type) {
        case 'parent-child':
        case 'sibling':
        case 'ancestor':
          stats.structural++;
          break;
        case 'resource-dependency':
        case 'script-dependency':
        case 'style-dependency':
          stats.dependencies++;
          break;
        case 'id-reference':
        case 'class-reference':
        case 'name-reference':
        case 'for-reference':
          stats.references++;
          break;
        case 'form-relationship':
        case 'table-relationship':
        case 'navigation-relationship':
        case 'list-relationship':
          stats.semantic++;
          break;
      }
    }

    return stats;
  }

  /**
   * 检查循环引用
   * @param rel 当前关系
   * @param allRelationships 所有关系
   * @param visited 已访问节点
   * @param recursionStack 递归栈
   * @returns 是否有循环引用
   */
  private hasCircularReference(
    rel: HtmlRelationship,
    allRelationships: HtmlRelationship[],
    visited: Set<string>,
    recursionStack: Set<string>
  ): boolean {
    if (recursionStack.has(rel.source)) {
      return true;
    }

    if (visited.has(rel.source)) {
      return false;
    }

    visited.add(rel.source);
    recursionStack.add(rel.source);

    // 查找以当前关系目标为源的关系
    const nextRels = allRelationships.filter(r => r.source === rel.target);
    for (const nextRel of nextRels) {
      if (this.hasCircularReference(nextRel, allRelationships, visited, recursionStack)) {
        return true;
      }
    }

    recursionStack.delete(rel.source);
    return false;
  }
}