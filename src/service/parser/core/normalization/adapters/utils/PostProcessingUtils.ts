/**
 * 标准化结果后处理工具函数
 * 包含从BaseLanguageAdapter中提取的无状态工具方法
 */

import { StandardizedQueryResult } from '../../types';
import { MetadataBuilder } from '../../utils/MetadataBuilder';
import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';

/**
 * 智能去重
 */
export function deduplicateResults(results: StandardizedQueryResult[]): StandardizedQueryResult[] {
  const seen = new Map<string, StandardizedQueryResult>();

  for (const result of results) {
    const key = generateUniqueKey(result);

    if (!seen.has(key)) {
      seen.set(key, result);
    } else {
      mergeMetadata(seen.get(key)!, result);
    }
  }

  return Array.from(seen.values());
}

/**
 * 生成唯一键
 */
export function generateUniqueKey(result: StandardizedQueryResult): string {
  return `${result.type}:${result.name}:${result.startLine}:${result.endLine}`;
}

/**
 * 合并元数据
 */
export function mergeMetadata(existing: StandardizedQueryResult, newResult: StandardizedQueryResult): void {
  // Use MetadataBuilder to properly merge metadata
  const existingBuilder = MetadataBuilder.fromComplete(existing.metadata);
  const newBuilder = MetadataBuilder.fromComplete(newResult.metadata);

  // Merge the metadata using the builder's merge method
  existingBuilder.merge(newBuilder);

  // Update the existing result with merged metadata
  existing.metadata = existingBuilder.build();
}

/**
 * 后处理结果
 */
export function postProcessResults(
  results: StandardizedQueryResult[],
  enableDeduplication: boolean
): StandardizedQueryResult[] {
  let processedResults = results;

  // 1. 去重
  if (enableDeduplication) {
    processedResults = deduplicateResults(processedResults);
  }

  // 2. 按行号排序
  processedResults = processedResults.sort((a, b) => a.startLine - b.startLine);

  // 3. 过滤无效结果
  processedResults = processedResults.filter(result =>
    result &&
    result.name &&
    result.name !== 'unnamed' &&
    result.startLine > 0 &&
    result.endLine >= result.startLine
  );

  return processedResults;
}

/**
 * 创建错误结果
 */
export function createErrorResult(
  error: any,
  queryType: string,
  language: string,
  symbolTableFilePath?: string | null
): StandardizedQueryResult {
  const errorForMetadata = error instanceof Error ? error : new Error(String(error));
  const filePath = symbolTableFilePath || 'unknown';
  const errorBuilder = new MetadataBuilder()
    .setLanguage(language)
    .setError(errorForMetadata, { phase: 'normalization', queryType, filePath });

  return {
    nodeId: NodeIdGenerator.forError(`${language}_normalization`),
    type: 'expression',
    name: 'error',
    startLine: 0,
    endLine: 0,
    content: '',
    metadata: errorBuilder.build()
  };
}

/**
 * 降级标准化
 */
export function fallbackNormalization(
  queryResults: any[],
  queryType: string,
  language: string
): StandardizedQueryResult[] {
  // 导入必要的工具函数
  const { extractStartLine, extractEndLine, extractContent } = require('./QueryResultUtils');

  return queryResults.slice(0, 10).map((result, index) => {
    // 确保result不为null或undefined
    const safeResult = result || {};
    const nodeId = NodeIdGenerator.forFallback(language, `result_${index}`);
    const builder = new MetadataBuilder()
      .setLanguage(language)
      .setComplexity(1)
      .addDependencies([])
      .addModifiers([])
      .setFlag('isFallback', true)  // 添加标记表示这是降级的结果
      .setTimestamp('fallbackTime', Date.now()); // 添加时间戳

    return {
      nodeId,
      type: 'expression',
      name: `fallback_${index}`,
      startLine: extractStartLine(safeResult),
      endLine: extractEndLine(safeResult),
      content: extractContent(safeResult),
      metadata: builder.build()
    };
  });
}