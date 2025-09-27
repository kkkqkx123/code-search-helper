import { SnippetValidationService } from '../analysis/SnippetValidationService';
import { SnippetMetadata } from '../types';

describe('SnippetValidationService', () => {
  describe('enhancedIsValidSnippet', () => {
    it('应该拒绝过短的代码片段', () => {
      const result = SnippetValidationService.enhancedIsValidSnippet(
        'a',
        'control_structure',
        'typescript'
      );
      expect(result).toBe(false);
    });

    it('应该拒绝过长的代码片段', () => {
      const longCode = 'a'.repeat(2000);
      const result = SnippetValidationService.enhancedIsValidSnippet(
        longCode,
        'control_structure',
        'typescript'
      );
      expect(result).toBe(false);
    });

    it('应该拒绝无意义的代码片段', () => {
      const result = SnippetValidationService.enhancedIsValidSnippet(
        '{ } ;',
        'control_structure',
        'typescript'
      );
      expect(result).toBe(false);
    });

    it('应该接受有效的控制结构片段', () => {
      const code = `if (condition) {
  console.log('Hello');
}`;
      const result = SnippetValidationService.enhancedIsValidSnippet(
        code,
        'control_structure',
        'typescript'
      );
      expect(result).toBe(true);
    });

    it('应该拒绝不包含控制结构关键字的代码', () => {
      const code = `console.log('Hello');`;
      const result = SnippetValidationService.enhancedIsValidSnippet(
        code,
        'control_structure',
        'typescript'
      );
      expect(result).toBe(false);
    });
  });

  describe('hasMeaningfulLogic', () => {
    it('应该检测TypeScript代码中的有意义逻辑', () => {
      const code = `const x = 5;
if (x > 3) {
  console.log('Greater');
}`;
      const result = SnippetValidationService.hasMeaningfulLogic(code, 'typescript');
      expect(result).toBe(true);
    });

    it('应该检测JavaScript代码中的有意义逻辑', () => {
      const code = `function test() {
  return true;
}`;
      const result = SnippetValidationService.hasMeaningfulLogic(code, 'javascript');
      expect(result).toBe(true);
    });

    it('应该拒绝无意义的代码', () => {
      const code = `// This is a comment
/* Another comment */`;
      const result = SnippetValidationService.hasMeaningfulLogic(code, 'typescript');
      expect(result).toBe(false);
    });
  });

  describe('meetsComplexityThreshold', () => {
    it('应该接受满足复杂度阈值的代码', () => {
      const code = `if (condition) {
  console.log('Hello');
  return true;
}`;
      const result = SnippetValidationService.meetsComplexityThreshold(code);
      expect(result).toBe(true);
    });

    it('应该拒绝过于简单的代码', () => {
      const code = `console.log('test');`;
      const result = SnippetValidationService.meetsComplexityThreshold(code, 3, 30);
      expect(result).toBe(false);
    });
  });

  describe('hasCodeDiversity', () => {
    it('应该接受具有代码多样性的片段', () => {
      const code = `const x = 5;
const y = x + 1;
console.log(y);`;
      const result = SnippetValidationService.hasCodeDiversity(code);
      expect(result).toBe(true);
    });

    it('应该拒绝缺乏多样性的代码', () => {
      const code = `test test test test`;
      const result = SnippetValidationService.hasCodeDiversity(code);
      expect(result).toBe(false);
    });
  });

  describe('isTooSimple', () => {
    it('应该拒绝过于简单的控制结构', () => {
      const code = `if (true) return;`;
      const result = SnippetValidationService.isTooSimple(code, 'control_structure');
      expect(result).toBe(true);
    });

    it('应该接受适当的控制结构', () => {
      const code = `if (condition) {
  console.log('Hello');
  return true;
}`;
      const result = SnippetValidationService.isTooSimple(code, 'control_structure');
      expect(result).toBe(false);
    });
  });

  describe('hasSideEffects', () => {
    it('应该检测赋值操作的副作用', () => {
      const code = `x = 5;`;
      const result = SnippetValidationService.hasSideEffects(code);
      expect(result).toBe(true);
    });

    it('应该检测递增操作的副作用', () => {
      const code = `x++;`;
      const result = SnippetValidationService.hasSideEffects(code);
      expect(result).toBe(true);
    });

    it('应该检测console.log的副作用', () => {
      const code = `console.log('test');`;
      const result = SnippetValidationService.hasSideEffects(code);
      expect(result).toBe(true);
    });

    it('不应该将纯函数调用视为副作用', () => {
      const code = `Math.max(1, 2);`;
      const result = SnippetValidationService.hasSideEffects(code);
      expect(result).toBe(false);
    });
  });

  describe('analyzeLanguageFeatures', () => {
    it('应该检测async/await特性', () => {
      const code = `async function test() {
  await Promise.resolve();
}`;
      const result = SnippetValidationService.analyzeLanguageFeatures(code);
      expect(result.usesAsync).toBe(true);
    });

    it('应该检测解构赋值', () => {
      const code = `const { a, b } = obj;`;
      const result = SnippetValidationService.analyzeLanguageFeatures(code);
      expect(result.usesDestructuring).toBe(true);
    });
  });

  describe('calculateComplexity', () => {
    it('应该正确计算简单代码的复杂度', () => {
      const code = `console.log('test');`;
      const result = SnippetValidationService.calculateComplexity(code);
      expect(result).toBe(2); // 基础复杂度1 + 括号1 + 函数调用0.3 ≈ 2.3 → 2
    });

    it('应该正确计算复杂代码的复杂度', () => {
      const code = `if (condition) {
  for (let i = 0; i < 10; i++) {
    console.log(i);
  }
}`;
      const result = SnippetValidationService.calculateComplexity(code);
      expect(result).toBeGreaterThan(3);
    });
  });

  describe('isStandaloneSnippet', () => {
    it('应该识别独立的控制结构', () => {
      const code = `if (condition) {
  console.log('test');
}`;
      const result = SnippetValidationService.isStandaloneSnippet(code, 'control_structure');
      expect(result).toBe(true);
    });

    it('应该识别不完整的表达式', () => {
      const code = `if (condition)`;
      const result = SnippetValidationService.isStandaloneSnippet(code, 'control_structure');
      expect(result).toBe(false);
    });
  });
});
