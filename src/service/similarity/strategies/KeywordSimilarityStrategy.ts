import { injectable } from 'inversify';
import { BaseSimilarityStrategy } from './BaseSimilarityStrategy';
import { SimilarityOptions, SimilarityStrategyType } from '../types/SimilarityTypes';

/**
 * 关键词相似度策略
 * 基于关键词重叠计算相似度（Jaccard相似度）
 */
@injectable()
export class KeywordSimilarityStrategy extends BaseSimilarityStrategy {
  readonly name = 'Keyword Similarity';
  readonly type = 'keyword' as SimilarityStrategyType;

  async calculate(content1: string, content2: string, options?: SimilarityOptions): Promise<number> {
    // 验证输入
    this.validateInput(content1, content2, options);

    // 快速检查完全相同
    if (await this.isIdentical(content1, content2)) {
      return 1.0;
    }

    // 提取关键词
    const keywords1 = this.extractKeywords(content1, options);
    const keywords2 = this.extractKeywords(content2, options);

    // 如果任一内容没有关键词，返回0
    if (keywords1.length === 0 || keywords2.length === 0) {
      return 0;
    }

    // 计算Jaccard相似度
    const intersection = keywords1.filter(keyword => keywords2.includes(keyword));
    const union = [...new Set([...keywords1, ...keywords2])];
    
    const similarity = intersection.length / union.length;
    return this.normalizeScore(similarity);
  }

  /**
   * 提取关键词
   */
  private extractKeywords(content: string, options?: SimilarityOptions): string[] {
    // 预处理内容
    const normalized = content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // 替换非单词字符为空格
      .replace(/\s+/g, ' ') // 标准化空白字符
      .trim();

    // 分词
    const words = normalized.split(/\s+/);

    // 过滤和清理关键词
    const keywords = words
      .filter(word => word.length >= this.getMinKeywordLength(options)) // 过滤短词
      .filter(word => !this.isStopWord(word)) // 过滤停用词
      .filter(word => !this.isNumeric(word)) // 过滤纯数字
      .filter(word => this.isValidKeyword(word, options)); // 自定义验证

    // 去重
    return [...new Set(keywords)];
  }

  /**
   * 获取最小关键词长度
   */
  private getMinKeywordLength(options?: SimilarityOptions): number {
    // 根据内容类型调整最小长度
    switch (options?.contentType) {
      case 'code':
        return 2; // 代码中可能有短标识符
      case 'document':
        return 3; // 文档中通常使用较长的词
      default:
        return 2;
    }
  }

  /**
   * 检查是否为停用词
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      // 英文停用词
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'among', 'is', 'are',
      'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
      'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
      'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
      'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where',
      'why', 'how', 'not', 'no', 'yes', 'all', 'any', 'both', 'each',
      'few', 'more', 'most', 'other', 'some', 'such', 'only', 'own',
      'same', 'so', 'than', 'too', 'very', 'just',
      
      // 代码相关停用词
      'var', 'let', 'const', 'function', 'return', 'if', 'else', 'for',
      'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch',
      'finally', 'throw', 'new', 'class', 'extends', 'import', 'export',
      'default', 'async', 'await', 'public', 'private', 'protected',
      'static', 'void', 'int', 'string', 'bool', 'true', 'false', 'null',
      'undefined'
    ]);
    
    return stopWords.has(word);
  }

  /**
   * 检查是否为纯数字
   */
  private isNumeric(word: string): boolean {
    return /^\d+$/.test(word);
  }

  /**
   * 自定义关键词验证
   */
  private isValidKeyword(word: string, options?: SimilarityOptions): boolean {
    // 根据内容类型进行特定验证
    switch (options?.contentType) {
      case 'code':
        return this.isValidCodeKeyword(word, options?.language);
      case 'document':
        return this.isValidDocumentKeyword(word);
      default:
        return true;
    }
  }

  /**
   * 验证代码关键词
   */
  private isValidCodeKeyword(word: string, language?: string): boolean {
    // 对于代码，允许驼峰命名和下划线命名
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(word)) {
      return true;
    }
    
    // 允许特定的编程语言模式
    switch (language) {
      case 'javascript':
      case 'typescript':
        // 允许 $ 字符
        return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(word);
      case 'python':
        // Python命名规则
        return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(word);
      default:
        return true;
    }
  }

  /**
   * 验证文档关键词
   */
  private isValidDocumentKeyword(word: string): boolean {
    // 对于文档，确保单词有一定的语义价值
    return word.length >= 3 && !/^[a-z]{1,2}$/.test(word);
  }

  /**
   * 计算TF-IDF权重（可选的高级功能）
   */
  private calculateTFIDFWeight(word: string, document: string, corpus: string[]): number {
    // 简化的TF-IDF实现
    const tf = this.calculateTermFrequency(word, document);
    const idf = this.calculateInverseDocumentFrequency(word, corpus);
    return tf * idf;
  }

  /**
   * 计算词频
   */
  private calculateTermFrequency(word: string, document: string): number {
    const words = this.extractKeywords(document);
    const wordCount = words.filter(w => w === word).length;
    return wordCount / words.length;
  }

  /**
   * 计算逆文档频率
   */
  private calculateInverseDocumentFrequency(word: string, corpus: string[]): number {
    const documentCount = corpus.length;
    const documentsWithWord = corpus.filter(doc => 
      this.extractKeywords(doc).includes(word)
    ).length;
    
    return Math.log(documentCount / (documentsWithWord + 1));
  }

  /**
   * 获取默认阈值
   */
  getDefaultThreshold(): number {
    return 0.6; // 关键词相似度使用较低的阈值
  }

  /**
   * 检查是否支持指定的内容类型
   */
  isSupported(contentType: string, language?: string): boolean {
    // 关键词相似度适用于所有文本类型
    return true;
  }
}