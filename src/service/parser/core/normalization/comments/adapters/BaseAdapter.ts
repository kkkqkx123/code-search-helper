import { ProcessedComment, QueryResult } from '../types';
import { CommentProcessor } from '../core/CommentProcessor';
import { StandardizedQueryResult } from '../../types';

/**
 * 基础注释适配器
 * 实现与BaseLanguageAdapter的接口兼容
 */
export abstract class BaseCommentAdapter {
  protected processor: CommentProcessor;

  constructor() {
    this.processor = new CommentProcessor();
  }

 /**
   * 处理注释
   * 与现有接口保持兼容
   */
  processComments(
    standardResults: StandardizedQueryResult[],
    allQueryResults: QueryResult[],
    language: string
  ): StandardizedQueryResult[] {
    // 使用新的处理器处理注释
    const processedComments = this.processor.processComments(allQueryResults, language);
    
    // 转换为StandardizedQueryResult格式
    const commentResults = processedComments.map(comment =>
      this.convertToStandardResult(comment)
    );

    // 合并结果
    return [...standardResults, ...commentResults];
  }

  /**
   * 转换为标准化结果
   */
  private convertToStandardResult(comment: ProcessedComment): StandardizedQueryResult {
    // 使用MetadataBuilder创建符合ExtensibleMetadata格式的元数据
    const metadata = {
      language: comment.language,
      complexity: 1,
      dependencies: [],
      modifiers: [],
      commentCategory: comment.category,
      commentType: comment.semanticType,
      ...comment.metadata
    };
    
    return {
      nodeId: comment.id,
      type: 'expression',
      name: this.generateCommentName(comment),
      startLine: comment.startPosition.row + 1,
      endLine: comment.endPosition.row + 1,
      content: comment.text,
      metadata
    };
  }

  /**
   * 生成注释名称
   */
  private generateCommentName(comment: ProcessedComment): string {
    const position = `${comment.startPosition.row + 1}:${comment.startPosition.column}`;
    const preview = comment.text.substring(0, 20).replace(/\s+/g, ' ');
    return `${comment.category}_${position}_${preview}`;
  }
}