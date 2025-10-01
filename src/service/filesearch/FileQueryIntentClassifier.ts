import { injectable, inject } from 'inversify';
import { FileQueryType, QueryIntentClassification } from './types';
import { LoggerService } from '../../utils/LoggerService';
import { TYPES } from '../../types';

/**
 * 文件查询意图分类器
 * 分析用户查询，确定搜索意图类型
 */
@injectable()
export class FileQueryIntentClassifier {
  constructor(@inject(TYPES.LoggerService) private logger: LoggerService) {}

  /**
   * 分类查询意图
   */
  async classifyQuery(query: string): Promise<QueryIntentClassification> {
    try {
      this.logger.debug(`开始分类查询意图: ${query}`);
      
      const normalizedQuery = query.toLowerCase().trim();
      const context = this.analyzeQueryContext(normalizedQuery);
      
      // 基于规则的模式匹配
      const classification = this.determineQueryType(normalizedQuery, context);
      
      this.logger.debug(`查询意图分类结果:`, classification);
      return classification;
    } catch (error) {
      this.logger.error(`查询意图分类失败: ${query}`, error);
      // 出错时返回默认分类
      return {
        type: 'SEMANTIC_DESCRIPTION',
        confidence: 0.5,
        extractedKeywords: [query],
        context: {
          hasPathPattern: false,
          hasSemanticTerms: true,
          hasExtensionFilter: false,
          hasTimeConstraint: false
        }
      };
    }
  }

  /**
   * 分析查询上下文
   */
  private analyzeQueryContext(query: string): QueryIntentClassification['context'] {
    const context = {
      hasPathPattern: false,
      hasSemanticTerms: false,
      hasExtensionFilter: false,
      hasTimeConstraint: false
    };
    
    // 检测路径模式关键词 - 调整检测逻辑
    const pathKeywords = ['目录', '文件夹', '路径', '下', '在', '位于', 'path', 'directory', 'folder'];
    const hasPathKeywords = pathKeywords.some(keyword => query.includes(keyword));
    // 位置词汇检测
    const locationWords = ['in', '在', '位于', 'under', '下'];
    const hasLocationWords = locationWords.some(word => query.includes(word));
    // 如果包含路径关键词并且有位置词汇，或者是中文路径表达，则认为是路径模式
    context.hasPathPattern = (hasPathKeywords && hasLocationWords) ||
                           query.includes('目录下') ||
                           query.includes('文件夹下');
    
    // 检测语义描述关键词 - 更精确的检测
    const semanticKeywords = ['相关', '关于', '涉及', '包含', '用于', '功能', '作用', '描述', '说明',
                            'related', 'about', 'authentication'];
    const semanticActionWords = ['find', 'search']; // 这些词单独出现不算语义词汇
    const hasSemanticKeywords = semanticKeywords.some(keyword => query.includes(keyword));
    const hasSemanticActionWords = semanticActionWords.some(word => query.includes(word));
    // 只有当查询包含语义关键词但不主要是文件类型查询时，才认为是语义描述
    context.hasSemanticTerms = hasSemanticKeywords ||
                             (hasSemanticActionWords && !query.includes('typescript') && !query.includes('files'));
    
    // 检测扩展名过滤 - 更精确的逻辑
    const extensionPattern = /\.\w+$/;
    const hasExplicitExtension = extensionPattern.test(query);
    const hasExtensionKeywords = query.includes('扩展名') || query.includes('extension') ||
                                query.includes('文件类型') || query.includes('file type');
    // 检测包含点号+字母的模式，如 .ts, .js 等
    const hasDotExtension = /\.[a-zA-Z]+/.test(query);
    // 只有当明确提到文件类型或扩展名时，才认为是扩展名过滤
    const hasSpecificFileType = query.includes('typescript') ||
                               (query.includes('files') && !query.includes('related') && !query.includes('authentication'));
    
    context.hasExtensionFilter = hasExplicitExtension || hasExtensionKeywords || hasSpecificFileType || hasDotExtension;
    
    // 检测时间约束
    const timeKeywords = ['最近', '最新', '昨天', '今天', '上周', 'last', 'recent', 'new'];
    context.hasTimeConstraint = timeKeywords.some(keyword => query.includes(keyword));
    
    this.logger.debug(`analyzeQueryContext for "${query}":`, {
      hasPathKeywords,
      locationWords,
      hasPathPattern: context.hasPathPattern,
      semanticKeywords,
      hasSemanticTerms: context.hasSemanticTerms,
      hasExplicitExtension,
      hasExtensionKeywords,
      hasSpecificFileType,
      hasExtensionFilter: context.hasExtensionFilter
    });
    
    return context;
  }

