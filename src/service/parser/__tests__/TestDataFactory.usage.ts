/**
 * 测试数据工厂使用示例
 * 展示如何使用TestDataFactory为规则测试提供数据
 */

import { TestDataFactory } from './TestDataFactory';

// 使用示例1：获取特定规则的测试用例
const controlStructureTests = TestDataFactory.createControlStructureTestCases();
console.log('控制结构有效用例:', controlStructureTests.validCases.length);
console.log('控制结构无效用例:', controlStructureTests.invalidCases.length);

// 使用示例2：获取所有规则测试用例
const allTests = TestDataFactory.getAllRuleTestCases();
Object.keys(allTests).forEach(ruleType => {
  const tests = allTests[ruleType];
  console.log(`${ruleType}: ${tests.validCases.length + tests.invalidCases.length} 个测试用例`);
});

// 使用示例3：性能测试数据
const performanceData = TestDataFactory.createPerformanceTestData();
console.log('性能测试数据:', {
  small: performanceData.small.length,
  medium: performanceData.medium.length,
  large: performanceData.large.length,
});

// 使用示例4：边界测试数据
const boundaryTests = TestDataFactory.createBoundaryTestData();
console.log('边界测试用例:', boundaryTests.length);

// 使用示例5：在测试中实际使用
export function runRuleTests(ruleType: string, ruleValidator: (code: string) => boolean) {
  const testCases = TestDataFactory.getTestCasesForRule(ruleType);

  testCases.validCases.forEach(testCase => {
    const result = ruleValidator(testCase.code);
    console.assert(result === testCase.expectedValid, `有效用例失败: ${testCase.name}`);
  });

  testCases.invalidCases.forEach(testCase => {
    const result = ruleValidator(testCase.code);
    console.assert(result === testCase.expectedValid, `无效用例失败: ${testCase.name}`);
  });
}

// 导出给测试文件使用
export { TestDataFactory };
