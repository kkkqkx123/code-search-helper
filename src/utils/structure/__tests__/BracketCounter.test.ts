import { BracketCounter } from '../BracketCounter';

describe('BracketCounter', () => {
  describe('countCurlyBrackets', () => {
    it('should count brackets correctly in a simple line', () => {
      const line = 'function test() { return true; }';
      const result = BracketCounter.countCurlyBrackets(line);
      
      expect(result.open).toBe(1);
      expect(result.close).toBe(1);
      expect(result.balanced).toBe(true);
      expect(result.depth).toBe(1);
    });

    it('should handle multiple brackets', () => {
      const line = 'if (condition) { if (other) { doSomething(); } }';
      const result = BracketCounter.countCurlyBrackets(line);
      
      expect(result.open).toBe(2);
      expect(result.close).toBe(2);
      expect(result.balanced).toBe(true);
      expect(result.depth).toBe(2);
    });

    it('should handle unbalanced brackets', () => {
      const line = 'function test() { return true;';
      const result = BracketCounter.countCurlyBrackets(line);
      
      expect(result.open).toBe(1);
      expect(result.close).toBe(0);
      expect(result.balanced).toBe(false);
      expect(result.depth).toBe(1);
    });

    it('should handle reverse unbalanced brackets', () => {
      const line = 'return true; }';
      const result = BracketCounter.countCurlyBrackets(line);
      
      expect(result.open).toBe(0);
      expect(result.close).toBe(1);
      expect(result.balanced).toBe(false);
      expect(result.depth).toBe(0);
    });

    it('should handle empty string', () => {
      const line = '';
      const result = BracketCounter.countCurlyBrackets(line);
      
      expect(result.open).toBe(0);
      expect(result.close).toBe(0);
      expect(result.balanced).toBe(true);
      expect(result.depth).toBe(0);
    });

    it('should handle string without brackets', () => {
      const line = 'const x = 5;';
      const result = BracketCounter.countCurlyBrackets(line);
      
      expect(result.open).toBe(0);
      expect(result.close).toBe(0);
      expect(result.balanced).toBe(true);
      expect(result.depth).toBe(0);
    });

    it('should handle nested brackets correctly', () => {
      const line = '{ { { } } }';
      const result = BracketCounter.countCurlyBrackets(line);
      
      expect(result.open).toBe(3);
      expect(result.close).toBe(3);
      expect(result.balanced).toBe(true);
      expect(result.depth).toBe(3);
    });

    it('should handle brackets in strings', () => {
      const line = 'const str = "{ not a bracket }"; { real bracket }';
      const result = BracketCounter.countCurlyBrackets(line);
      
      expect(result.open).toBe(2);
      expect(result.close).toBe(2);
      expect(result.balanced).toBe(true);
      expect(result.depth).toBe(1);
    });
  });

  describe('calculateMaxNestingDepth', () => {
    it('should calculate depth for mixed brackets', () => {
      const content = 'function test() { if (condition) { return [1, 2]; } }';
      const result = BracketCounter.calculateMaxNestingDepth(content);
      
      expect(result).toBe(3); // { -> ( -> { -> [ -> ]
    });

    it('should handle empty content', () => {
      const content = '';
      const result = BracketCounter.calculateMaxNestingDepth(content);
      
      expect(result).toBe(0);
    });

    it('should handle content without brackets', () => {
      const content = 'const x = 5;\nconst y = 10;';
      const result = BracketCounter.calculateMaxNestingDepth(content);
      
      expect(result).toBe(0);
    });

    it('should handle deeply nested brackets', () => {
      const content = '{{{{{{}}}}}}';
      const result = BracketCounter.calculateMaxNestingDepth(content);
      
      expect(result).toBe(6);
    });

    it('should handle mixed bracket types', () => {
      const content = '({[()]})';
      const result = BracketCounter.calculateMaxNestingDepth(content);
      
      expect(result).toBe(4);
    });

    it('should handle unbalanced brackets gracefully', () => {
      const content = '{{{';
      const result = BracketCounter.calculateMaxNestingDepth(content);
      
      expect(result).toBe(3);
    });

    it('should handle reverse unbalanced brackets gracefully', () => {
      const content = '}}}';
      const result = BracketCounter.calculateMaxNestingDepth(content);
      
      expect(result).toBe(0);
    });
  });

  describe('areBracketsBalanced', () => {
    it('should return true for balanced brackets', () => {
      const content = 'function test() { if (condition) { return [1, 2]; } }';
      const result = BracketCounter.areBracketsBalanced(content);
      
      expect(result).toBe(true);
    });

    it('should return false for unbalanced curly brackets', () => {
      const content = 'function test() { if (condition) { return [1, 2]; ';
      const result = BracketCounter.areBracketsBalanced(content);
      
      expect(result).toBe(false);
    });

    it('should return false for unbalanced parentheses', () => {
      const content = 'function test( { return true; }';
      const result = BracketCounter.areBracketsBalanced(content);
      
      expect(result).toBe(false);
    });

    it('should return false for unbalanced square brackets', () => {
      const content = 'const arr = [1, 2, 3;';
      const result = BracketCounter.areBracketsBalanced(content);
      
      expect(result).toBe(false);
    });

    it('should handle empty content', () => {
      const content = '';
      const result = BracketCounter.areBracketsBalanced(content);
      
      expect(result).toBe(true);
    });

    it('should handle content without brackets', () => {
      const content = 'const x = 5;\nconst y = 10;';
      const result = BracketCounter.areBracketsBalanced(content);
      
      expect(result).toBe(true);
    });

    it('should handle mismatched bracket types', () => {
      const content = 'function test() { return [1, 2)]; }';
      const result = BracketCounter.areBracketsBalanced(content);
      
      expect(result).toBe(false);
    });

    it('should handle correctly ordered but mismatched brackets', () => {
      const content = '(]';
      const result = BracketCounter.areBracketsBalanced(content);
      
      expect(result).toBe(false);
    });

    it('should handle complex nested structures', () => {
      const content = `
        function complexFunction(param1, param2) {
          if (param1 > 0) {
            const result = param1.map(item => {
              return [item, param2[item]];
            });
            return result;
          } else {
            return [];
          }
        }
      `;
      const result = BracketCounter.areBracketsBalanced(content);
      
      expect(result).toBe(true);
    });
  });
});