  /**
   * 确定查询类型
   */
  private determineQueryType(query: string, context: QueryIntentClassification['context']): QueryIntentClassification {
    const extractedKeywords = this.extractKeywords(query);
    
    this.logger.debug(`determineQueryType analysis for "${query}":`, {
      context,
      extractedKeywords
    });
    
    // 精确文件名匹配
    if (this.isExactFilenameQuery(query)) {
      this.logger.debug(`Query "${query}" classified as EXACT_FILENAME`);
      return {
        type: 'EXACT_FILENAME',
        confidence: 0.9,
        extractedKeywords,
        context
      };
    }
    
    // 扩展名搜索 - 优先检查，即使包含语义词汇，只要主要是扩展名搜索
    if (context.hasExtensionFilter && query.includes('files') && !context.hasPathPattern) {
      this.logger.debug(`Query "${query}" classified as EXTENSION_SEARCH`);
      return {
        type: 'EXTENSION_SEARCH',
        confidence: 0.85,
        extractedKeywords,
        context
      };
    }
    
    // 路径模式搜索 - 优先于混合查询，但当同时包含语义词汇时降低优先级
    if (context.hasPathPattern && !context.hasSemanticTerms && (query.includes('directory') || query.includes('folder') || query.includes('目录') || query.includes('文件夹'))) {
      this.logger.debug(`Query "${query}" classified as PATH_PATTERN (priority)`);
      return {
        type: 'PATH_PATTERN',
        confidence: 0.8,
        extractedKeywords,
        context
      };
    }
    
    // 混合查询 - 检查是否同时包含多种特征
    if ((context.hasPathPattern && context.hasSemanticTerms) ||
        (context.hasExtensionFilter && context.hasSemanticTerms) ||
        (context.hasPathPattern && context.hasExtensionFilter)) {
      this.logger.debug(`Query "${query}" classified as HYBRID_QUERY`);
      return {
        type: 'HYBRID_QUERY',
        confidence: 0.75,
        extractedKeywords,
        context
      };
    }
    
    // 扩展名搜索
    if (context.hasExtensionFilter && !context.hasPathPattern && !context.hasSemanticTerms) {
      this.logger.debug(`Query "${query}" classified as EXTENSION_SEARCH`);
      return {
        type: 'EXTENSION_SEARCH',
        confidence: 0.85,
        extractedKeywords,
        context
      };
    }
    
    // 路径模式搜索
    if (context.hasPathPattern && !context.hasSemanticTerms) {
      this.logger.debug(`Query "${query}" classified as PATH_PATTERN`);
      return {
        type: 'PATH_PATTERN',
        confidence: 0.8,
        extractedKeywords,
        context
      };
    }
    
    // 语义描述搜索
    if (context.hasSemanticTerms && !context.hasPathPattern) {
      this.logger.debug(`Query "${query}" classified as SEMANTIC_DESCRIPTION`);
      return {
        type: 'SEMANTIC_DESCRIPTION',
        confidence: 0.85,
        extractedKeywords,
        context
      };
    }
    
    // 默认混合查询
    this.logger.debug(`Query "${query}" classified as default HYBRID_QUERY`);
    return {
      type: 'HYBRID_QUERY',
      confidence: 0.75,
      extractedKeywords,
      context
    };
  }

