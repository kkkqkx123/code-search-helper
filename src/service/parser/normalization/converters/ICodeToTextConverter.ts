/**
 * 代码转文本转换器接口
 * 负责将规范化的实体和关系转换为自然语言文本
 */

import { CodeToTextConfig, CodeToTextResult } from '../../../vector/types/VectorTypes';

/**
 * 代码到文本的转换器接口
 */
export interface ICodeToTextConverter {
  /**
   * 将实体查询结果转换为自然语言文本
   */
  convertEntity(entity: any, config?: CodeToTextConfig): CodeToTextResult;

  /**
   * 将关系查询结果转换为自然语言文本
   */
  convertRelationship(relationship: any, config?: CodeToTextConfig): CodeToTextResult;

  /**
   * 批量转换
   */
  convertBatch(items: any[], config?: CodeToTextConfig): CodeToTextResult[];

  /**
   * 获取支持的转换规则
   */
  getSupportedRules(): string[];
}
