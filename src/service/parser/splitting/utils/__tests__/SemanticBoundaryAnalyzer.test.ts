import { SemanticBoundaryAnalyzer } from '../SemanticBoundaryAnalyzer';

describe('SemanticBoundaryAnalyzer', () => {
  let analyzer: SemanticBoundaryAnalyzer;

  beforeEach(() => {
    analyzer = new SemanticBoundaryAnalyzer();
  });

  describe('calculateBoundaryScore', () => {
    it('should give high score to function boundaries', () => {
      const line = '  }';
      const context = ['function test() {', '  return true;', '  }'];
      const score = analyzer.calculateBoundaryScore(line, context, 'typescript');
      
      expect(score.score).toBeGreaterThan(0.7);
      expect(score.components.semantic).toBe(true);
    });

    it('should give high score to class boundaries', () => {
      const line = '}';
      const context = ['class TestClass {', '  constructor() {}', '}'];
      const score = analyzer.calculateBoundaryScore(line, context, 'typescript');
      
      expect(score.score).toBeGreaterThan(0.7);
      expect(score.components.semantic).toBe(true);
    });

    it('should give moderate score to logical boundaries', () => {
      const line = '';
      const context = ['const x = 1;', '', 'const y = 2;'];
      const score = analyzer.calculateBoundaryScore(line, context, 'typescript');
      
      expect(score.score).toBeGreaterThan(0.3);
      expect(score.components.logical).toBe(true);
    });

    it('should give low score to non-boundaries', () => {
      const line = ' const x = 1;';
      const context = ['function test() {', '  const x = 1;', '  return x;'];
      const score = analyzer.calculateBoundaryScore(line, context, 'typescript');
      
      expect(score.score).toBeLessThan(0.3);
    });

    it('should handle different languages appropriately', () => {
      const line = '  }';
      const context = ['def test_function():', '  return True', '  }'];
      
      // Python should still recognize the boundary even if syntax is slightly different
      const score = analyzer.calculateBoundaryScore(line, context, 'python');
      
      // Should at least recognize syntactic safety
      expect(score.components.syntactic).toBe(true);
    });
 });
});