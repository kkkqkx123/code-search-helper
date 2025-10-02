import { Container } from 'inversify';
import { TYPES } from '../../types';
import { EmbedderFactory } from '../../embedders/EmbedderFactory';
import { EmbeddingCacheService } from '../../embedders/EmbeddingCacheService';

export class EmbedderServiceRegistrar {
  static register(container: Container): void {
    // 嵌入器服务（依赖于前面的所有服务）
    container.bind<EmbedderFactory>(TYPES.EmbedderFactory).to(EmbedderFactory).inSingletonScope();
    container.bind<EmbeddingCacheService>(TYPES.EmbeddingCacheService).to(EmbeddingCacheService).inSingletonScope();
  }
}