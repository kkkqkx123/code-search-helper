import { FileSearchService } from './FileSearchService';
import { FileQueryType, FileSearchOptions, FileSearchRequest, FileSearchResponse, QueryIntentClassification } from './types';
import { FileQueryIntentClassifier } from './FileQueryIntentClassifier';
import { LoggerService } from '../../utils/LoggerService';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';

/**
 * 文件查询处理器
 * 处理不同类型的文件搜索查询
 */
export class FileQueryProcessor {
  private intentClassifier: FileQueryIntentClassifier;

  constructor(
    private fileSearchService: FileSearchService,
    private embedderFactory: EmbedderFactory,
    private logger: LoggerService
  ) {
    this.intentClassifier = new FileQueryIntentClassifier(logger);
  }

  /**
   * 处理文件搜索查询
   */
  async processQuery(request: FileSearchRequest): Promise<FileSearchResponse> {
    const startTime = Date.now();
    
    try {
      this.logger.info(`处理文件搜索查询: ${request.query}`);
      
      // 1. 分类查询意图
      const classification = await this.intentClassifier.classifyQuery(request.query);
      
      // 2. 根据意图类型执行搜索
      const results = await this.executeSearchByIntent(request, classification);
      
      // 3. 后处理和排序
      const processedResults = this.postProcessResults(results, request, classification);
      
      const processingTime = Date.now() - startTime;
      
      this.logger.info(`文件搜索查询处理完成，找到 ${processedResults.length} 个结果，耗时 ${processingTime}ms`);
      
      return {
        results: processedResults,
        total: processedResults.length,
        queryType: classification.type,
        processingTime,
        hasMore: processedResults.length >= (request.options?.maxResults || 100)
      };
    } catch (error) {
      this.logger.error(`处理文件搜索查询失败: ${request.query}`, error);
      throw error;
    }
  }

  /**
   * 根据意图类型执行搜索
   */
  private async executeSearchByIntent(
    request: FileSearchRequest, 
    classification: QueryIntentClassification
  ): Promise<any[]> {
    const { type, extractedKeywords } = classification;
    const searchStrategy = this.intentClassifier.getSearchStrategy(type);
    
    try {
      switch (type) {
        case 'EXACT_FILENAME':
          return await this.searchExactFilename(request, extractedKeywords, searchStrategy);
        case 'SEMANTIC_DESCRIPTION':
          return await this.searchSemanticDescription(request, extractedKeywords, searchStrategy);
        case 'PATH_PATTERN':
          return await this.searchPathPattern(request, extractedKeywords, searchStrategy);
        case 'EXTENSION_SEARCH':
          return await this.searchByExtension(request, extractedKeywords, searchStrategy);
        case 'HYBRID_QUERY':
          return await this.searchHybrid(request, extractedKeywords, searchStrategy);
        default:
          return await this.searchSemanticDescription(request, extractedKeywords, searchStrategy);
      }
    } catch (error) {
      this.logger.error(`执行搜索失败 (类型: ${type}): ${request.query}`, error);
      // 回退到语义搜索
      return await this.searchSemanticDescription(request, extractedKeywords, searchStrategy);
    }
  }

  /**
   * 精确文件名搜索
   */
  private async searchExactFilename(
    request: FileSearchRequest,
    keywords: string[],
    strategy: any
  ): Promise<any[]> {
    this.logger.debug(`执行精确文件名搜索: ${request.query}`);
    
    // 提取可能的文件名
    const possibleFilenames = keywords.filter(keyword => keyword.includes('.'));
    
    if (possibleFilenames.length === 0) {
      // 如果没有明确的文件名，使用关键词生成向量进行搜索
      const queryVector = await (await this.embedderFactory.getEmbedder()).embed({ text: request.query });
      const vector = Array.isArray(queryVector) ? queryVector[0].vector : queryVector.vector;
      return await this.fileSearchService.vectorSearch(vector, strategy.primaryVector, request.options);
    }
    
    // 使用可能的文件名进行搜索
    const results: any[] = [];
    for (const filename of possibleFilenames) {
      const filenameVector = await (await this.embedderFactory.getEmbedder()).embed({ text: filename });
      const filenameVectorArray = Array.isArray(filenameVector) ? filenameVector[0].vector : filenameVector.vector;
      const filenameResults = await this.fileSearchService.vectorSearch(filenameVectorArray, 'name', request.options);
      results.push(...filenameResults);
    }
    
    return this.deduplicateResults(results);
  }

