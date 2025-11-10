/**
 * ComplexityCalculator集成测试
 * 测试嵌套深度分析功能和语言特定的复杂度计算
 */

import { ComplexityCalculator } from '../ComplexityCalculator';

describe('ComplexityCalculator Integration Tests', () => {
  describe('嵌套深度分析功能', () => {
    test('应该正确计算Python代码的缩进深度', () => {
      // 生成测试代码的函数
      function generatePythonCodeWithIndentDepth(depth: number): string {
        let code = 'def main():\n';
        let currentIndent = '';
        
        for (let i = 0; i < depth; i++) {
          currentIndent += '    ';
          code += `${currentIndent}if condition_${i}:\n`;
          code += `${currentIndent}    pass\n`;
        }
        
        return code;
      }

      // 测试不同深度的Python代码
      for (let depth = 1; depth <= 5; depth++) {
        const pythonCode = generatePythonCodeWithIndentDepth(depth);
        const result = ComplexityCalculator.calculateIndentBasedComplexity(pythonCode);
        
        // PythonIndentChecker计算缩进深度时，def main()是第0层，第一个if是第1层，pass是第2层
        // 所以最大深度应该是depth + 1
        expect(result.analysis.maxIndentDepth).toBe(depth + 1);
        expect(result.score).toBeGreaterThan(depth * 3); // 基于pythonIndentWeight=3
      }
    });

    test('应该正确计算JavaScript代码的括号嵌套深度', () => {
      // 生成测试代码的函数
      function generateJSCodeWithNestingDepth(depth: number): string {
        let code = 'function main() {\n';
        let currentIndent = '';
        
        for (let i = 0; i < depth; i++) {
          currentIndent += '  ';
          code += `${currentIndent}if (condition_${i}) {\n`;
          code += `${currentIndent}  // do something\n`;
        }
        
        for (let i = 0; i < depth; i++) {
          code += `${currentIndent}}\n`;
          currentIndent = currentIndent.slice(0, -2);
        }
        
        return code + '}';
      }

      // 测试不同深度的JavaScript代码
      for (let depth = 1; depth <= 5; depth++) {
        const jsCode = generateJSCodeWithNestingDepth(depth);
        const result = ComplexityCalculator.calculateBracketBasedComplexity(jsCode);
        
        expect(result.analysis.maxNestingDepth).toBe(depth + 1); // +1 for the main function
        expect(result.score).toBeGreaterThan((depth + 1) * 4); // 基于nestingDepthWeight=4
      }
    });

    test('应该能够根据语言参数使用缩进分析', () => {
      const pythonCode = `
def calculate_sum(numbers):
  total = 0
  for num in numbers:
      if num > 0:
          total += num
  return total
`;

      const result = ComplexityCalculator.calculateCodeComplexityWithLanguage(pythonCode, 'python', {
        enableNestingAnalysis: true
      });

      // calculate_sum函数是第0层，for循环是第1层，if语句是第2层
      // 但PythonIndentChecker使用4个空格为1个层级，所以实际深度是2
      expect(result.analysis.maxIndentDepth).toBe(2); // 函数和for循环/if语句
      expect(result.score).toBeGreaterThan(0);
    });

    test('应该能够根据语言参数使用括号分析', () => {
      const jsCode = `
function calculateSum(numbers) {
let total = 0;
for (const num of numbers) {
  if (num > 0) {
    total += num;
  }
}
return total;
}
`;

      const result = ComplexityCalculator.calculateCodeComplexityWithLanguage(jsCode, 'javascript', {
        enableNestingAnalysis: true
      });

      expect(result.analysis.maxNestingDepth).toBe(3); // 函数、for循环、if语句
      expect(result.score).toBeGreaterThan(0);
    });

    test('当没有提供语言参数时应该使用通用复杂度计算', () => {
      const code = `
function calculateSum(numbers) {
return numbers.reduce((sum, num) => sum + num, 0);
}
`;

      const result = ComplexityCalculator.calculateCodeComplexity(code);

      // 通用复杂度计算不包含特定语言的深度分析
      expect(result.analysis.maxIndentDepth).toBeUndefined();
      expect(result.analysis.maxNestingDepth).toBeUndefined();
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('语言特定的复杂度计算', () => {
    test('calculateIndentBasedComplexity应该包含缩进特定的分析', () => {
      const pythonCode = `
def example():
  """这是一个示例函数"""
  if True:
      print("Hello")
  return None
`;

      const result = ComplexityCalculator.calculateIndentBasedComplexity(pythonCode);

      // example函数是第0层，if语句是第1层，print语句是第2层
      // 但PythonIndentChecker使用4个空格为1个层级，所以实际深度是1
      expect(result.analysis.maxIndentDepth).toBe(1);
      expect(result.score).toBeGreaterThan(0);
    });

    test('calculateBracketBasedComplexity应该包含括号特定的分析', () => {
      const jsCode = `
async function fetchData() {
try {
  const response = await fetch('/api/data');
  const data = await response.json();
  return data?.items ?? [];
} catch (error) {
  console.error('Error:', error);
  return null;
}
}
`;

      const result = ComplexityCalculator.calculateBracketBasedComplexity(jsCode);

      expect(result.analysis.bracketCount).toBeGreaterThan(0);
      expect(result.analysis.maxNestingDepth).toBeGreaterThan(0);
    });
  });

  describe('复杂度比较功能', () => {
    test('应该能够比较不同代码的复杂度', () => {
      const simpleCode = 'function add(a, b) { return a + b; }';
      const complexCode = `
function processData(data) {
  if (data && data.items && data.items.length > 0) {
    const processed = data.items.map(item => {
      if (item.isValid && item.value !== null) {
        return {
          id: item.id,
          value: item.value * 2,
          timestamp: new Date()
        };
      }
      return null;
    }).filter(item => item !== null);
    
    return processed.sort((a, b) => a.timestamp - b.timestamp);
  }
  return [];
}
`;

      const comparison = ComplexityCalculator.compareComplexity(simpleCode, complexCode);

      expect(comparison.moreComplex).toBe('content2');
      expect(comparison.difference).toBeGreaterThan(0);
      expect(comparison.content1.score).toBeLessThan(comparison.content2.score);
    });

    test('应该能够识别相同复杂度的代码', () => {
      const code1 = 'function test() { return 1; }';
      const code2 = 'function test() { return 2; }';

      const comparison = ComplexityCalculator.compareComplexity(code1, code2);

      expect(comparison.moreComplex).toBe('equal');
      expect(comparison.difference).toBe(0);
    });
  });

  describe('配置选项测试', () => {
    test('应该能够自定义嵌套深度权重', () => {
      const pythonCode = `
def nested_function():
  if True:
      print("nested")
`;

      const resultWithLowWeight = ComplexityCalculator.calculateIndentBasedComplexity(pythonCode, {
        pythonIndentWeight: 1
      });

      const resultWithHighWeight = ComplexityCalculator.calculateIndentBasedComplexity(pythonCode, {
        pythonIndentWeight: 10
      });

      expect(resultWithHighWeight.score).toBeGreaterThan(resultWithLowWeight.score);
    });
  });

  describe('边界情况测试', () => {
    test('应该处理空代码', () => {
      const result = ComplexityCalculator.calculateCodeComplexity('');
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.analysis).toBeDefined();
    });

    test('应该处理只有注释的代码', () => {
      const commentCode = `
# This is a Python comment
# Another comment
# And another one
`;

      const result = ComplexityCalculator.calculateIndentBasedComplexity(commentCode);
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.analysis).toBeDefined();
    });

    test('应该处理只有空格的代码', () => {
      const spaceCode = '     \n    \n  \n';
      
      const result = ComplexityCalculator.calculateCodeComplexity(spaceCode);
      
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.analysis).toBeDefined();
    });
  });
});