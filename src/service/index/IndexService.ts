/**
 * IndexService - 向量索引服务的别名
 * 为了保持向后兼容性，将 VectorIndexService 导出为 IndexService
 */

import { VectorIndexService } from './VectorIndexService';
import { IndexSyncOptions } from './IIndexService';
import { BatchProcessingResult } from '../parser/core/types';

// 导出 VectorIndexService 作为 IndexService
export { VectorIndexService as IndexService };

// 导出相关类型
export { IndexSyncOptions, BatchProcessingResult };

// 导出 VectorIndexService 的相关类型
export { VectorIndexOptions, VectorIndexResult } from './VectorIndexService';