/**
 * Comment模块集成测试
 */

import { CommentProcessor } from './core/CommentProcessor';
import { QueryResult } from './types';

// 模拟查询结果数据
const mockQueryResults: QueryResult[] = [
 {
    captures: [
      {
        name: 'comment.jsdoc',
        node: {
          text: '/**\n * Test function\n * @param {string} name\n */',
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 2, column: 3 }
        },
        text: '/**\n * Test function\n * @param {string} name\n */',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 2, column: 3 }
      },
      {
        name: 'comment.single',
        node: {
          text: '// This is a simple comment',
          startPosition: { row: 5, column: 0 },
          endPosition: { row: 5, column: 25 }
        },
        text: '// This is a simple comment',
        startPosition: { row: 5, column: 0 },
        endPosition: { row: 5, column: 25 }
      },
      {
        name: 'comment.todo',
        node: {
          text: '// TODO: Implement this feature',
          startPosition: { row: 10, column: 0 },
          endPosition: { row: 10, column: 28 }
        },
        text: '// TODO: Implement this feature',
        startPosition: { row: 10, column: 0 },
        endPosition: { row: 10, column: 28 }
      }
    ]
  }
];

async function testCommentProcessor() {
  console.log('Testing CommentProcessor integration...');
  
  const processor = new CommentProcessor();
  const results = processor.processComments(mockQueryResults, 'javascript', 'test.js');
  
  console.log(`Processed ${results.length} comments:`);
  results.forEach((comment, index) => {
    console.log(`${index + 1}. Type: ${comment.semanticType}, Category: ${comment.category}, Text: "${comment.text.substring(0, 30)}..."`);
  });
  
  // 统计分类分布
  const categoryCount: Record<string, number> = {};
  results.forEach(comment => {
    categoryCount[comment.category] = (categoryCount[comment.category] || 0) + 1;
  });
  
  console.log('\nCategory distribution:');
  Object.entries(categoryCount).forEach(([category, count]) => {
    console.log(`  ${category}: ${count}`);
  });
}

// 运行测试
testCommentProcessor().catch(console.error);