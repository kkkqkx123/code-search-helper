import { CoordinationTester } from './utils/test-coordination';

async function quickVerification() {
  console.log('C语言查询规则与适配器协调关系快速验证\n');
  
  const tester = new CoordinationTester();
  const results = await tester.runBasicTests();
  
  // 简单的问题检测
  const issues = [];
  
  results.forEach(result => {
    if (!result.success) {
      issues.push({
        type: 'coordination_failure',
        queryType: result.queryType,
        code: result.code,
        expected: result.expectedType
      });
    } else if (result.result) {
      // 检查类型映射是否正确
      if (result.result.type !== result.expectedType) {
        issues.push({
          type: 'type_mapping_mismatch',
          queryType: result.queryType,
          expected: result.expectedType,
          actual: result.result.type
        });
      }
      
      // 检查名称提取是否正确
      if (result.expectedName && result.result.name !== result.expectedName) {
        issues.push({
          type: 'name_extraction_mismatch',
          queryType: result.queryType,
          expected: result.expectedName,
          actual: result.result.name
        });
      }
    }
  });
  
  if (issues.length > 0) {
    console.log('\n发现的问题:');
    issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.type}:`);
      console.log(`   查询类型: ${issue.queryType}`);
      if (issue.code) console.log(`   代码: ${issue.code}`);
      if (issue.expected) console.log(`   期望: ${issue.expected}`);
      if (issue.actual) console.log(`   实际: ${issue.actual}`);
      console.log('');
    });
  } else {
    console.log('\n✓ 所有测试通过，未发现协调问题');
  }
  
  return issues;
}

// 如果直接运行此文件
if (require.main === module) {
  quickVerification().catch(console.error);
}

export { quickVerification };