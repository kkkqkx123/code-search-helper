/**
 * CodeStructureValidator集成测试
 * 测试Python结构验证功能和缩进一致性检查
 */

import { CodeStructureValidator } from '../CodeStructureValidator';
import { LineLocation } from '../index';

describe('CodeStructureValidator Integration Tests', () => {
  const mockLocation: LineLocation = {
    startLine: 1,
    endLine: 10
  };

  describe('Python结构验证', () => {
    test('应该验证有效的Python代码结构', () => {
      const validPythonCode = `
def calculate_sum(numbers):
    """计算数字列表的总和"""
    total = 0
    for num in numbers:
        if num > 0:
            total += num
    return total

class Calculator:
    """简单的计算器类"""
    def __init__(self):
        self.result = 0
    
    def add(self, value):
        self.result += value
        return self.result
`;

      const result = CodeStructureValidator.validatePythonStructure(
        validPythonCode,
        mockLocation,
        {
          requireConsistentIndent: true,
          allowMixedIndent: false,
          validatePythonSyntax: true,
          validateCodeQuality: true,
          requireDocstrings: true
        }
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toBeUndefined();
      expect(result.indentAnalysis).toBeDefined();
      expect(result.indentAnalysis?.isConsistent).toBe(true);
      expect(result.indentAnalysis?.indentType).toBe('spaces');
      expect(result.pythonSpecific).toBeDefined();
      expect(result.pythonSpecific?.hasDocstrings).toBe(true);
    });

    test('应该检测缩进不一致的Python代码', () => {
      const inconsistentIndentCode = `
def example():
    print("four spaces")
	print("tab")  # 这里使用了tab而不是空格
        print("eight spaces")  # 这里使用了8个空格
    return "inconsistent"
`;

      const result = CodeStructureValidator.validatePythonStructure(
        inconsistentIndentCode,
        mockLocation,
        {
          requireConsistentIndent: true,
          allowMixedIndent: false
        }
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.some(error => 
        error.includes('inconsistent indentation') || 
        error.includes('mixed indentation')
      )).toBe(true);
      expect(result.indentAnalysis?.isConsistent).toBe(false);
    });

    test('应该检测Python语法错误', () => {
      const syntaxErrorCode = `
def broken_function()
    print("缺少冒号")
    
if True
    print("缺少冒号")
`;

      const result = CodeStructureValidator.validatePythonStructure(
        syntaxErrorCode,
        mockLocation,
        {
          validatePythonSyntax: true
        }
      );

      expect(result.isValid).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.pythonSpecific?.syntaxIssues.length).toBeGreaterThan(0);
    });

    test('应该检测代码质量问题', () => {
      const qualityIssuesCode = `
def long_line_function():
    # 这一行超过了79个字符的限制，根据PEP 8规范，行长度不应该超过79个字符
    return "This is a very long line that exceeds the recommended 79 character limit"


def function_with_too_many_empty_lines():



    return "too many empty lines"
`;

      const result = CodeStructureValidator.validatePythonStructure(
        qualityIssuesCode,
        mockLocation,
        {
          validateCodeQuality: true
        }
      );

      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(0);
      expect(result.pythonSpecific?.qualityIssues.length).toBeGreaterThan(0);
    });

    test('应该检测缺少文档字符串的函数和类', () => {
      const noDocstringsCode = `
def function_without_docstring():
    return "no docstring"

class ClassWithoutDocstring:
    def method_without_docstring(self):
        pass
`;

      const result = CodeStructureValidator.validatePythonStructure(
        noDocstringsCode,
        mockLocation,
        {
          requireDocstrings: true
        }
      );

      expect(result.pythonSpecific?.hasDocstrings).toBe(false);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(warning => 
        warning.includes('docstrings')
      )).toBe(true);
    });
  });

  describe('缩进类型测试', () => {
    test('应该正确识别空格缩进', () => {
      function generatePythonCodeWithIndentType(type: 'spaces' | 'tabs' | 'mixed'): string {
        const baseCode = 'def example():\n';
        
        switch (type) {
          case 'spaces':
            return baseCode + '    print("spaces")\n';
          case 'tabs':
            return baseCode.replace('    ', '\t') + '\tprint("tabs")\n';
          case 'mixed':
            return baseCode + '\tprint("mixed")\n';
        }
      }

      const spacesCode = generatePythonCodeWithIndentType('spaces');
      const result = CodeStructureValidator.validatePythonStructure(spacesCode, mockLocation);

      expect(result.indentAnalysis?.indentType).toBe('spaces');
      expect(result.indentAnalysis?.isConsistent).toBe(true);
    });

    test('应该正确识别制表符缩进', () => {
      function generatePythonCodeWithIndentType(type: 'spaces' | 'tabs' | 'mixed'): string {
        const baseCode = 'def example():\n';
        
        switch (type) {
          case 'spaces':
            return baseCode + '    print("spaces")\n';
          case 'tabs':
            return baseCode.replace('    ', '\t') + '\tprint("tabs")\n';
          case 'mixed':
            return baseCode + '\tprint("mixed")\n';
        }
      }

      const tabsCode = generatePythonCodeWithIndentType('tabs');
      const result = CodeStructureValidator.validatePythonStructure(tabsCode, mockLocation);

      expect(result.indentAnalysis?.indentType).toBe('tabs');
      expect(result.indentAnalysis?.isConsistent).toBe(true);
    });

    test('应该正确识别混合缩进', () => {
      function generatePythonCodeWithIndentType(type: 'spaces' | 'tabs' | 'mixed'): string {
        const baseCode = 'def example():\n';
        
        switch (type) {
          case 'spaces':
            return baseCode + '    print("spaces")\n';
          case 'tabs':
            return baseCode.replace('    ', '\t') + '\tprint("tabs")\n';
          case 'mixed':
            // 创建真正的混合缩进：第一行用空格，第二行用制表符
            return baseCode + '    print("spaces")\n\tprint("tabs")\n';
        }
      }

      const mixedCode = generatePythonCodeWithIndentType('mixed');
      const result = CodeStructureValidator.validatePythonStructure(mixedCode, mockLocation, {
        allowMixedIndent: false
      });

      expect(result.indentAnalysis?.indentType).toBe('mixed');
      expect(result.isValid).toBe(false);
      expect(result.errors?.some(error => error.includes('mixed indentation'))).toBe(true);
    });
  });

  describe('嵌套深度测试', () => {
    test('应该检测过深的嵌套', () => {
      const deepNestingCode = `
def level_1():
    if True:
        def level_2():
            if True:
                def level_3():
                    if True:
                        def level_4():
                            if True:
                                def level_5():
                                    return "too deep"
                                return level_5()
                            return level_4()
                        return level_3()
                    return level_2()
            return level_1()
`;

      const result = CodeStructureValidator.validatePythonStructure(
        deepNestingCode,
        mockLocation,
        {
          maxIndentDepth: 4
        }
      );

      expect(result.indentAnalysis?.maxDepth).toBeGreaterThan(4);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some(warning => 
        warning.includes('deep nesting')
      )).toBe(true);
    });
  });

  describe('配置选项测试', () => {
    test('应该允许禁用某些验证', () => {
      const problematicCode = `
def bad_function():
	print("tab indent")
    return "mixed indent"
`;

      const resultWithAllValidations = CodeStructureValidator.validatePythonStructure(
        problematicCode,
        mockLocation,
        {
          requireConsistentIndent: true,
          allowMixedIndent: false,
          validatePythonSyntax: true,
          validateCodeQuality: true
        }
      );

      const resultWithDisabledValidations = CodeStructureValidator.validatePythonStructure(
        problematicCode,
        mockLocation,
        {
          requireConsistentIndent: false,
          allowMixedIndent: true,
          validatePythonSyntax: false,
          validateCodeQuality: false
        }
      );

      expect(resultWithAllValidations.isValid).toBe(false);
      expect(resultWithDisabledValidations.isValid).toBe(true);
    });

    test('应该允许自定义最大缩进深度', () => {
      const moderatelyNestedCode = `
def level_1():
    if True:
        def level_2():
            if True:
                return "moderately nested"
`;

      const resultWithStrictDepth = CodeStructureValidator.validatePythonStructure(
        moderatelyNestedCode,
        mockLocation,
        {
          maxIndentDepth: 2
        }
      );

      const resultWithLenientDepth = CodeStructureValidator.validatePythonStructure(
        moderatelyNestedCode,
        mockLocation,
        {
          maxIndentDepth: 5
        }
      );

      expect(resultWithStrictDepth.warnings?.some(warning =>
        warning.includes('deep nesting')
      )).toBe(true);

      expect(resultWithLenientDepth.warnings?.some(warning =>
        warning.includes('deep nesting')
      ) || false).toBe(false);
    });
  });

  describe('边界情况测试', () => {
    test('应该处理空代码', () => {
      const result = CodeStructureValidator.validatePythonStructure('', mockLocation);
      
      expect(result.isValid).toBe(false);
      expect(result.errors?.some(error => error.includes('empty'))).toBe(true);
    });

    test('应该处理只有注释的代码', () => {
      const commentCode = `
# This is a comment
# Another comment
# And another one
`;

      const result = CodeStructureValidator.validatePythonStructure(commentCode, mockLocation);
      
      expect(result.isValid).toBe(true);
      expect(result.indentAnalysis).toBeDefined();
    });

    test('应该处理单行代码', () => {
      const singleLineCode = 'print("Hello, World!")';
      
      const result = CodeStructureValidator.validatePythonStructure(
        singleLineCode,
        { startLine: 1, endLine: 1 }
      );
      
      expect(result.isValid).toBe(true);
      expect(result.indentAnalysis?.maxDepth).toBe(0);
    });
  });

  describe('增强验证结果测试', () => {
    test('应该返回完整的增强验证结果', () => {
      const pythonCode = `
def example():
    """示例函数"""
    if True:
        print("Hello")
    return None
`;

      const result = CodeStructureValidator.validatePythonStructure(pythonCode, mockLocation);

      // 检查基本验证结果
      expect(result.isValid).toBeDefined();
      // errors和warnings可能是undefined，这是正常的
      expect(result.details).toBeDefined();

      // 检查缩进分析结果
      expect(result.indentAnalysis).toBeDefined();
      expect(result.indentAnalysis?.indentType).toBeDefined();
      expect(result.indentAnalysis?.isConsistent).toBeDefined();
      expect(result.indentAnalysis?.maxDepth).toBeDefined();
      expect(result.indentAnalysis?.averageIndentSize).toBeDefined();

      // 检查Python特定验证结果
      expect(result.pythonSpecific).toBeDefined();
      expect(result.pythonSpecific?.hasDocstrings).toBeDefined();
      expect(result.pythonSpecific?.syntaxIssues).toBeDefined();
      expect(result.pythonSpecific?.qualityIssues).toBeDefined();
    });
  });
});