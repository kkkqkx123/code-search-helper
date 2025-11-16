import { ProcessedComment, QueryResult, QueryCapture, CommentCategory } from '../types';
import { QueryAnalyzer } from './QueryAnalyzer';
import { CommentClassifier } from './CommentClassifier';
import { getLanguageConfig } from '../config/LanguageConfigs';
import { PositionUtils } from '../utils/PositionUtils';

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
    language: string
  ): ProcessedComment[] {
    const languageConfig = getLanguageConfig(language);
    const captures = this.queryAnalyzer.extractCommentCapturesBatch(queryResults);

    // 过滤支持的捕获类型
    const supportedCaptures = captures.filter(capture =>
      languageConfig.supportedCaptures.includes(capture.name)
    );

    // 处理每个捕获
    return supportedCaptures.map(capture =>
      this.processCapture(capture, language)
    );
  }

  /**
   * 处理单个捕获
   */
  private processCapture(capture: QueryCapture, language: string): ProcessedComment {
    // 基础信息
    const id = this.generateCommentId(capture);
    const category = this.classifier.classifyByCapture(capture);
    const semanticInfo = this.queryAnalyzer.extractSemanticInfo(capture);

    // 查找相关节点
    const relatedNodeId = this.findRelatedNodeId(capture);

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
        attributes: semanticInfo.attributes,
        relatedNodeId
      }
    };
  }

  /**
   * 生成注释ID
   */
  private generateCommentId(capture: QueryCapture): string {
    return `comment_${capture.startPosition.row}_${capture.startPosition.column}_${capture.name}`;
  }

  /**
   * 查找相关节点
   * 简化版本：基于位置查找最近的代码节点
   */
  private findRelatedNodeId(capture: QueryCapture): string | undefined {
    // 这里可以添加更复杂的关联逻辑
    // 目前返回undefined，表示未找到关联节点
    return undefined;
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