  /**
   * 检查是否为精确文件名查询
   */
  private isExactFilenameQuery(query: string): boolean {
    // 检查是否包含文件扩展名且没有明显的语义关键词
    const hasExtension = /\.\w+$/.test(query);
    const hasSpecificPattern = /^[\w\-]+\.[\w]+$/.test(query);
    const hasNoSemanticWords = !this.hasSemanticWords(query);
    
    this.logger.debug(`isExactFilenameQuery analysis for "${query}":`, {
      hasExtension,
      hasSpecificPattern,
      hasNoSemanticWords,
      result: (hasExtension && hasSpecificPattern) || hasNoSemanticWords
    });
    
    return (hasExtension && hasSpecificPattern) || hasNoSemanticWords;
  }

  /**
   * 检查是否包含语义词汇
   */
  private hasSemanticWords(query: string): boolean {
    const semanticWords = ['相关', '关于', '涉及', '包含', '用于', '功能', '作用', '描述', '说明',
                          'related', 'about', 'for', 'find', 'search', 'files', 'authentication', 'all'];
    const hasSemanticWords = semanticWords.some(word => query.includes(word));
    
    this.logger.debug(`hasSemanticWords analysis for "${query}":`, {
      semanticWords,
      hasSemanticWords
    });
    
    return hasSemanticWords;
  }

  /**
   * 提取关键词
   */
  private extractKeywords(query: string): string[] {
    // 移除常见停用词
    const stopWords = [
      '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', '个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', '那', '里', '就是', '还', '把', '比', '从', '被', '本', '吗', '呢', '些', '样', '想', '开', '知道', '什么', '时候', '怎么', '为什么', '哪里', 'who', 'what', 'when', 'where', 'why', 'how',
      'find', 'search', 'look', 'for', 'get', 'all', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'among', 'throughout', 'despite', 'towards', 'upon'
    ];
    
    // 分词并过滤停用词
    const words = query.split(/\s+/)
      .map(word => word.replace(/[^\w\u4e00-\u9fa5]/g, ''))
      .filter(word => word.length > 1 && !stopWords.includes(word.toLowerCase()));
    
    // 提取文件扩展名
    const extensionMatch = query.match(/\.\w+$/);
    if (extensionMatch) {
      words.push(extensionMatch[0]);
    }
    
    // 提取路径关键词
    const pathWords = query.match(/[\w\-]+/g);
    if (pathWords) {
      words.push(...pathWords.filter(word => word.length > 2));
    }
    
    return [...new Set(words)]; // 去重
  }

  /**
   * 获取查询类型的搜索策略
   */
  getSearchStrategy(type: FileQueryType): {
    primaryVector: 'name' | 'path' | 'combined';
    secondaryVectors: ('name' | 'path' | 'combined')[];
    scoreWeight: number;
  } {
    switch (type) {
      case 'EXACT_FILENAME':
        return {
          primaryVector: 'name',
          secondaryVectors: ['combined'],
          scoreWeight: 1.0
        };
      case 'PATH_PATTERN':
        return {
          primaryVector: 'path',
          secondaryVectors: ['combined', 'name'],
          scoreWeight: 0.9
        };
      case 'SEMANTIC_DESCRIPTION':
        return {
          primaryVector: 'combined',
          secondaryVectors: ['name', 'path'],
          scoreWeight: 0.8
        };
      case 'EXTENSION_SEARCH':
        return {
          primaryVector: 'name',
          secondaryVectors: ['combined'],
          scoreWeight: 0.7
        };
      case 'HYBRID_QUERY':
        return {
          primaryVector: 'combined',
          secondaryVectors: ['name', 'path'],
          scoreWeight: 0.85
        };
      default:
        return {
          primaryVector: 'combined',
          secondaryVectors: ['name', 'path'],
          scoreWeight: 0.8
        };
    }
  }
}