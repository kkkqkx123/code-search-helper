import { CommentCategory, QueryCapture } from '../types';
import { getQueryMapping } from '../config/QueryMappings';

/**
 * 注释分类器
 * 基于tree-sitter查询捕获名称进行分类
 */
export class CommentClassifier {
  /**
   * 基于捕获名称分类
   */
  classifyByCapture(capture: QueryCapture): CommentCategory {
    const mapping = getQueryMapping(capture.name);

    if (mapping) {
      return mapping.category;
    }

    // 回退到基础分类
    return this.classifyByPattern(capture.name);
  }

  /**
   * 基于文本分类（回退方案）
   */
  classifyByText(text: string): CommentCategory {
    const lowerText = text.toLowerCase().trim();

    // TODO/FIXME标记
    if (/\b(todo|fixme|xxx|hack|note|bug|warn|warning)\b/i.test(lowerText)) {
      return CommentCategory.TODO;
    }

    // 许可证
    if (/\b(copyright|license|gpl|mit|apache|bsd)\b/i.test(lowerText)) {
      return CommentCategory.LICENSE;
    }

    // 配置
    if (/\b(config|setting|option|parameter)\b/i.test(lowerText)) {
      return CommentCategory.CONFIG;
    }

    // 调试
    if (/\b(debug|console\.log|print)\b/i.test(lowerText)) {
      return CommentCategory.DEBUG;
    }

    // 文档
    if (/@\w+/i.test(lowerText)) {
      return CommentCategory.DOCUMENTATION;
    }

    // 默认
    return CommentCategory.OTHER;
  }

  /**
   * 基于模式分类
   */
  private classifyByPattern(captureName: string): CommentCategory {
    // 文档注释模式
    if (captureName.includes('doc')) {
      return CommentCategory.DOCUMENTATION;
    }

    // 任务标记模式
    if (captureName.includes('todo') || captureName.includes('fixme')) {
      return CommentCategory.TODO;
    }

    // 许可证模式
    if (captureName.includes('license')) {
      return CommentCategory.LICENSE;
    }

    // 内联注释模式
    if (captureName.includes('inline')) {
      return CommentCategory.INLINE;
    }

    return CommentCategory.OTHER;
  }
}