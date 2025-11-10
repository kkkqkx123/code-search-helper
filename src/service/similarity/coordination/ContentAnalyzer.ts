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
import { BracketCounter } from '../../../utils/structure/BracketCounter';
import { createHash } from 'crypto';
import { PerformanceMonitor } from '../../../infrastructure/monitoring/PerformanceMonitor';

/**
 * 内容特征分析器
 * 负责分析内容特征，为策略选择提供依据
 */
@injectable()
export class ContentAnalyzer implements IContentAnalyzer {
  private readonly complexityFactors = {
    // 代码复杂度因素
    code: [
      'nesting_depth',
      'control_structures',
      'function_calls',
      'class_definitions',
      'import_statements',
      'comment_ratio'
    ],
    // 文本复杂度因素
    text: [
      'sentence_length',
      'vocabulary_diversity',
      'punctuation_ratio',
      'structure_markers'
    ],
    // 通用复杂度因素
    generic: [
      'length',
      'unique_characters',
      'repetition_ratio',
      'formatting_complexity'
    ]
  };

  private readonly cacheService: CacheService;
  private performanceMonitor: PerformanceMonitor;

  constructor(
    @inject(TYPES.LoggerService) private logger?: LoggerService
  ) {
    // 创建一个默认的 LoggerService 实例，如果未提供
    const loggerInstance = logger || new LoggerService();
    this.cacheService = new CacheService(loggerInstance);
    this.performanceMonitor = new PerformanceMonitor(loggerInstance);
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
        this.logger?.debug('Cache hit for content analysis', { cacheKey });
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
      this.logger?.error('Error during content analysis:', error);
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
    const contentType = this.detectContentType(combinedContent, options?.language);
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

  detectContentType(content: string, language?: string): string {
    // 如果指定了语言，优先使用语言判断
    if (language) {
      const codeLanguages = [
        'javascript', 'typescript', 'python', 'java', 'c', 'cpp', 'csharp',
        'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'scala', 'r',
        'html', 'css', 'scss', 'less', 'xml', 'json', 'yaml', 'yml'
      ];

      if (codeLanguages.includes(language.toLowerCase())) {
        return 'code';
      }
    }

    // 基于内容特征检测
    const codeIndicators = [
      /\bfunction\s+\w+\s*\(/,
      /\bclass\s+\w+/,
      /\bif\s*\(/,
      /\bfor\s*\(/,
      /\bwhile\s*\(/,
      /\bimport\s+/,
      /\brequire\s*\(/,
      /\bexport\s+/,
      /\{[\s\S]*\}/, // 大括号
      /;\s*$/, // 分号结尾
      /\/\/.*$/, // 单行注释
      /\/\*[\s\S]*?\*\// // 多行注释
    ];

    const codeScore = codeIndicators.reduce((score, pattern) => {
      return pattern.test(content) ? score + 1 : score;
    }, 0);

    // 如果代码特征分数超过阈值，认为是代码
    if (codeScore >= 3) {
      return 'code';
    }

    // 检查是否为结构化文档
    const documentIndicators = [
      /^#\s+/, // Markdown标题
      /^\s*[-*+]\s+/m, // 列表
      /^\s*\d+\.\s+/m, // 有序列表
      /```[\s\S]*```/, // 代码块
      /\*\*.*?\*\*/, // 粗体
      /\*.*?\*/, // 斜体
      /\[.*?\]\(.*?\)/ // 链接
    ];

    const documentScore = documentIndicators.reduce((score, pattern) => {
      return pattern.test(content) ? score + 1 : score;
    }, 0);

    if (documentScore >= 2) {
      return 'document';
    }

    // 默认为通用文本
    return 'generic';
  }

  calculateComplexity(content: string): ContentComplexity {
    const factors: string[] = [];
    let score = 0;

    // 长度复杂度
    const length = content.length;
    if (length > 1000) {
      score += 0.3;
      factors.push('long_content');
    } else if (length > 500) {
      score += 0.2;
      factors.push('medium_content');
    }

    // 字符多样性
    const uniqueChars = new Set(content).size;
    const diversityRatio = uniqueChars / length;
    if (diversityRatio > 0.5) {
      score += 0.2;
      factors.push('high_diversity');
    }

    // 重复度
    const words = content.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words).size;
    const repetitionRatio = 1 - (uniqueWords / words.length);
    if (repetitionRatio > 0.3) {
      score += 0.1;
      factors.push('high_repetition');
    }

    // 结构复杂度
    const structurePatterns = [
      /\{[^}]*\{[^}]*\}/, // 嵌套结构
      /\([^)]*\([^)]*\)/, // 嵌套括号
      /\[[^\]]*\[[^\]]*\]/, // 嵌套数组
      /if.*if/, // 嵌套条件
      /for.*for/, // 嵌套循环
    ];

    const structureScore = structurePatterns.reduce((count, pattern) => {
      return pattern.test(content) ? count + 1 : count;
    }, 0);

    if (structureScore > 0) {
      score += Math.min(0.3, structureScore * 0.1);
      factors.push('nested_structure');
    }

    // 特殊字符密度
    const specialChars = content.match(/[^\w\s]/g);
    const specialCharRatio = specialChars ? specialChars.length / length : 0;
    if (specialCharRatio > 0.2) {
      score += 0.1;
      factors.push('high_special_char_density');
    }

    // 标准化分数到0-1范围
    score = Math.min(1, Math.max(0, score));

    // 确定复杂度级别
    let level: 'low' | 'medium' | 'high';
    if (score < 0.3) {
      level = 'low';
    } else if (score < 0.7) {
      level = 'medium';
    } else {
      level = 'high';
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

    // 根据内容类型提取特定特征
    if (contentType === 'code') {
      this.extractCodeFeatures(content, features);
    } else if (contentType === 'document') {
      this.extractDocumentFeatures(content, features);
    } else {
      this.extractGenericFeatures(content, features);
    }

    return features;
  }

  private extractCodeFeatures(content: string, features: ContentFeature[]): void {
    // 函数数量
    const functionMatches = content.match(/\bfunction\s+\w+|=\s*\w+\s*=>|\w+\s*:\s*\([^)]*\)\s*=>/g);
    features.push({
      name: 'function_count',
      value: functionMatches ? functionMatches.length : 0,
      weight: 0.15
    });

    // 类数量
    const classMatches = content.match(/\bclass\s+\w+/g);
    features.push({
      name: 'class_count',
      value: classMatches ? classMatches.length : 0,
      weight: 0.15
    });

    // 注释比例
    const commentMatches = content.match(/\/\/.*$|\/\*[\s\S]*?\*\//gm);
    const commentLength = commentMatches ? commentMatches.join('').length : 0;
    const commentRatio = commentLength / content.length;
    features.push({
      name: 'comment_ratio',
      value: commentRatio,
      weight: 0.1
    });

    // 嵌套深度
    const maxNesting = this.calculateMaxNestingDepth(content);
    features.push({
      name: 'max_nesting_depth',
      value: maxNesting,
      weight: 0.2
    });
  }

  private extractDocumentFeatures(content: string, features: ContentFeature[]): void {
    // 标题数量
    const headingMatches = content.match(/^#+\s+.+$/gm);
    features.push({
      name: 'heading_count',
      value: headingMatches ? headingMatches.length : 0,
      weight: 0.15
    });

    // 列表项数量
    const listMatches = content.match(/^\s*[-*+]\s+|^\s*\d+\.\s+/gm);
    features.push({
      name: 'list_item_count',
      value: listMatches ? listMatches.length : 0,
      weight: 0.15
    });

    // 链接数量
    const linkMatches = content.match(/\[.*?\]\(.*?\)/g);
    features.push({
      name: 'link_count',
      value: linkMatches ? linkMatches.length : 0,
      weight: 0.1
    });

    // 代码块数量
    const codeBlockMatches = content.match(/```[\s\S]*?```/g);
    features.push({
      name: 'code_block_count',
      value: codeBlockMatches ? codeBlockMatches.length : 0,
      weight: 0.1
    });
  }

  private extractGenericFeatures(content: string, features: ContentFeature[]): void {
    // 句子数量
    const sentenceMatches = content.match(/[.!?]+/g);
    features.push({
      name: 'sentence_count',
      value: sentenceMatches ? sentenceMatches.length : 0,
      weight: 0.15
    });

    // 段落数量
    const paragraphMatches = content.split(/\n\s*\n/);
    features.push({
      name: 'paragraph_count',
      value: paragraphMatches.length,
      weight: 0.15
    });

    // 标点符号密度
    const punctuationMatches = content.match(/[.,;:!?'"()[\]{}]/g);
    const punctuationRatio = punctuationMatches ? punctuationMatches.length / content.length : 0;
    features.push({
      name: 'punctuation_density',
      value: punctuationRatio,
      weight: 0.1
    });
  }

  private calculateMaxNestingDepth(content: string): number {
    return BracketCounter.calculateMaxNestingDepth(content);
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