  /**
   * 语义描述搜索
   */
  private async searchSemanticDescription(
    request: FileSearchRequest,
    keywords: string[],
    strategy: any
  ): Promise<any[]> {
    this.logger.debug(`执行语义描述搜索: ${request.query}`);
    
    // 生成查询向量
    const queryVector = await (await this.embedderFactory.getEmbedder()).embed({ text: request.query });
    const vector = Array.isArray(queryVector) ? queryVector[0].vector : queryVector.vector;
    
    // 执行多向量搜索
    const primaryResults = await this.fileSearchService.vectorSearch(vector, strategy.primaryVector, request.options);
    const secondaryResults = await this.fileSearchService.vectorSearch(vector, strategy.secondaryVectors[0], request.options);
    
    // 合并结果
    const allResults = [...primaryResults, ...secondaryResults];
    return this.deduplicateResults(allResults);
  }

  /**
   * 路径模式搜索
   */
  private async searchPathPattern(
    request: FileSearchRequest,
    keywords: string[],
    strategy: any
  ): Promise<any[]> {
    this.logger.debug(`执行路径模式搜索: ${request.query}`);
    
    // 提取路径关键词
    const pathKeywords = keywords.filter(keyword => 
      !keyword.startsWith('.') && // 排除扩展名
      keyword.length > 2 && // 排除过短的词
      !['文件', 'file', '目录', 'directory', '路径', 'path'].includes(keyword)
    );
    
    if (pathKeywords.length === 0) {
      // 如果没有明确的路径关键词，使用完整查询
      const queryVector = await (await this.embedderFactory.getEmbedder()).embed({ text: request.query });
      const vector = Array.isArray(queryVector) ? queryVector[0].vector : queryVector.vector;
      return await this.fileSearchService.vectorSearch(vector, strategy.primaryVector, request.options);
    }
    
    // 使用路径关键词进行搜索
    const results: any[] = [];
    for (const pathKeyword of pathKeywords) {
      const pathVector = await (await this.embedderFactory.getEmbedder()).embed({ text: pathKeyword });
      const pathVectorArray = Array.isArray(pathVector) ? pathVector[0].vector : pathVector.vector;
      const pathResults = await this.fileSearchService.vectorSearch(pathVectorArray, 'path', request.options);
      results.push(...pathResults);
    }
    
    return this.deduplicateResults(results);
  }

  /**
   * 扩展名搜索
   */
  private async searchByExtension(
    request: FileSearchRequest,
    keywords: string[],
    strategy: any
  ): Promise<any[]> {
    this.logger.debug(`执行扩展名搜索: ${request.query}`);
    
    // 提取扩展名
    const extensions = keywords.filter(keyword => keyword.startsWith('.') && keyword.length > 1);
    
    if (extensions.length === 0) {
      // 如果没有明确的扩展名，使用完整查询
      const queryVector = await (await this.embedderFactory.getEmbedder()).embed({ text: request.query });
      const vector = Array.isArray(queryVector) ? queryVector[0].vector : queryVector.vector;
      return await this.fileSearchService.vectorSearch(vector, strategy.primaryVector, request.options);
    }
    
    // 使用扩展名进行搜索
    const results: any[] = [];
    for (const extension of extensions) {
      const extVector = await (await this.embedderFactory.getEmbedder()).embed({ text: extension });
      const extVectorArray = Array.isArray(extVector) ? extVector[0].vector : extVector.vector;
      const extResults = await this.fileSearchService.vectorSearch(extVectorArray, 'name', {
        ...request.options,
        filter: {
          must: [
            {
              key: 'extension',
              match: {
                value: extension
              }
            }
          ]
        }
      });
      results.push(...extResults);
    }
    
    return this.deduplicateResults(results);
  }

