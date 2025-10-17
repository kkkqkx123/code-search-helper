import { ComplexityCalculator } from '../utils/ComplexityCalculator';
import { SyntaxValidator } from '../utils/SyntaxValidator';
import { ChunkOptimizer } from '../utils/chunk-processing';
import { PerformanceMonitor } from '../utils/performance';
import { BalancedChunker } from '../BalancedChunker';
import { CodeChunk } from '..';

describe('Utils', () => {
  describe('ComplexityCalculator', () => {
    let calculator: ComplexityCalculator;

    beforeEach(() => {
      calculator = new ComplexityCalculator();
    });

    it('should calculate complexity based on keywords', () => {
      const code = `function test() {
  if (true) {
    for (let i = 0; i < 10; i++) {
      console.log(i);
    }
  }
}`;
      const complexity = calculator.calculate(code);
      expect(complexity).toBeGreaterThan(0);
    });

    it('should estimate complexity', () => {
      const code = `function test() {
 console.log('hello');
}`;
      const complexity = calculator.estimate(code);
      expect(complexity).toBeGreaterThan(0);
    });

    it('should calculate semantic score', () => {
      const line = 'function test() {';
      const score = calculator.calculateSemanticScore(line);
      expect(score).toBeGreaterThan(0);
    });
  });

  describe('SyntaxValidator', () => {
    let balancedChunker: BalancedChunker;
    let validator: SyntaxValidator;

    beforeEach(() => {
      balancedChunker = new BalancedChunker();
      validator = new SyntaxValidator(balancedChunker);
    });

    it('should validate balanced code', () => {
      const code = `function test() {
  return { a: 1 };
}`;
      const isValid = validator.validate(code, 'javascript');
      expect(isValid).toBe(true);
    });

    it('should reject unbalanced code', () => {
      const code = `function test() {
  return { a: 1;
}`;
      const isValid = validator.validate(code, 'javascript');
      expect(isValid).toBe(false);
    });

    it('should check bracket balance', () => {
      expect(validator.checkBracketBalance('()')).toBe(0);
      expect(validator.checkBracketBalance('(')).toBe(1);
      expect(validator.checkBracketBalance(')')).toBe(-1);
    });

    it('should check brace balance', () => {
      expect(validator.checkBraceBalance('{}')).toBe(0);
      expect(validator.checkBraceBalance('{')).toBe(1);
      expect(validator.checkBraceBalance('}')).toBe(-1);
    });
  });

  describe('ChunkOptimizer', () => {
    let optimizer: ChunkOptimizer;

    beforeEach(() => {
      optimizer = new ChunkOptimizer();
    });

    it('should optimize chunks', () => {
      const chunks: CodeChunk[] = [
        {
          content: 'function test1() { console.log(1); }',
          metadata: { startLine: 1, endLine: 1, language: 'javascript', type: 'function', complexity: 5 }
        },
        {
          content: 'console.log(2);',
          metadata: { startLine: 2, endLine: 2, language: 'javascript', type: 'generic', complexity: 1 }
        }
      ];

      const optimized = optimizer.optimize(chunks, chunks.map(c => c.content).join('\n'));
      expect(Array.isArray(optimized)).toBe(true);
    });

    it('should determine if chunks should merge', () => {
      const chunk1: CodeChunk = {
        content: 'console.log(1);',
        metadata: { startLine: 1, endLine: 1, language: 'javascript', type: 'generic', complexity: 1 }
      };
      const chunk2: CodeChunk = {
        content: 'console.log(2);',
        metadata: { startLine: 2, endLine: 2, language: 'javascript', type: 'generic', complexity: 1 }
      };

      const shouldMerge = optimizer.shouldMerge(chunk1, chunk2);
      expect(typeof shouldMerge).toBe('boolean');
    });
  });

  describe('PerformanceMonitor', () => {
    let monitor: PerformanceMonitor;

    beforeEach(() => {
      monitor = new PerformanceMonitor();
    });

    it('should record performance metrics', () => {
      monitor.record(Date.now() - 100, 100, true);
      const stats = monitor.getStats();
      expect(stats.totalLines).toBeGreaterThanOrEqual(0);
    });

    it('should reset stats', () => {
      monitor.reset();
      const stats = monitor.getStats();
      expect(stats.totalLines).toBe(0);
    });
  });
});