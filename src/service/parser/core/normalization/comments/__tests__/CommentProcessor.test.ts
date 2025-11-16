import { CommentProcessor } from '../core/CommentProcessor';
import { QueryResult } from '../types';

describe('CommentProcessor', () => {
  let processor: CommentProcessor;

  beforeEach(() => {
    processor = new CommentProcessor();
  });

  describe('processComments', () => {
    it('should process JavaScript comments correctly', () => {
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
            }
          ]
        }
      ];

      const results = processor.processComments(mockQueryResults, 'javascript');

      expect(results).toHaveLength(1);
      expect(results[0].semanticType).toBe('comment.jsdoc');
      expect(results[0].category).toBe('documentation');
      expect(results[0].language).toBe('javascript');
    });

    it('should filter unsupported captures', () => {
      const mockQueryResults: QueryResult[] = [
        {
          captures: [
            {
              name: 'comment.unsupported',
              node: {
                text: '// unsupported comment',
                startPosition: { row: 0, column: 0 },
                endPosition: { row: 0, column: 20 }
              },
              text: '// unsupported comment',
              startPosition: { row: 0, column: 0 },
              endPosition: { row: 0, column: 20 }
            }
          ]
        }
      ];

      const results = processor.processComments(mockQueryResults, 'javascript');

      expect(results).toHaveLength(0);
    });
  });
});