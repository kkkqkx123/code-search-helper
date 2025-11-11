import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { IBatchStrategy, IBatchStrategyFactory, BatchContext } from '../types';
import { SemanticBatchStrategy } from './SemanticBatchStrategy';
import { QdrantBatchStrategy } from './QdrantBatchStrategy';
import { NebulaBatchStrategy } from './NebulaBatchStrategy';
import { GraphBatchStrategy } from './GraphBatchStrategy';
import { EmbeddingBatchStrategy } from './EmbeddingBatchStrategy';

/**
 * 批处理策略工厂
 * 负责根据上下文选择合适的批处理策略
 */
@injectable()
export class BatchStrategyFactory implements IBatchStrategyFactory {
  private strategies: Map<string, IBatchStrategy> = new Map();

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.SemanticBatchStrategy) private semanticStrategy: SemanticBatchStrategy,
    @inject(TYPES.QdrantBatchStrategy) private qdrantStrategy: QdrantBatchStrategy,
    @inject(TYPES.NebulaBatchStrategy) private nebulaStrategy: NebulaBatchStrategy,
    @inject(TYPES.GraphBatchStrategy) private graphStrategy: GraphBatchStrategy,
    @inject(TYPES.EmbeddingBatchStrategy) private embeddingStrategy: EmbeddingBatchStrategy
  ) {
    this.initializeStrategies();
  }

  /**
   * 初始化默认策略
   */
  private initializeStrategies(): void {
    // 注册语义相似度策略
    this.registerStrategy('similarity', 'semantic', this.semanticStrategy);
    
    // 注册数据库策略
    this.registerStrategy('database', 'qdrant', this.qdrantStrategy);
    this.registerStrategy('database', 'nebula', this.nebulaStrategy);
    this.registerStrategy('database', 'graph', this.graphStrategy);
    
    // 注册嵌入器策略
    this.registerStrategy('embedding', 'api', this.embeddingStrategy);
    
    this.logger.info('Batch strategy factory initialized', {
      strategies: this.getAvailableStrategies().map(s => `${s.domain}:${s.subType}`)
    });
  }

  /**
   * 根据上下文获取策略
   */
  getStrategy(context: BatchContext): IBatchStrategy {
    const key = this.getStrategyKey(context.domain, context.subType || 'default');
    const strategy = this.strategies.get(key);
    
    if (!strategy) {
      this.logger.warn(`No strategy found for context: ${key}, using default strategy`);
      return this.getDefaultStrategy(context.domain);
    }
    
    return strategy;
  }

  /**
   * 注册策略
   */
  registerStrategy(domain: string, subType: string, strategy: IBatchStrategy): void {
    const key = this.getStrategyKey(domain, subType);
    this.strategies.set(key, strategy);
    
    this.logger.debug(`Registered batch strategy: ${key}`, {
      domain,
      subType,
      strategy: strategy.constructor.name
    });
  }

  /**
   * 获取可用策略列表
   */
  getAvailableStrategies(): Array<{ domain: string; subType: string; strategy: IBatchStrategy }> {
    const strategies: Array<{ domain: string; subType: string; strategy: IBatchStrategy }> = [];
    
    for (const [key, strategy] of this.strategies.entries()) {
      const [domain, subType] = key.split(':');
      strategies.push({ domain, subType, strategy });
    }
    
    return strategies;
  }

  /**
   * 获取默认策略
   */
  private getDefaultStrategy(domain: string): IBatchStrategy {
    switch (domain) {
      case 'similarity':
        return this.semanticStrategy;
      case 'database':
        return this.qdrantStrategy; // 默认使用Qdrant策略
      case 'embedding':
        return this.embeddingStrategy;
      default:
        return this.embeddingStrategy; // 默认使用嵌入器策略
    }
  }

  /**
   * 生成策略键
   */
  private getStrategyKey(domain: string, subType: string): string {
    return `${domain}:${subType}`;
  }

  /**
   * 检查策略是否存在
   */
  hasStrategy(domain: string, subType: string): boolean {
    const key = this.getStrategyKey(domain, subType);
    return this.strategies.has(key);
  }

  /**
   * 注销策略
   */
  unregisterStrategy(domain: string, subType: string): boolean {
    const key = this.getStrategyKey(domain, subType);
    const removed = this.strategies.delete(key);
    
    if (removed) {
      this.logger.debug(`Unregistered batch strategy: ${key}`);
    }
    
    return removed;
  }

  /**
   * 获取策略统计信息
   */
  getStrategyStats(): {
    totalStrategies: number;
    strategiesByDomain: Record<string, number>;
    availableDomains: string[];
  } {
    const strategiesByDomain: Record<string, number> = {};
    const availableDomains = new Set<string>();
    
    for (const [key] of this.strategies.entries()) {
      const [domain] = key.split(':');
      availableDomains.add(domain);
      strategiesByDomain[domain] = (strategiesByDomain[domain] || 0) + 1;
    }
    
    return {
      totalStrategies: this.strategies.size,
      strategiesByDomain,
      availableDomains: Array.from(availableDomains)
    };
  }

  /**
   * 根据性能推荐策略
   */
  recommendStrategy(
    domain: string,
    itemsCount: number,
    metadata?: Record<string, any>
  ): { strategy: IBatchStrategy; reason: string; confidence: number } {
    let strategy: IBatchStrategy;
    let reason: string;
    let confidence: number = 0.8;
    
    switch (domain) {
      case 'similarity':
        if (metadata?.strategyType === 'semantic') {
          strategy = this.semanticStrategy;
          reason = 'Semantic similarity strategy recommended for semantic content analysis';
          confidence = 0.95;
        } else {
          strategy = this.semanticStrategy;
          reason = 'Default semantic strategy recommended for similarity analysis';
          confidence = 0.7;
        }
        break;
        
      case 'database':
        const databaseType = metadata?.databaseType || 'qdrant';
        if (databaseType === 'qdrant') {
          strategy = this.qdrantStrategy;
          reason = 'Qdrant strategy recommended for vector database operations';
          confidence = 0.9;
        } else if (databaseType === 'nebula') {
          strategy = this.nebulaStrategy;
          reason = 'Nebula strategy recommended for graph database operations';
          confidence = 0.9;
        } else {
          strategy = this.qdrantStrategy;
          reason = 'Default Qdrant strategy recommended for unknown database type';
          confidence = 0.6;
        }
        break;
        
      case 'embedding':
        const provider = metadata?.provider || 'default';
        if (provider === 'openai' || provider === 'siliconflow') {
          strategy = this.embeddingStrategy;
          reason = 'Embedding strategy recommended for API-based embedding providers';
          confidence = 0.85;
        } else {
          strategy = this.embeddingStrategy;
          reason = 'Default embedding strategy recommended for embedding operations';
          confidence = 0.7;
        }
        break;
        
      default:
        strategy = this.embeddingStrategy;
        reason = 'Default embedding strategy recommended for unknown domain';
        confidence = 0.5;
    }
    
    // 根据项目数量调整置信度
    if (itemsCount < 10) {
      confidence *= 0.8; // 小批量时置信度降低
    } else if (itemsCount > 1000) {
      confidence *= 0.9; // 大批量时置信度略降
    }
    
    return {
      strategy,
      reason,
      confidence: Math.max(0.1, confidence)
    };
  }

  /**
   * 验证策略配置
   */
  validateStrategyConfig(): {
    valid: boolean;
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    
    // 检查是否有基本策略
    const requiredDomains = ['similarity', 'database', 'embedding'];
    for (const domain of requiredDomains) {
      const hasDomainStrategy = Array.from(this.strategies.keys()).some(key => 
        key.startsWith(`${domain}:`)
      );
      
      if (!hasDomainStrategy) {
        issues.push(`Missing strategy for domain: ${domain}`);
      }
    }
    
    // 检查数据库策略完整性
    const hasQdrant = this.hasStrategy('database', 'qdrant');
    const hasNebula = this.hasStrategy('database', 'nebula');
    
    if (!hasQdrant) {
      recommendations.push('Consider adding Qdrant-specific strategy for better vector database performance');
    }
    
    if (!hasNebula) {
      recommendations.push('Consider adding Nebula-specific strategy for better graph database performance');
    }
    
    // 检查策略数量
    const totalStrategies = this.strategies.size;
    if (totalStrategies < 3) {
      recommendations.push('Consider adding more specialized strategies for better performance optimization');
    } else if (totalStrategies > 10) {
      recommendations.push('Consider consolidating similar strategies to reduce complexity');
    }
    
    return {
      valid: issues.length === 0,
      issues,
      recommendations
    };
  }
}