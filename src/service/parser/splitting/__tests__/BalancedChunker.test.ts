
import { BalancedChunker } from '../BalancedChunker';
import { LoggerService } from '../../../../utils/LoggerService';

// Mock LoggerService
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  logger: {} as any,
  getLogFilePath: jest.fn(),
  updateLogLevel: jest.fn(),
  markAsNormalExit: jest.fn(),
} as unknown as LoggerService;

describe('BalancedChunker', () => {
  let chunker: BalancedChunker;

  beforeEach(() => {
    chunker = new BalancedChunker(mockLogger);
  });

  describe('analyzeLineSymbols', () => {
    it('should track brackets correctly', () => {
      chunker.analyzeLineSymbols('function test() {');
      expect(chunker.canSafelySplit()).toBe(false);
      
      chunker.analyzeLineSymbols('  return true;');
      expect(chunker.canSafelySplit()).toBe(false);
      
      chunker.analyzeLineSymbols('}');
      expect(chunker.canSafelySplit()).toBe(true);
    });

    it('should handle nested structures', () => {
      chunker.analyzeLineSymbols('function outer() {');
      expect(chunker.canSafelySplit()).toBe(false);
      
      chunker.analyzeLineSymbols('  function inner() {');
      expect(chunker.canSafelySplit()).toBe(false);
      
      chunker.analyzeLineSymbols('    return true;');
      expect(chunker.canSafelySplit()).toBe(false);
      
      chunker.analyzeLineSymbols('  }');
      expect(chunker.canSafelySplit()).toBe(false);
      
      chunker.analyzeLineSymbols('}');
      expect(chunker.canSafelySplit()).toBe(true);
    });

    it('should ignore comments', () => {
      chunker.analyzeLineSymbols('function test() { // comment with }');
      expect(chunker.canSafelySplit()).toBe(false);
      
      chunker.analyzeLineSymbols('  return true;');
      expect(chunker.canSafelySplit()).toBe(false);
      
      chunker.analyzeLineSymbols('}');
      expect(chunker.canSafelySplit()).toBe(true);
    });

    it('should handle template strings', () => {
      chunker.analyzeLineSymbols('const str = `Hello ${');
      expect(chunker.canSafelySplit()).toBe(false);
      
      chunker.analyzeLineSymbols('  name');
      expect(chunker.canSafelySplit()).toBe(false);
      
      chunker.analyzeLineSymbols('}`;');
      expect(chunker.canSafelySplit()).toBe(true);
    });
  });

  describe('validateCodeBalance', () => {
    it('should return true for balanced code', () => {
      const code = `
        function test() {
          if (true) {
            return true;
          }
        }
      `;
      expect(chunker.validateCodeBalance(code)).toBe(true);
    });

    it('should return false for unbalanced code', () => {
      const code = `
        function test() {
          if (true) {
            return true;
      `;
      expect(chunker.validateCodeBalance(code)).toBe(false);
    });

    it('should handle complex nested structures', () => {
      const code = `
        class TestClass {
          constructor() {
            this.data = [1, 2, 3];
          }
          
          method() {
            return this.data.map(x => x * 2);
          }
        }
      `;
      expect(chunker.validateCodeBalance(code)).toBe(true);
    });
  });

  describe('caching', () => {
    it('should cache and reuse symbol analysis results', () => {
      const line = 'function test() {';
      
      // First analysis
      chunker.analyzeLineSymbols(line);
      expect(chunker.canSafelySplit()).toBe(false);
      
      // Reset and analyze again (should use cache)
      chunker.reset();
      chunker.analyzeLineSymbols(line);
      expect(chunker.canSafelySplit()).toBe(false);
      
      // Verify cache was used
      expect(mockLogger.debug).not.toHaveBeenCalledWith('Cache miss');
    });

    it('should pre-cache common patterns', () => {
      chunker.preCacheCommonPatterns();
      
      // These should be cached now
      chunker.analyzeLineSymbols('function () {}');
      chunker.analyzeLineSymbols('if () {}');
      chunker.analyzeLineSymbols('for () {}');
      
      // Should not cause any errors
      expect(true).toBe(true);
    });
  });

  describe('state management', () => {
    it('should reset state correctly', () => {
      chunker.analyzeLineSymbols('function test() {');
      expect(chunker.canSafelySplit()).toBe(false);
      
      chunker.reset();
      expect(chunker.canSafelySplit()).toBe(true);
    });

    it('should get and set current state', () => {
      chunker.analyzeLineSymbols('function test() {');
      const state = chunker.getCurrentState();
      
      expect(state.brackets).toBe(1);
      expect(state.braces).toBe(1);
      expect(state.squares).toBe(0);
      expect(state.templates).toBe(0);
      
      chunker.reset();
      chunker.setCurrentState(state);
      
      expect(chunker.canSafelySplit()).toBe(false);
    });
  });
});