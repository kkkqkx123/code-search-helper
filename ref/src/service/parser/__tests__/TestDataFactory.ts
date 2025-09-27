/**
 * 测试数据工厂
 * 为tree-sitter规则测试提供标准化的测试用例和数据生成
 */

import { SnippetMetadata } from '../types';

export interface TestCase {
  name: string;
  code: string;
  expectedValid: boolean;
  snippetType: SnippetMetadata['snippetType'];
  expectedMetadata?: Partial<SnippetMetadata>;
}

export interface RuleTestCases {
  validCases: TestCase[];
  invalidCases: TestCase[];
  boundaryCases: TestCase[];
}

export class TestDataFactory {
  /**
   * 创建控制结构测试用例
   */
  static createControlStructureTestCases(): RuleTestCases {
    return {
      validCases: [
        {
          name: '有意义的if语句',
          code: 'if (user.isAuthenticated && user.hasPermission("read")) {\n  const data = await fetchUserData(user.id);\n  return processData(data);\n}',
          expectedValid: true,
          snippetType: 'control_structure',
          expectedMetadata: {
            complexity: 4,
            hasSideEffects: true,
            isStandalone: true,
          },
        },
        {
          name: '复杂的for循环',
          code: 'for (let i = 0; i < array.length; i++) {\n  if (array[i] > threshold) {\n    results.push(processItem(array[i]));\n  }\n}',
          expectedValid: true,
          snippetType: 'control_structure',
          expectedMetadata: {
            complexity: 5,
            hasSideEffects: true,
            isStandalone: true,
          },
        },
      ],
      invalidCases: [
        {
          name: '过于简单的if语句',
          code: 'if (true) console.log("hello");',
          expectedValid: false,
          snippetType: 'control_structure',
        },
        {
          name: '空代码块',
          code: 'if (condition) {}',
          expectedValid: false,
          snippetType: 'control_structure',
        },
      ],
      boundaryCases: [
        {
          name: '最小有效if语句',
          code: 'if (x > 0) { return x; }',
          expectedValid: true,
          snippetType: 'control_structure',
          expectedMetadata: {
            complexity: 2,
            hasSideEffects: false,
            isStandalone: true,
          },
        },
      ],
    };
  }

  /**
   * 创建错误处理测试用例
   */
  static createErrorHandlingTestCases(): RuleTestCases {
    return {
      validCases: [
        {
          name: '完整的try-catch',
          code: 'try {\n  const data = JSON.parse(jsonString);\n  return processData(data);\n} catch (error) {\n  console.error("解析失败:", error);\n  throw new Error("数据格式错误");\n}',
          expectedValid: true,
          snippetType: 'error_handling',
          expectedMetadata: {
            complexity: 4,
            hasSideEffects: true,
            isStandalone: true,
          },
        },
      ],
      invalidCases: [
        {
          name: '空的try-catch',
          code: 'try {} catch (e) {}',
          expectedValid: false,
          snippetType: 'error_handling',
        },
      ],
      boundaryCases: [
        {
          name: '最小有效错误处理',
          code: 'try {\n  riskyOperation();\n} catch (error) {\n  handleError(error);\n}',
          expectedValid: true,
          snippetType: 'error_handling',
          expectedMetadata: {
            complexity: 2,
            hasSideEffects: true,
            isStandalone: true,
          },
        },
      ],
    };
  }

  /**
   * 创建函数调用链测试用例
   */
  static createFunctionCallChainTestCases(): RuleTestCases {
    return {
      validCases: [
        {
          name: '有意义的函数链',
          code: 'const result = userService\n  .findById(userId)\n  .then(user => user.validate())\n  .then(validUser => validUser.save())\n  .catch(error => handleError(error));',
          expectedValid: true,
          snippetType: 'function_call_chain',
          expectedMetadata: {
            complexity: 6,
            hasSideEffects: true,
            isStandalone: true,
          },
        },
      ],
      invalidCases: [
        {
          name: '过于简单的链式调用',
          code: 'obj.method().another();',
          expectedValid: false,
          snippetType: 'function_call_chain',
        },
      ],
      boundaryCases: [
        {
          name: '最小有效链式',
          code: 'result = obj.method().process();',
          expectedValid: true,
          snippetType: 'function_call_chain',
          expectedMetadata: {
            complexity: 2,
            hasSideEffects: false,
            isStandalone: true,
          },
        },
      ],
    };
  }

