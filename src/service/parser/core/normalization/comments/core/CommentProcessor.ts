import { ProcessedComment, QueryResult, QueryCapture, CommentCategory } from '../types';
import { QueryAnalyzer } from './QueryAnalyzer';
import { CommentClassifier } from './CommentClassifier';
import { getLanguageConfig } from '../config/LanguageConfigs';
import { NodeIdGenerator } from '../../../../../../utils/deterministic-node-id';

/**
 * 注释处理器
 * 新架构的核心组件
 */
export class CommentProcessor {
  private queryAnalyzer: QueryAnalyzer;
  private classifier: CommentClassifier;

  constructor() {
    this.queryAnalyzer = new QueryAnalyzer();
    this.classifier = new CommentClassifier();
  }

  /**
   * 处理查询结果中的注释
   */
  processComments(
    queryResults: QueryResult[],
    language: string,
    filePath?: string
  ): ProcessedComment[] {
    const languageConfig = getLanguageConfig(language);
    const captures = this.queryAnalyzer.extractCommentCapturesBatch(queryResults);

    // 过滤支持的捕获类型
    const supportedCaptures = captures.filter(capture =>
      languageConfig.supportedCaptures.includes(capture.name)
    );

    // 处理每个捕获
    return supportedCaptures.map(capture =>
      this.processCapture(capture, language, filePath)
    );
  }

  /**
   * 处理单个捕获
   */
 private processCapture(capture: QueryCapture, language: string, filePath?: string): ProcessedComment {
    // 基础信息
    const id = this.generateCommentId(capture, filePath);
    const category = this.classifier.classifyByCapture(capture);
    const semanticInfo = this.queryAnalyzer.extractSemanticInfo(capture);

    return {
      id,
      text: capture.text,
      startPosition: capture.startPosition,
      endPosition: capture.endPosition,
      semanticType: capture.name,
      category,
      language,
      metadata: {
        captureName: capture.name,
        confidence: semanticInfo.confidence,
        attributes: semanticInfo.attributes
      }
    };
  }

  /**
   * 生成注释ID
   */
  private generateCommentId(capture: QueryCapture, filePath?: string): string {
    // 使用NodeIdGenerator为注释生成统一格式的ID
    return NodeIdGenerator.forSymbol(
      `comment_${capture.name}`, // name
      'comment',                // type
      filePath || 'unknown_file', // filePath - 如果没有提供则使用默认值
      capture.startPosition.row + 1  // line (1-indexed)
    );
  }

  /**
   * 获取处理统计信息
   */
  getStats(): {
    processedCount: number;
    categoryDistribution: Record<CommentCategory, number>;
  } {
    // 这里可以添加统计信息收集
    return {
      processedCount: 0,
      categoryDistribution: {} as Record<CommentCategory, number>
    };
  }
}