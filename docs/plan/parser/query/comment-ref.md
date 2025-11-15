/**
 * 统一注释查询规则
 * 使用tree-sitter交替运算符优化跨语言注释查询
 * 基于实际验证结果修复节点类型
 */

import { UnifiedQuery } from './query-contracts';

export const unifiedCommentQuery: UnifiedQuery = {
  basePattern: `(comment) @comment`, // 适用于JavaScript, Python, TypeScript等
  
  languageExtensions: {
    // 基于验证结果的语言特定扩展
    javascript: [
      `(comment) @comment`                  // JavaScript注释（包括单行和多行）
    ],
    python: [
      `(comment) @comment`                  // Python注释
    ],
    java: [
      `[
        (line_comment)
        (block_comment)
      ] @comment`                          // Java使用交替运算符
    ],
    rust: [
      `[
        (line_comment)
        (block_comment)
      ] @comment`                          // Rust使用交替运算符
    ],
    c: [
      `(comment) @comment`                 // C语言使用统一comment节点
    ],
    cpp: [
      `(comment) @comment`                 // C++使用统一comment节点
    ],
    csharp: [
      `(comment) @comment`                 // C#使用统一comment节点
    ],
    go: [
      `(comment) @comment`                 // Go使用统一comment节点
    ],
    kotlin: [
      `(comment) @comment`                 // Kotlin使用统一comment节点
    ]
  },
  
  description: '统一注释查询规则，支持多种语言的注释类型，使用交替运算符提高查询效率',
  priority: 1,
  
  validators: [
    {
      language: 'javascript',
      testCases: [
        {
          code: `// 单行注释\n/* 块注释 */\n/** JSDoc注释 */`,
          expectedCount: 3,
          expectedTypes: ['comment', 'comment', 'comment']
        }
      ]
    },
    {
      language: 'python',
      testCases: [
        {
          code: `# Python注释\n"""文档字符串"""`,
          expectedCount: 2,
          expectedTypes: ['comment', 'string']
        }
      ]
    },
    {
      language: 'rust',
      testCases: [
        {
          code: `// 行注释\n/* 块注释 */\n/// 外部文档\n//! 内部文档`,
          expectedCount: 4,
          expectedTypes: ['line_comment', 'block_comment', 'outer_doc_comment', 'inner_doc_comment']
        }
      ]
    }
  ]
};

/**
 * 获取指定语言的注释查询规则
 */
export function getCommentQueries(language: string): string {
  const extensions = unifiedCommentQuery.languageExtensions?.[language.toLowerCase()];
  
  // 如果有语言特定扩展，优先使用扩展模式
  if (extensions && extensions.length > 0) {
    // 对于Java，使用交替运算符模式
    if (language.toLowerCase() === 'java') {
      return extensions[0]; // 返回Java的交替运算符模式
    }
    // 对于其他有扩展的语言，返回扩展模式
    return extensions[0];
  }
  
  // 否则使用基础模式
  return unifiedCommentQuery.basePattern;
}
