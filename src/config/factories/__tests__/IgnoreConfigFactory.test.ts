import { IgnoreConfigFactory } from '../IgnoreConfigFactory';

describe('IgnoreConfigFactory', () => {
  describe('createDefaultIgnorePatterns', () => {
    it('should return an array of default ignore patterns', () => {
      const patterns = IgnoreConfigFactory.createDefaultIgnorePatterns();
      
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);
      
      // 验证包含一些常见的忽略规则
      expect(patterns).toContain('**/node_modules/**');
      expect(patterns).toContain('.git/**');
      expect(patterns).toContain('**/*.log');
      expect(patterns).toContain('dist/**');
    });

    it('should return a new array each time (no shared references)', () => {
      const patterns1 = IgnoreConfigFactory.createDefaultIgnorePatterns();
      const patterns2 = IgnoreConfigFactory.createDefaultIgnorePatterns();
      
      expect(patterns1).not.toBe(patterns2);
      expect(patterns1).toEqual(patterns2);
    });
  });

  describe('createHotReloadIgnorePatterns', () => {
    it('should return default patterns plus hot reload specific patterns', () => {
      const defaultPatterns = IgnoreConfigFactory.createDefaultIgnorePatterns();
      const hotReloadPatterns = IgnoreConfigFactory.createHotReloadIgnorePatterns();
      
      // 热更新模式应该包含所有默认模式
      defaultPatterns.forEach(pattern => {
        expect(hotReloadPatterns).toContain(pattern);
      });
      
      // 热更新模式应该包含额外的模式
      expect(hotReloadPatterns).toContain('**/*.tmp');
      expect(hotReloadPatterns).toContain('**/*.temp');
      expect(hotReloadPatterns).toContain('**/.#*');
      expect(hotReloadPatterns).toContain('**/#*#');
    });
  });

  describe('validateIgnorePatterns', () => {
    it('should validate correct patterns', () => {
      const validPatterns = ['**/node_modules/**', '*.log', 'dist/**'];
      const result = IgnoreConfigFactory.validateIgnorePatterns(validPatterns);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject non-array input', () => {
      const result = IgnoreConfigFactory.validateIgnorePatterns('not an array' as any);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Ignore patterns must be an array');
    });

    it('should reject invalid pattern types', () => {
      const invalidPatterns = ['**/node_modules/**', 123, null, undefined, ''] as any;
      const result = IgnoreConfigFactory.validateIgnorePatterns(invalidPatterns);
      
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some(e => e.includes('Ignore pattern must be a string'))).toBe(true);
      expect(result.errors.some(e => e.includes('Ignore pattern cannot be empty string'))).toBe(true);
    });
  });

  describe('mergeIgnorePatterns', () => {
    it('should merge multiple pattern arrays', () => {
      const patterns1 = ['**/node_modules/**', '*.log'];
      const patterns2 = ['dist/**', 'build/**'];
      const patterns3 = ['**/*.tmp'];
      
      const merged = IgnoreConfigFactory.mergeIgnorePatterns(patterns1, patterns2, patterns3);
      
      expect(merged).toContain('**/node_modules/**');
      expect(merged).toContain('*.log');
      expect(merged).toContain('dist/**');
      expect(merged).toContain('build/**');
      expect(merged).toContain('**/*.tmp');
    });

    it('should remove duplicates', () => {
      const patterns1 = ['**/node_modules/**', '*.log'];
      const patterns2 = ['**/node_modules/**', 'dist/**']; // 重复的 node_modules
      
      const merged = IgnoreConfigFactory.mergeIgnorePatterns(patterns1, patterns2);
      
      // 确保重复的模式只出现一次
      const nodeModulesCount = merged.filter(p => p === '**/node_modules/**').length;
      expect(nodeModulesCount).toBe(1);
    });

    it('should handle non-array inputs gracefully', () => {
      const patterns1 = ['**/node_modules/**'];
      const patterns2 = null as any;
      const patterns3 = ['dist/**'];
      
      const merged = IgnoreConfigFactory.mergeIgnorePatterns(patterns1, patterns2, patterns3);
      
      expect(merged).toContain('**/node_modules/**');
      expect(merged).toContain('dist/**');
      expect(merged.length).toBe(2);
    });
  });

  describe('filterValidPatterns', () => {
    it('should filter out invalid patterns', () => {
      const patterns = [
        '**/node_modules/**',  // 有效
        '*.log',              // 有效
        '',                   // 无效：空字符串
        '   ',                // 无效：只有空格
        '# comment',          // 无效：注释
        'dist/**',            // 有效
        null as any,          // 无效：null
        undefined as any,     // 无效：undefined
        123 as any            // 无效：非字符串
      ];
      
      const filtered = IgnoreConfigFactory.filterValidPatterns(patterns);
      
      expect(filtered).toEqual(['**/node_modules/**', '*.log', 'dist/**']);
    });

    it('should handle empty array', () => {
      const filtered = IgnoreConfigFactory.filterValidPatterns([]);
      expect(filtered).toEqual([]);
    });

    it('should handle array with only invalid patterns', () => {
      const patterns = ['', '# comment', null, undefined, 123 as any];
      const filtered = IgnoreConfigFactory.filterValidPatterns(patterns);
      expect(filtered).toEqual([]);
    });
  });
});