  /**
   * 创建算术逻辑表达式测试用例
   */
  static createArithmeticLogicalTestCases(): RuleTestCases {
    return {
      validCases: [
        {
          name: '复杂逻辑表达式',
          code: 'const result = (a > 0 && b < 10) || (c === "valid" && d !== null) && checkStatus();',
          expectedValid: true,
          snippetType: 'arithmetic_logical_expression',
          expectedMetadata: {
            complexity: 5,
            hasSideEffects: false,
            isStandalone: true,
          },
        },
      ],
      invalidCases: [
        {
          name: '过于简单的表达式',
          code: 'x + y',
          expectedValid: false,
          snippetType: 'arithmetic_logical_expression',
        },
      ],
      boundaryCases: [
        {
          name: '边界复杂度表达式',
          code: 'result = a + b * c;',
          expectedValid: true,
          snippetType: 'arithmetic_logical_expression',
          expectedMetadata: {
            complexity: 2,
            hasSideEffects: false,
            isStandalone: true,
          },
        },
      ],
    };
  }

  /**
   * 创建对象和数组字面量测试用例
   */
  static createObjectArrayLiteralTestCases(): RuleTestCases {
    return {
      validCases: [
        {
          name: '复杂对象字面量',
          code: 'const config = {\n  api: {\n    baseUrl: "https://api.example.com",\n    timeout: 5000,\n    retry: 3\n  },\n  features: ["auth", "cache", "logging"],\n  enabled: true\n};',
          expectedValid: true,
          snippetType: 'object_array_literal',
          expectedMetadata: {
            complexity: 4,
            hasSideEffects: false,
            isStandalone: true,
          },
        },
      ],
      invalidCases: [
        {
          name: '过于简单的对象',
          code: '{}',
          expectedValid: false,
          snippetType: 'object_array_literal',
        },
      ],
      boundaryCases: [
        {
          name: '最小有效对象',
          code: '{ key: "value" }',
          expectedValid: true,
          snippetType: 'object_array_literal',
          expectedMetadata: {
            complexity: 1,
            hasSideEffects: false,
            isStandalone: true,
          },
        },
      ],
    };
  }

  /**
   * 创建模板字面量测试用例
   */
  static createTemplateLiteralTestCases(): RuleTestCases {
    return {
      validCases: [
        {
          name: '复杂模板字面量',
          code: 'const message = `Hello ${user.name}, your order ${order.id} has been ${order.status}. Total: ${order.total}`;',
          expectedValid: true,
          snippetType: 'template_literal',
          expectedMetadata: {
            complexity: 3,
            hasSideEffects: false,
            isStandalone: true,
          },
        },
      ],
      invalidCases: [
        {
          name: '简单模板',
          code: '`Hello ${name}`',
          expectedValid: false,
          snippetType: 'template_literal',
        },
      ],
      boundaryCases: [
        {
          name: '最小有效模板',
          code: '`Value: ${value}`',
          expectedValid: true,
          snippetType: 'template_literal',
          expectedMetadata: {
            complexity: 1,
            hasSideEffects: false,
            isStandalone: true,
          },
        },
      ],
    };
  }

  /**
   * 创建注释标记测试用例
   */
  static createCommentMarkedTestCases(): RuleTestCases {
    return {
      validCases: [
        {
          name: '有意义的注释代码',
          code: '// 计算用户权限\nconst permissions = calculatePermissions(user);\nif (permissions.canWrite) {\n  // 执行写操作\n  writeData(data);\n}',
          expectedValid: true,
          snippetType: 'comment_marked',
          expectedMetadata: {
            complexity: 3,
            hasSideEffects: true,
            isStandalone: true,
          },
        },
      ],
      invalidCases: [
        {
          name: '仅注释',
          code: '// This is just a comment',
          expectedValid: false,
          snippetType: 'comment_marked',
        },
      ],
      boundaryCases: [
        {
          name: '平衡注释代码',
          code: '// 处理数据\nprocessData(data);',
          expectedValid: true,
          snippetType: 'comment_marked',
          expectedMetadata: {
            complexity: 1,
            hasSideEffects: true,
            isStandalone: true,
          },
        },
      ],
    };
  }

  /**
   * 创建逻辑块测试用例
   */
  static createLogicBlockTestCases(): RuleTestCases {
    return {
      validCases: [
        {
          name: '复杂逻辑块',
          code: '{\n  const result = validateInput(input);\n  if (result.isValid) {\n    processValidInput(result.data);\n    logSuccess();\n  } else {\n    handleValidationError(result.errors);\n  }\n}',
          expectedValid: true,
          snippetType: 'logic_block',
          expectedMetadata: {
            complexity: 5,
            hasSideEffects: true,
            isStandalone: true,
          },
        },
      ],
      invalidCases: [
        {
          name: '空代码块',
          code: '{}',
          expectedValid: false,
          snippetType: 'logic_block',
        },
      ],
      boundaryCases: [
        {
          name: '最小有效逻辑块',
          code: '{\n  const result = process();\n  return result;\n}',
          expectedValid: true,
          snippetType: 'logic_block',
          expectedMetadata: {
            complexity: 2,
            hasSideEffects: false,
            isStandalone: true,
          },
        },
      ],
    };
  }

