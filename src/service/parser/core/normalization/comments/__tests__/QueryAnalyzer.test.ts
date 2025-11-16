import { QueryAnalyzer } from '../core/QueryAnalyzer';
import { QueryResult } from '../types';

describe('QueryAnalyzer', () => {
  let analyzer: QueryAnalyzer;

  beforeEach(() => {
    analyzer = new QueryAnalyzer();
  });

 describe('extractCommentCaptures', () => {
    it('should extract comment captures correctly', () => {
      const mockQueryResult: QueryResult = {
        captures: [
          {
            name: 'comment.single',
            node: {
              text: '// This is a comment',
              startPosition: { row: 0, column: 0 },
              endPosition: { row: 0, column: 18 }
            },
            text: '// This is a comment',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 0, column: 18 }
          },
          {
            name: 'function.declaration',
            node: {
              text: 'function test() {}',
              startPosition: { row: 1, column: 0 },
              endPosition: { row: 1, column: 17 }
            },
            text: 'function test() {}',
            startPosition: { row: 1, column: 0 },
            endPosition: { row: 1, column: 17 }
          }
        ]
      };

      const captures = analyzer.extractCommentCaptures(mockQueryResult);

      expect(captures).toHaveLength(1);
      expect(captures[0].name).toBe('comment.single');
      expect(captures[0].text).toBe('// This is a comment');
    });

    it('should extract multiple comment captures', () => {
      const mockQueryResult: QueryResult = {
        captures: [
          {
            name: 'comment.single',
            node: {
              text: '// First comment',
              startPosition: { row: 0, column: 0 },
              endPosition: { row: 0, column: 15 }
            },
            text: '// First comment',
            startPosition: { row: 0, column: 0 },
            endPosition: { row: 0, column: 15 }
          },
          {
            name: 'comment.multi',
            node: {
              text: '/* Multi-line comment */',
              startPosition: { row: 1, column: 0 },
              endPosition: { row: 1, column: 23 }
            },
            text: '/* Multi-line comment */',
            startPosition: { row: 1, column: 0 },
            endPosition: { row: 1, column: 23 }
          },
          {
            name: 'comment.todo',
            node: {
              text: '// TODO: Implement feature',
              startPosition: { row: 2, column: 0 },
              endPosition: { row: 2, column: 25 }
            },
            text: '// TODO: Implement feature',
            startPosition: { row: 2, column: 0 },
            endPosition: { row: 2, column: 25 }
          }
        ]
      };

      const captures = analyzer.extractCommentCaptures(mockQueryResult);

      expect(captures).toHaveLength(3);
      expect(captures.map(c => c.name)).toEqual(['comment.single', 'comment.multi', 'comment.todo']);
    });

    it('should extract semantic info correctly', () => {
      const mockCapture = {
        name: 'comment.jsdoc',
        node: {
          text: '/** JSDoc comment */',
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 0, column: 19 }
        },
        text: '/** JSDoc comment */',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 19 }
      };

      const semanticInfo = analyzer.extractSemanticInfo(mockCapture);

      expect(semanticInfo.type).toBe('documentation');
      expect(semanticInfo.confidence).toBe(0.95);
      expect(semanticInfo.attributes).toEqual({ format: 'jsdoc', structured: true });
    });
  });
});