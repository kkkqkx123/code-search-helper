import { FileQueryType, QueryIntentClassification } from './types';
import { LoggerService } from '../../utils/LoggerService';

/**
 * 文件查询意图分类器
 * 分析用户查询，确定搜索意图类型
 */
export class FileQueryIntentClassifier {
  constructor(private logger: LoggerService) {}

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
    
    // 检测路径模式关键词
    const pathKeywords = ['目录', '文件夹', '路径', '下', '在', '位于', 'path', 'directory', 'folder'];
    context.hasPathPattern = pathKeywords.some(keyword => query.includes(keyword));
    
    // 检测语义描述关键词
    const semanticKeywords = ['相关', '关于', '涉及', '包含', '用于', '功能', '作用', 'related', 'about', 'for'];
    context.hasSemanticTerms = semanticKeywords.some(keyword => query.includes(keyword));
    
    // 检测扩展名过滤
    const extensionPattern = /\.\w+$/;
    context.hasExtensionFilter = extensionPattern.test(query) || 
      query.includes('扩展名') || query.includes('extension') ||
      query.includes('.ts') || query.includes('.js') || query.includes('.py') ||
      query.includes('文件类型') || query.includes('file type');
    
    // 检测时间约束
    const timeKeywords = ['最近', '最新', '昨天', '今天', '上周', 'last', 'recent', 'new'];
    context.hasTimeConstraint = timeKeywords.some(keyword => query.includes(keyword));
    
    return context;
  }

  /**
   * 确定查询类型
   */
  private determineQueryType(query: string, context: QueryIntentClassification['context']): QueryIntentClassification {
    const extractedKeywords = this.extractKeywords(query);
    
    // 精确文件名匹配
    if (this.isExactFilenameQuery(query)) {
      return {
        type: 'EXACT_FILENAME',
        confidence: 0.9,
        extractedKeywords,
        context
      };
    }
    
    // 扩展名搜索
    if (context.hasExtensionFilter && !context.hasPathPattern && !context.hasSemanticTerms) {
      return {
        type: 'EXTENSION_SEARCH',
        confidence: 0.85,
        extractedKeywords,
        context
      };
    }
    
    // 路径模式搜索
    if (context.hasPathPattern && !context.hasSemanticTerms) {
      return {
        type: 'PATH_PATTERN',
        confidence: 0.8,
        extractedKeywords,
        context
      };
    }
    
    // 语义描述搜索
    if (context.hasSemanticTerms && !context.hasPathPattern) {
      return {
        type: 'SEMANTIC_DESCRIPTION',
        confidence: 0.85,
        extractedKeywords,
        context
      };
    }
    
    // 混合查询
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
    
    return (hasExtension && hasSpecificPattern) || hasNoSemanticWords;
  }

  /**
   * 检查是否包含语义词汇
   */
  private hasSemanticWords(query: string): boolean {
    const semanticWords = ['相关', '关于', '涉及', '包含', '用于', '功能', '作用', '描述', '说明'];
    return semanticWords.some(word => query.includes(word));
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