  /**
   * 获取所有规则类型的测试用例
   */
  static getAllRuleTestCases(): Record<string, RuleTestCases> {
    return {
      control_structure: this.createControlStructureTestCases(),
      error_handling: this.createErrorHandlingTestCases(),
      function_call_chain: this.createFunctionCallChainTestCases(),
      arithmetic_logical_expression: this.createArithmeticLogicalTestCases(),
      object_array_literal: this.createObjectArrayLiteralTestCases(),
      template_literal: this.createTemplateLiteralTestCases(),
      comment_marked: this.createCommentMarkedTestCases(),
      logic_block: this.createLogicBlockTestCases(),
    };
  }

  /**
   * 根据规则类型获取测试用例
   */
  static getTestCasesForRule(ruleType: string): RuleTestCases {
    const allCases = this.getAllRuleTestCases();
    return (
      allCases[ruleType] || {
        validCases: [],
        invalidCases: [],
        boundaryCases: [],
      }
    );
  }

  /**
   * 创建性能测试数据
   */
  static createPerformanceTestData(): {
    small: string[];
    medium: string[];
    large: string[];
  } {
    return {
      small: ['if (x > 0) return x;', 'const arr = [1, 2, 3];', 'obj.method().value'],
      medium: [
        'try {\n  const result = processData(data);\n  if (result.success) {\n    return result.value;\n  }\n} catch (error) {\n  console.error(error);\n}',
        'const config = {\n  api: { baseUrl: "http://localhost", timeout: 5000 },\n  features: ["auth", "cache"],\n  enabled: true\n};',
      ],
      large: [
        'async function handleRequest(req, res) {\n  try {\n    const user = await authenticate(req.headers.authorization);\n    if (!user) {\n      return res.status(401).json({ error: "Unauthorized" });\n    }\n    \n    const data = await fetchUserData(user.id);\n    const processed = data\n      .filter(item => item.active)\n      .map(item => ({\n        ...item,\n        processed: true,\n        timestamp: Date.now()\n      }));\n    \n    return res.json({ success: true, data: processed });\n  } catch (error) {\n    console.error("Request error:", error);\n    return res.status(500).json({ error: "Internal server error" });\n  }\n}',
      ],
    };
  }

  /**
   * 创建边界测试数据
   */
  static createBoundaryTestData(): TestCase[] {
    return [
      {
        name: '最小长度有效代码',
        code: 'if (x) { y(); }',
        expectedValid: true,
        snippetType: 'control_structure',
        expectedMetadata: { complexity: 2, hasSideEffects: true, isStandalone: true },
      },
      {
        name: '最大长度边界代码',
        code: '// 这是一个接近最大长度的代码片段\nconst result = data.filter(item => item.active)\n  .map(item => ({...item, processed: true}))\n  .reduce((acc, curr) => acc + curr.value, 0)\n  .toFixed(2);\nreturn result;',
        expectedValid: true,
        snippetType: 'arithmetic_logical_expression',
        expectedMetadata: { complexity: 4, hasSideEffects: false, isStandalone: true },
      },
      {
        name: '特殊字符处理',
        code: 'const str = "Hello \\"World\\"" + "It\'s test";',
        expectedValid: true,
        snippetType: 'arithmetic_logical_expression',
        expectedMetadata: { complexity: 1, hasSideEffects: false, isStandalone: true },
      },
      {
        name: '空代码块',
        code: '{}',
        expectedValid: false,
        snippetType: 'logic_block',
      },
      {
        name: '仅空格和分号',
        code: '   ;   ',
        expectedValid: false,
        snippetType: 'control_structure',
      },
    ];
  }
}

// Add a simple test to make Jest happy
describe('TestDataFactory', () => {
  it('should create control structure test cases', () => {
    const testCases = TestDataFactory.createControlStructureTestCases();
    expect(testCases.validCases.length).toBeGreaterThan(0);
    expect(testCases.invalidCases.length).toBeGreaterThan(0);
    expect(testCases.boundaryCases.length).toBeGreaterThan(0);
  });

  it('should create error handling test cases', () => {
    const testCases = TestDataFactory.createErrorHandlingTestCases();
    expect(testCases.validCases.length).toBeGreaterThan(0);
    expect(testCases.invalidCases.length).toBeGreaterThan(0);
    expect(testCases.boundaryCases.length).toBeGreaterThan(0);
  });
});
