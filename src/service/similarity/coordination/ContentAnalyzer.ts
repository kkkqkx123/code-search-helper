import { injectable, inject } from 'inversify';
import {
  IContentAnalyzer,
  ContentAnalysisResult,
  ContentComplexity,
  ContentFeature,
  SimilarityOptions,
  SimilarityStrategyType
} from './types/CoordinationTypes';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { CacheService } from '../../../infrastructure/caching/CacheService';
import { createHash } from 'crypto';
import { PerformanceMonitor } from '../../../infrastructure/monitoring/PerformanceMonitor';
import { InfrastructureConfigService } from '../../../infrastructure/config/InfrastructureConfigService';
import { DetectionService } from '../../../service/parser/detection/DetectionService';
import { ComplexityCalculator, CodeComplexityConfig } from '../../../utils/processing/ComplexityCalculator';

/**
 * 内容特征分析器
 * 负责分析内容特征，为策略选择提供依据
 */
@injectable()
export class ContentAnalyzer implements IContentAnalyzer {
  private readonly cacheService: CacheService;
  private performanceMonitor: PerformanceMonitor;
  private detectionService: DetectionService;

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.DetectionService) detectionService: DetectionService
  ) {
    this.cacheService = new CacheService(logger);
    this.performanceMonitor = new PerformanceMonitor(logger);
    this.detectionService = detectionService;
  }

  async analyzeContent(
    content1: string,
    content2: string,
    options?: SimilarityOptions
  ): Promise<ContentAnalysisResult> {
    const operationId = this.performanceMonitor.startOperation('analyze_content', {
      contentLength: content1.length + content2.length,
      hasOptions: !!options
    });
    
    try {
      // 生成缓存键
      const cacheKey = this.generateAnalysisCacheKey(content1, content2, options);
      
      // 尝试从缓存获取
      const cached = await this.cacheService.getFromCache<ContentAnalysisResult>(cacheKey);
      if (cached) {
        this.performanceMonitor.endOperation(operationId, {
          success: true,
          resultCount: 1,
          metadata: { status: 'cache_hit', contentType: cached.contentType }
        });
        this.logger.debug('Cache hit for content analysis', { cacheKey });
        return cached;
      }

      const result = await this.performAnalysis(content1, content2, options);
      
      // 存入缓存（1小时TTL）
      this.cacheService.setCache(cacheKey, result, 3600000);
      
      this.performanceMonitor.endOperation(operationId, {
        success: true,
        resultCount: 1,
        metadata: {
          status: 'success',
          contentType: result.contentType,
          cacheSize: this.cacheService.getSize()
        }
      });

      return result;
    } catch (error) {
      this.performanceMonitor.endOperation(operationId, {
        success: false,
        metadata: { error: (error as Error).message }
      });
      this.logger.error('Error during content analysis:', error);
      throw error;
    }
  }

  private async performAnalysis(
    content1: string,
    content2: string,
    options?: SimilarityOptions
  ): Promise<ContentAnalysisResult> {
    // 合并内容进行分析
    const combinedContent = content1 + '\n' + content2;
    
    const typeOpId = this.performanceMonitor.startOperation('detect_content_type');
    const contentType = await this.detectContentType(combinedContent, options?.language);
    this.performanceMonitor.endOperation(typeOpId, {
      success: true,
      metadata: { contentType }
    });

    // 计算内容长度（取平均值）
    const contentLength = Math.round((content1.length + content2.length) / 2);

    const complexityOpId = this.performanceMonitor.startOperation('calculate_complexity');
    const complexity = this.calculateComplexity(combinedContent);
    this.performanceMonitor.endOperation(complexityOpId, {
      success: true,
      metadata: { level: complexity.level, score: complexity.score }
    });

    const featuresOpId = this.performanceMonitor.startOperation('extract_features');
    const features = this.extractFeatures(combinedContent, contentType);
    this.performanceMonitor.endOperation(featuresOpId, {
      success: true,
      resultCount: features.length,
      metadata: { featureTypes: features.map(f => f.name) }
    });

    const strategiesOpId = this.performanceMonitor.startOperation('recommend_strategies');
    const recommendedStrategies = this.recommendStrategies(contentType, complexity, features);
    this.performanceMonitor.endOperation(strategiesOpId, {
      success: true,
      resultCount: recommendedStrategies.length,
      metadata: { strategies: recommendedStrategies }
    });

    const result: ContentAnalysisResult = {
      contentType,
      contentLength,
      complexity,
      language: options?.language,
      features,
      recommendedStrategies
    };

    return result;
  }

  async detectContentType(content: string, language?: string): Promise<string> {
    // 如果提供了编程语言，则直接判定为代码
    if (language) {
      return 'code';
    }
    
    // 使用DetectionService检测内容类型
    try {
      // 使用detectFile方法，传入临时文件名
      const detectionResult = await this.detectionService.detectFile('temp_file', content);
      
      if (detectionResult.language && detectionResult.language !== 'unknown' && detectionResult.confidence > 0.5) {
        // 如果检测到了编程语言，则认为是代码
        return 'code';
      }
    } catch (error) {
      this.logger.warn('Language detection service failed:', error);
    }
    
    // 默认为通用文本
    return 'generic';
  }

  calculateComplexity(content: string): ContentComplexity {
    // 使用ComplexityCalculator计算复杂度
    const complexityResult = ComplexityCalculator.calculateGenericComplexity(content);
    
    // 将ComplexityCalculator的结果转换为ContentComplexity格式
    const score = Math.min(1, Math.max(0, complexityResult.score / 100)); // 标准化到0-1范围
    
    // 确定复杂度级别
    let level: 'low' | 'medium' | 'high';
    if (score < 0.3) {
      level = 'low';
    } else if (score < 0.7) {
      level = 'medium';
    } else {
      level = 'high';
    }

    // 从analysis中提取影响因素
    const factors: string[] = [];
    if (complexityResult.analysis.contentLength && complexityResult.analysis.contentLength > 1000) {
      factors.push('long_content');
    } else if (complexityResult.analysis.contentLength && complexityResult.analysis.contentLength > 500) {
      factors.push('medium_content');
    }
    
    if (complexityResult.analysis.uniqueCharCount && complexityResult.analysis.contentLength) {
      const diversityRatio = complexityResult.analysis.uniqueCharCount / complexityResult.analysis.contentLength;
      if (diversityRatio > 0.5) {
        factors.push('high_diversity');
      }
    }

    return {
      score,
      level,
      factors
    };
  }

  extractFeatures(content: string, contentType: string): ContentFeature[] {
    const features: ContentFeature[] = [];

    // 通用特征
    features.push({
      name: 'length',
      value: content.length,
      weight: 0.1
    });

    features.push({
      name: 'line_count',
      value: content.split('\n').length,
      weight: 0.1
    });

    features.push({
      name: 'word_count',
      value: content.split(/\s+/).length,
      weight: 0.1
    });

    // 简化的特征提取，只保留基本的通用特征
    // 移除了特定内容类型的特征提取，因为这些应该由专门的服务处理

    return features;
  }

  private recommendStrategies(
    contentType: string,
    complexity: ContentComplexity,
    features: ContentFeature[]
  ): SimilarityStrategyType[] {
    const strategies: SimilarityStrategyType[] = [];
    
    // 基于内容类型推荐
    if (contentType === 'code') {
      strategies.push('keyword', 'levenshtein');
      if (complexity.level === 'high') {
        strategies.push('semantic');
      }
    } else if (contentType === 'document') {
      strategies.push('semantic', 'keyword');
      if (complexity.level !== 'low') {
        strategies.push('levenshtein');
      }
    } else {
      strategies.push('levenshtein', 'keyword');
      if (complexity.level === 'high') {
        strategies.push('semantic');
      }
    }

    // 总是包含混合策略作为备选
    strategies.push('hybrid');
    
    return strategies;
  }

  private generateAnalysisCacheKey(
    content1: string,
    content2: string,
    options?: SimilarityOptions
  ): string {
    const combinedContent = content1 + '||' + content2;
    const hash = createHash('sha256').update(combinedContent).digest('hex');
    const optionsStr = JSON.stringify(options || {});
    return `similarity:analysis:${hash}:${optionsStr}`;
  }
}