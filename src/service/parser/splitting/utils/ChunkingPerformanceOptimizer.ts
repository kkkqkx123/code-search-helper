import { BoundaryScore } from './SemanticBoundaryAnalyzer';

export interface AnalysisResult {
 boundaryScore: number;
  properties: any;
}

export interface PreAnalysisResult {
  boundaryCandidates: Array<{
    line: number;
    score: number;
    properties: any;
  }>;
  estimatedComplexity: number;
}

export interface PerformanceMetrics {
  processingTime: number;
 linesProcessed: number;
  chunksGenerated: number;
  cacheHitRate: number;
  memoryUsage: NodeJS.MemoryUsage;
}

export class ChunkingPerformanceOptimizer {
  private analysisCache: Map<string, AnalysisResult> = new Map();
  private boundaryCache: Map<string, BoundaryScore[]> = new Map();
  private performanceMetrics: PerformanceMetrics | null = null;
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  /**
   * 缓存边界分析结果以提高性能
   */
  getCachedBoundaryAnalysis(fileHash: string, lineIndex: number): BoundaryScore | null {
    const cacheKey = `${fileHash}-${lineIndex}`;
    const cached = this.boundaryCache.get(cacheKey);
    if (cached) {
      this.cacheHits++;
      return cached[lineIndex] || null;
    }
    this.cacheMisses++;
    return null;
  }

  /**
   * 设置边界分析结果到缓存
   */
  setBoundaryAnalysisCache(fileHash: string, lineIndex: number, score: BoundaryScore): void {
    const cacheKey = `${fileHash}-${lineIndex}`;
    let scores = this.boundaryCache.get(cacheKey) || [];
    scores[lineIndex] = score;
    this.boundaryCache.set(cacheKey, scores);
 }

  /**
   * 批量预分析以提高大文件处理速度
   */
  async preAnalyzeFile(content: string, language: string): Promise<PreAnalysisResult> {
    const lines = content.split('\n');
    const boundaryCandidates: Array<{
      line: number;
      score: number;
      properties: any;
    }> = [];
    
    // 计算文件哈希用于缓存
    const fileHash = this.calculateFileHash(content);
    
    // 并行分析多行
    const batchSize = 100;
    for (let i = 0; i < lines.length; i += batchSize) {
      const batch = lines.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((line, index) => this.analyzeLineAsync(line, language, i + index, fileHash))
      );
      
      batchResults.forEach((result, index) => {
        boundaryCandidates.push({
          line: i + index,
          score: result.boundaryScore,
          properties: result.properties
        });
      });
    }
    
