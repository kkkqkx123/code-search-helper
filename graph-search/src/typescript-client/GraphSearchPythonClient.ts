/**
 * GraphSearchService Python算法服务TypeScript客户端
 */

import { Injectable, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';

interface FuzzyMatchRequest {
  query: string;
  threshold?: number;
  maxResults?: number;
}

interface FuzzyMatchResponse {
  matches: Array<{
    identifier: string;
    similarity: number;
    distance: number;
  }>;
  processingTime: number;
}

interface GraphSearchRequest {
  query: string;
  optimizationLevel?: 'low' | 'medium' | 'high';
  timeout?: number;
}

interface GraphSearchResponse {
  results: any[];
  optimizedPlan?: any;
  performanceMetrics: {
    queryTime: number;
    optimizationTime: number;
    totalNodes: number;
  };
}

interface IndexBuildRequest {
  graphData: any;
  indexType: 'hierarchical' | 'compressed' | 'standard';
  incremental?: boolean;
}

interface IndexBuildResponse {
  status: 'success' | 'partial' | 'failed';
  indexSize: number;
  buildTime: number;
  compressionRatio?: number;
}

@Injectable()
export class GraphSearchPythonClient {
  private readonly baseUrl: string;
  private readonly timeout: number;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService
  ) {
    this.baseUrl = this.configService.get<string>('PYTHON_ALGORITHM_SERVICE_URL', 'http://localhost:8000');
    this.timeout = this.configService.get<number>('PYTHON_SERVICE_TIMEOUT', 30000);
  }

  /**
   * 模糊匹配搜索
   */
  async fuzzySearch(request: FuzzyMatchRequest): Promise<FuzzyMatchResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<FuzzyMatchResponse>(
          `${this.baseUrl}/api/v1/fuzzy-match/search`,
          request,
          { timeout: this.timeout }
        )
      );
      
      return response.data;
    } catch (error) {
      throw this.handleError(error, '模糊匹配搜索');
    }
  }

  /**
   * 图搜索查询
   */
  async graphSearch(request: GraphSearchRequest): Promise<GraphSearchResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<GraphSearchResponse>(
          `${this.baseUrl}/api/v1/graph-search/query`,
          request,
          { timeout: this.timeout }
        )
      );
      
      return response.data;
    } catch (error) {
      throw this.handleError(error, '图搜索查询');
    }
  }

  /**
   * 构建索引
   */
  async buildIndex(request: IndexBuildRequest): Promise<IndexBuildResponse> {
    try {
      const response = await firstValueFrom(
        this.httpService.post<IndexBuildResponse>(
          `${this.baseUrl}/api/v1/index/build`,
          request,
          { timeout: this.timeout }
        )
      );
      
      return response.data;
    } catch (error) {
      throw this.handleError(error, '索引构建');
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ status: string; services: any }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{ status: string; services: any }>(
          `${this.baseUrl}/health`,
          { timeout: 5000 }
        )
      );
      
      return response.data;
    } catch (error) {
      throw this.handleError(error, '健康检查');
    }
  }

  /**
   * 错误处理
   */
  private handleError(error: any, operation: string): Error {
    if (error.response) {
      // Python服务返回的错误
      const status = error.response.status;
      const message = error.response.data?.detail || error.response.data?.error;
      
      throw new Error(`${operation}失败 (${status}): ${message}`);
    } else if (error.request) {
      // 网络连接错误
      throw new Error(`${operation}失败: 无法连接到Python算法服务`);
    } else {
      // 其他错误
      throw new Error(`${operation}失败: ${error.message}`);
    }
  }

  /**
   * 批量模糊匹配（优化性能）
   */
  async batchFuzzySearch(queries: string[], threshold: number = 0.8): Promise<FuzzyMatchResponse[]> {
    const batchSize = 10; // 控制并发数
    const results: FuzzyMatchResponse[] = [];
    
    for (let i = 0; i < queries.length; i += batchSize) {
      const batch = queries.slice(i, i + batchSize);
      const batchPromises = batch.map(query => 
        this.fuzzySearch({ query, threshold })
      );
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // 添加小延迟避免过载
      if (i + batchSize < queries.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    return results;
  }

  /**
   * 获取服务状态信息
   */
  async getServiceInfo(): Promise<{
    service: string;
    version: string;
    status: string;
    baseUrl: string;
  }> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{
          service: string;
          version: string;
          status: string;
        }>(`${this.baseUrl}/`, { timeout: 5000 })
      );
      
      return {
        ...response.data,
        baseUrl: this.baseUrl
      };
    } catch (error) {
      throw this.handleError(error, '获取服务信息');
    }
  }
}