  /**
   * 混合搜索
   */
  private async searchHybrid(
    request: FileSearchRequest,
    keywords: string[],
    strategy: any
  ): Promise<any[]> {
    this.logger.debug(`执行混合搜索: ${request.query}`);
    
    // 生成查询向量
    const queryVector = await (await this.embedderFactory.getEmbedder()).embed({ text: request.query });
    const vector = Array.isArray(queryVector) ? queryVector[0].vector : queryVector.vector;
    
    // 执行多向量搜索
    const primaryResults = await this.fileSearchService.vectorSearch(vector, strategy.primaryVector, request.options);
    const secondaryResults = await this.fileSearchService.vectorSearch(vector, strategy.secondaryVectors[0], request.options);
    const tertiaryResults = await this.fileSearchService.vectorSearch(vector, strategy.secondaryVectors[1], request.options);
    
    // 合并结果并应用权重
    const allResults = [
      ...primaryResults.map(result => ({ ...result, relevanceScore: result.relevanceScore * strategy.scoreWeight })),
      ...secondaryResults.map(result => ({ ...result, relevanceScore: result.relevanceScore * strategy.scoreWeight * 0.8 })),
      ...tertiaryResults.map(result => ({ ...result, relevanceScore: result.relevanceScore * strategy.scoreWeight * 0.6 }))
    ];
    
    return this.deduplicateResults(allResults);
  }

  /**
   * 后处理搜索结果
   */
  private postProcessResults(results: any[], request: FileSearchRequest, classification: QueryIntentClassification): any[] {
    // 1. 去重
    const uniqueResults = this.deduplicateResults(results);
    
    // 2. 应用过滤器
    const filteredResults = this.applyFilters(uniqueResults, request.options);
    
    // 3. 排序
    const sortedResults = this.sortResults(filteredResults, classification);
    
    // 4. 限制结果数量
    const maxResults = request.options?.maxResults || 100;
    return sortedResults.slice(0, maxResults);
  }

  /**
   * 去重结果
   */
  private deduplicateResults(results: any[]): any[] {
    const seen = new Set<string>();
    return results.filter(result => {
      if (seen.has(result.filePath)) {
        return false;
      }
      seen.add(result.filePath);
      return true;
    });
  }

  /**
   * 应用过滤器
   */
  private applyFilters(results: any[], options?: FileSearchOptions): any[] {
    if (!options) return results;
    
    return results.filter(result => {
      // 文件类型过滤
      if (options.fileTypes && options.fileTypes.length > 0) {
        const hasMatchingType = options.fileTypes.some(type => 
          result.extension?.toLowerCase() === type.toLowerCase() ||
          result.fileName.toLowerCase().endsWith(type.toLowerCase())
        );
        if (!hasMatchingType) return false;
      }
      
      // 路径模式过滤
      if (options.pathPattern) {
        const pathMatch = result.filePath.toLowerCase().includes(options.pathPattern.toLowerCase()) ||
                         result.directory.toLowerCase().includes(options.pathPattern.toLowerCase());
        if (!pathMatch) return false;
      }
      
      // 最小分数过滤
      if (options.minScore && result.relevanceScore < options.minScore) {
        return false;
      }
      
      // 目录过滤
      if (options.includeDirectories === false && result.fileType === 'directory') {
        return false;
      }
      
      return true;
    });
  }

  /**
   * 排序结果
   */
  private sortResults(results: any[], classification: QueryIntentClassification): any[] {
    return results.sort((a, b) => {
      // 主要按分数排序
      const scoreDiff = b.relevanceScore - a.relevanceScore;
      if (Math.abs(scoreDiff) > 0.01) {
        return scoreDiff;
      }
      
      // 分数相近时，按修改时间排序（最新的在前）
      if (a.lastModified && b.lastModified) {
        return new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime();
      }
      
      // 最后按文件路径排序
      return a.filePath.localeCompare(b.filePath);
    });
  }
}