    return {
      boundaryCandidates,
      estimatedComplexity: this.calculateOverallComplexity(boundaryCandidates)
    };
  }

  private async analyzeLineAsync(line: string, language: string, lineIndex: number, fileHash: string): Promise<AnalysisResult> {
    // 检查缓存
    const cached = this.getCachedBoundaryAnalysis(fileHash, lineIndex);
    if (cached) {
      return { boundaryScore: cached.score, properties: cached.components };
    }
    
    // 模拟分析（在实际实现中，这里会调用真正的边界分析器）
    // 为了性能考虑，这里只是简单计算
    const analysisResult: AnalysisResult = {
      boundaryScore: this.estimateLineBoundaryScore(line),
      properties: this.estimateLineProperties(line)
    };
    
    // 设置缓存
    const score = {
      score: analysisResult.boundaryScore,
      components: analysisResult.properties
    };
    this.setBoundaryAnalysisCache(fileHash, lineIndex, score);
    
    return analysisResult;
  }

 private estimateLineBoundaryScore(line: string): number {
    const trimmedLine = line.trim();
    
    // 估算边界分数
    if (/^\s*}\s*$/.test(trimmedLine)) return 0.9; // 函数/类结束
    if (/^\s*;\s*$/.test(trimmedLine)) return 0.3; // 语句结束
    if (trimmedLine === '') return 0.2; // 空行
    if (/^\/\/.*$/.test(trimmedLine)) return 0.1; // 注释
    if (/^function\s+/.test(trimmedLine)) return 0.4; // 函数开始
    if (/^class\s+/.test(trimmedLine)) return 0.4; // 类开始
    if (/^import\s+/.test(trimmedLine)) return 0.3; // 导入语句
    if (/^export\s+/.test(trimmedLine)) return 0.3; // 导出语句
    
    return 0.1; // 默认低分
  }

 private estimateLineProperties(line: string): any {
    const trimmedLine = line.trim();
    
    return {
      isFunctionStart: /^function\s+/.test(trimmedLine),
      isClassStart: /^class\s+/.test(trimmedLine),
      isFunctionEnd: /^\s*}\s*$/.test(trimmedLine),
      isClassEnd: /^\s*}\s*$/.test(trimmedLine),
      isEmpty: trimmedLine === '',
      isComment: /^\/\/.*$/.test(trimmedLine) || /^\/\*.*\*\/$/.test(trimmedLine),
      isImport: /^import\s+/.test(trimmedLine),
      isExport: /^export\s+/.test(trimmedLine),
      hasClosingBrace: line.includes('}'),
      hasClosingBracket: line.includes(']'),
      hasClosingParen: line.includes(')')
    };
  }

 private calculateOverallComplexity(boundaryCandidates: Array<{
    line: number;
    score: number;
    properties: any;
  }>): number {
    if (boundaryCandidates.length === 0) return 0;
    
    // 计算整体复杂度，基于边界分数的分布和代码结构特征
    const totalScore = boundaryCandidates.reduce((sum, candidate) => sum + candidate.score, 0);
    const avgScore = totalScore / boundaryCandidates.length;
    
    // 考虑边界变化的频率（变化越多越复杂）
    let variation = 0;
    for (let i = 1; i < boundaryCandidates.length; i++) {
      variation += Math.abs(boundaryCandidates[i].score - boundaryCandidates[i-1].score);
    }
    const avgVariation = variation / (boundaryCandidates.length - 1 || 1);
    
    // 综合计算复杂度
    return (avgScore * 0.4) + (avgVariation * 0.6);
  }

  /**
   * 计算文件哈希值用于缓存键
   */
  private calculateFileHash(content: string): string {
    let hash = 0;
    const str = content;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return hash.toString();
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.analysisCache.clear();
    this.boundaryCache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * 获取缓存统计信息
   */
  getCacheStats(): { hits: number; misses: number; hitRate: number } {
    const total = this.cacheHits + this.cacheMisses;
    const hitRate = total > 0 ? this.cacheHits / total : 0;
    
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate
    };
  }

  /**
   * 记录性能指标
   */
  recordPerformanceMetrics(metrics: Omit<PerformanceMetrics, 'cacheHitRate' | 'memoryUsage'>): void {
    const cacheStats = this.getCacheStats();
    this.performanceMetrics = {
      ...metrics,
      cacheHitRate: cacheStats.hitRate,
      memoryUsage: process.memoryUsage()
    };
  }

  /**
   * 获取性能指标
   */
  getPerformanceMetrics(): PerformanceMetrics | null {
    if (!this.performanceMetrics) {
      const cacheStats = this.getCacheStats();
      return {
        processingTime: 0,
        linesProcessed: 0,
        chunksGenerated: 0,
        cacheHitRate: cacheStats.hitRate,
        memoryUsage: process.memoryUsage()
      };
    }
    return this.performanceMetrics;
  }

  /**
   * 估算处理时间
   */
 estimateProcessingTime(content: string, language: string): number {
    const lines = content.split('\n').length;
    const avgTimePerLine = 0.1; // 毫秒，基于经验估算
    
    // 根据语言和内容复杂度调整
    let complexityFactor = 1.0;
    if (language === 'typescript' || language === 'javascript') complexityFactor = 1.2;
    if (language === 'python') complexityFactor = 0.9;
    if (language === 'java') complexityFactor = 1.1;
    if (language === 'go') complexityFactor = 0.8;
    if (language === 'rust') complexityFactor = 1.3;
    
    return lines * avgTimePerLine * complexityFactor;
  }

  /**
   * 预估内存使用
   */
 estimateMemoryUsage(content: string): number {
    // 估算内存使用量（字节）
    // 基于内容大小和额外的分析数据结构开销
    const contentSize = new Blob([content]).size;
    const analysisOverhead = contentSize * 0.5; // 额外50%用于分析数据结构
    
    return contentSize + analysisOverhead;
  }
}