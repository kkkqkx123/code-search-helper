import { CommentClassifier } from '../core/CommentClassifier';
import { CommentCategory } from '../types/CommentTypes';

describe('CommentClassifier', () => {
  let classifier: CommentClassifier;

  beforeEach(() => {
    classifier = new CommentClassifier();
  });

  describe('classifyByCapture', () => {
    it('should classify jsdoc comments as documentation', () => {
      const mockCapture = {
        name: 'comment.jsdoc',
        node: { text: '/** JSDoc comment */' },
        text: '/** JSDoc comment */',
        startPosition: { row: 0, column: 0 },
        endPosition: { row: 0, column: 20 }
      };

      const category = classifier.classifyByCapture(mockCapture);

      expect(category).toBe(CommentCategory.DOCUMENTATION);
    });

    it('should classify todo comments as todo', () => {
      const mockCapture = {
        name: 'comment.todo',
        node: { text: '// TODO: Implement this' },
        text: '// TODO: Implement this',
        startPosition: { row: 1, column: 0 },
        endPosition: { row: 1, column: 23 }
      };

      const category = classifier.classifyByCapture(mockCapture);

      expect(category).toBe(CommentCategory.TODO);
    });

    it('should classify license comments as license', () => {
      const mockCapture = {
        name: 'comment.license',
        node: { text: '/* Copyright 2023 */' },
        text: '/* Copyright 2023 */',
        startPosition: { row: 2, column: 0 },
        endPosition: { row: 2, column: 21 }
      };

      const category = classifier.classifyByCapture(mockCapture);

      expect(category).toBe(CommentCategory.LICENSE);
    });

    it('should classify by pattern when no direct mapping exists', () => {
      const mockCapture = {
        name: 'comment.docstring',
        node: { text: '"""Python docstring"""' },
        text: '"""Python docstring"""',
        startPosition: { row: 3, column: 0 },
        endPosition: { row: 3, column: 22 }
      };

      const category = classifier.classifyByCapture(mockCapture);

      // Based on pattern matching 'doc' in 'comment.docstring'
      expect(category).toBe(CommentCategory.DOCUMENTATION);
    });
  });

 describe('classifyByText', () => {
    it('should classify TODO markers', () => {
      const category = classifier.classifyByText('TODO: Implement this function');

      expect(category).toBe(CommentCategory.TODO);
    });

    it('should classify FIXME markers', () => {
      const category = classifier.classifyByText('FIXME: This needs to be fixed');

      expect(category).toBe(CommentCategory.TODO);
    });

    it('should classify license text', () => {
      const category = classifier.classifyByText('Copyright (c) 2023, MIT License');

      expect(category).toBe(CommentCategory.LICENSE);
    });

    it('should classify documentation markers', () => {
      const category = classifier.classifyByText('@param {string} name - The user name');

      expect(category).toBe(CommentCategory.DOCUMENTATION);
    });

    it('should return OTHER for unrecognized text', () => {
      const category = classifier.classifyByText('This is just a regular comment');

      expect(category).toBe(CommentCategory.OTHER);
    });
  });
});