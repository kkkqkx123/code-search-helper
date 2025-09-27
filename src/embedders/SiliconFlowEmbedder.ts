import { Logger } from '../utils/logger';
import { ErrorHandlerService } from '../utils/ErrorHandlerService';
import { EmbeddingCacheService } from './EmbeddingCacheService';
import { BaseEmbedder, EmbeddingInput, EmbeddingResult } from './BaseEmbedder';

/**
 * SiliconFlow嵌入器实现
 * 适配基础嵌入器类，简化配置获取
 */
export class SiliconFlowEmbedder extends BaseEmbedder {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private dimensions: number;

  constructor(
    logger: Logger,
    errorHandler: ErrorHandlerService,
    cacheService: EmbeddingCacheService
  ) {
    super(logger, errorHandler);

    // 简化配置获取
    this.apiKey = process.env.SILICONFLOW_API_KEY || '';
    this.baseUrl = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1';
    this.model = process.env.SILICONFLOW_MODEL || 'BAAI/bge-m3';
    this.dimensions = parseInt(process.env.SILICONFLOW_DIMENSIONS || '1024');
  }

  async embed(
    input: EmbeddingInput | EmbeddingInput[]
  ): Promise<EmbeddingResult | EmbeddingResult[]> {
    return await this.embedWithCache(input, async inputs => {
      return await this.makeSiliconFlowRequest(inputs);
    });
  }

  getDimensions(): number {
    return this.dimensions;
  }

  getModelName(): string {
    return this.model;
  }

  async isAvailable(): Promise<boolean> {
    try {
      if (!this.apiKey) {
        this.logger.warn('SiliconFlow API key is not configured');
        return false;
      }

      const response = await fetch(`${this.baseUrl}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      return response.ok;
    } catch (error) {
      this.logger.warn('SiliconFlow availability check failed', { error });
      return false;
    }
  }

  /**
   * 发送SiliconFlow API请求
   */
  private async makeSiliconFlowRequest(inputs: EmbeddingInput[]): Promise<EmbeddingResult[]> {
    if (!this.apiKey) {
      throw new Error('SiliconFlow API key is not configured');
    }

    try {
      const response = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: inputs.map(inp => inp.text),
          model: this.model,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`SiliconFlow API request failed: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      return data.data.map((item: any) => ({
        vector: item.embedding,
        dimensions: item.embedding.length,
        model: this.model,
        processingTime: 0,
      }));
    } catch (error) {
      this.errorHandler.handleError(
        new Error(`SiliconFlow embedding request failed: ${error instanceof Error ? error.message : String(error)}`),
        { component: 'SiliconFlowEmbedder', operation: 'makeSiliconFlowRequest' }
      );
      throw error;
    }
  }

  /**
   * 获取组件名称
   */
  private getComponentName(): string {
    return 'SiliconFlowEmbedder';
  }
}