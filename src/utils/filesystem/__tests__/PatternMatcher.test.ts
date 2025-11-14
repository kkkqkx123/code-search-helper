import { PatternMatcher, TraversalOptions } from '../PatternMatcher';

describe('PatternMatcher', () => {
  const defaultOptions: Required<TraversalOptions> = {
    includePatterns: [],
    excludePatterns: [],
    ignoreHiddenFiles: false,
    ignoreDirectories: []
  };

  describe('shouldIgnoreDirectory', () => {
    it('should ignore hidden directories when ignoreHiddenFiles is true', () => {
      const options = { ...defaultOptions, ignoreHiddenFiles: true };
      expect(PatternMatcher.shouldIgnoreDirectory('.git', options)).toBe(true);
      expect(PatternMatcher.shouldIgnoreDirectory('.hidden', options)).toBe(true);
    });

    it('should not ignore hidden directories when ignoreHiddenFiles is false', () => {
      const options = { ...defaultOptions, ignoreHiddenFiles: false };
      expect(PatternMatcher.shouldIgnoreDirectory('.git', options)).toBe(false);
    });

    it('should ignore directories in ignoreDirectories list', () => {
      const options = { ...defaultOptions, ignoreDirectories: ['node_modules', 'dist'] };
      expect(PatternMatcher.shouldIgnoreDirectory('node_modules', options)).toBe(true);
      expect(PatternMatcher.shouldIgnoreDirectory('dist', options)).toBe(true);
      expect(PatternMatcher.shouldIgnoreDirectory('src', options)).toBe(false);
    });
  });

  describe('shouldIgnoreFile', () => {
    it('should ignore hidden files when ignoreHiddenFiles is true', () => {
      const options = { ...defaultOptions, ignoreHiddenFiles: true };
      expect(PatternMatcher.shouldIgnoreFile('.env', options)).toBe(true);
      expect(PatternMatcher.shouldIgnoreFile('src/.hidden', options)).toBe(true);
    });

    it('should ignore files matching exclude patterns', () => {
      const options = { ...defaultOptions, excludePatterns: ['*.log', '**/test/**'] };
      expect(PatternMatcher.shouldIgnoreFile('app.log', options)).toBe(true);
      expect(PatternMatcher.shouldIgnoreFile('src/test/file.js', options)).toBe(true);
      expect(PatternMatcher.shouldIgnoreFile('src/app.js', options)).toBe(false);
    });

    it('should only include files matching include patterns when specified', () => {
      const options = { ...defaultOptions, includePatterns: ['*.js', '*.ts'] };
      expect(PatternMatcher.shouldIgnoreFile('app.js', options)).toBe(false);
      expect(PatternMatcher.shouldIgnoreFile('app.ts', options)).toBe(false);
      expect(PatternMatcher.shouldIgnoreFile('app.py', options)).toBe(true);
    });

    it('should handle both include and exclude patterns', () => {
      const options = {
        ...defaultOptions,
        includePatterns: ['*.js'],
        excludePatterns: ['test*.js']
      };
      expect(PatternMatcher.shouldIgnoreFile('app.js', options)).toBe(false);
      expect(PatternMatcher.shouldIgnoreFile('test.js', options)).toBe(true);
    });
  });

  describe('matchesPattern', () => {
    it('should match simple glob patterns', () => {
      expect(PatternMatcher.matchesPattern('app.js', '*.js')).toBe(true);
      expect(PatternMatcher.matchesPattern('app.ts', '*.js')).toBe(false);
    });

    it('should match double asterisk patterns', () => {
      expect(PatternMatcher.matchesPattern('src/app.js', '**/*.js')).toBe(true);
      expect(PatternMatcher.matchesPattern('deep/nested/app.js', '**/*.js')).toBe(true);
    });

    it('should match question mark patterns', () => {
      expect(PatternMatcher.matchesPattern('app.js', 'app.?s')).toBe(true);
      expect(PatternMatcher.matchesPattern('app.ts', 'app.?s')).toBe(true);
      expect(PatternMatcher.matchesPattern('app.jsx', 'app.?s')).toBe(false);
    });

    it('should handle filename-only matching for patterns with **/', () => {
      expect(PatternMatcher.matchesPattern('app.js', '**/*.js')).toBe(true);
      expect(PatternMatcher.matchesPattern('app.js', 'src/**/*.js')).toBe(false);
    });

    it('should handle invalid patterns gracefully', () => {
      expect(PatternMatcher.matchesPattern('app.js', '[invalid')).toBe(false);
    });
  });
});