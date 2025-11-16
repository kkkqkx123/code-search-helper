import { CommentCategory, QueryMapping } from '../types';

/**
 * 查询捕获到分类的映射
 * 基于tree-sitter查询规则定义
 */
export const QUERY_MAPPINGS: Record<string, QueryMapping> = {
  // 基础注释类型
  'comment.single': {
    category: CommentCategory.INLINE,
    confidence: 0.9,
    attributes: { multiline: false }
  },
  'comment.multi': {
    category: CommentCategory.DOCUMENTATION,
    confidence: 0.9,
    attributes: { multiline: true }
  },
  'comment.any': {
    category: CommentCategory.OTHER,
    confidence: 0.7
  },

  // 文档注释
  'comment.jsdoc': {
    category: CommentCategory.DOCUMENTATION,
    confidence: 0.95,
    attributes: { format: 'jsdoc', structured: true }
  },
  'comment.javadoc': {
    category: CommentCategory.DOCUMENTATION,
    confidence: 0.95,
    attributes: { format: 'javadoc', structured: true }
  },
  'comment.kdoc': {
    category: CommentCategory.DOCUMENTATION,
    confidence: 0.95,
    attributes: { format: 'kdoc', structured: true }
  },
  'comment.doc': {
    category: CommentCategory.DOCUMENTATION,
    confidence: 0.9,
    attributes: { structured: true }
  },

  // 特殊标记
  'comment.todo': {
    category: CommentCategory.TODO,
    confidence: 0.95,
    attributes: { actionable: true, priority: 'normal' }
  },
  'comment.license': {
    category: CommentCategory.LICENSE,
    confidence: 0.95,
    attributes: { legal: true, header: true }
  },

  // JavaScript特定
  'comment.jsdoc_tags': {
    category: CommentCategory.DOCUMENTATION,
    confidence: 0.9,
    attributes: { tagged: true, parseable: true }
  },
  'comment.js_features': {
    category: CommentCategory.DOCUMENTATION,
    confidence: 0.8,
    attributes: { domain: 'javascript', technical: true }
  },
  'comment.event_dom': {
    category: CommentCategory.DOCUMENTATION,
    confidence: 0.8,
    attributes: { domain: 'dom', technical: true }
  },
  'comment.performance_security': {
    category: CommentCategory.DOCUMENTATION,
    confidence: 0.8,
    attributes: { domain: 'performance', technical: true }
  },
  'comment.dev_tools_testing': {
    category: CommentCategory.DOCUMENTATION,
    confidence: 0.8,
    attributes: { domain: 'testing', technical: true }
  },

  // Python特定
  'comment.python': {
    category: CommentCategory.INLINE,
    confidence: 0.9,
    attributes: { language: 'python' }
  },
  'comment.docstring': {
    category: CommentCategory.DOCUMENTATION,
    confidence: 0.95,
    attributes: { format: 'docstring', structured: true }
  },

  // 通用模式匹配
  'comment.inline': {
    category: CommentCategory.INLINE,
    confidence: 0.8
  }
};

/**
 * 获取查询映射
 */
export function getQueryMapping(captureName: string): QueryMapping | null {
  // 直接匹配
  if (QUERY_MAPPINGS[captureName]) {
    return QUERY_MAPPINGS[captureName];
  }

  // 模式匹配
  if (captureName.startsWith('comment.')) {
    // 通用注释模式
    if (captureName.includes('doc')) {
      return {
        category: CommentCategory.DOCUMENTATION,
        confidence: 0.7,
        attributes: { inferred: true }
      };
    }

    if (captureName.includes('todo') || captureName.includes('fixme')) {
      return {
        category: CommentCategory.TODO,
        confidence: 0.8,
        attributes: { inferred: true }
      };
    }
  }

  return null;
}