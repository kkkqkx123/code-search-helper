import { CommentsCoordinationTester } from './utils/comments-test-coordination';

describe('C语言注释高级测试', () => {
  let tester: CommentsCoordinationTester;

  beforeAll(async () => {
    tester = new CommentsCoordinationTester();
  });

  test('注释协调测试', async () => {
    const results = await tester.runCommentTests();
    
    // 验证所有测试都通过
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    expect(successCount).toBe(totalCount);
    console.log(`注释协调测试完成: ${successCount}/${totalCount} 通过`);
  });

  test('注释类型分类测试', async () => {
    const groupedCaptures = await tester.testCommentTypes();
    
    expect(groupedCaptures).not.toBeNull();
    
    if (groupedCaptures) {
      // 验证至少有一些注释被捕获
      let totalCaptures = 0;
      for (const [_, captures] of groupedCaptures) {
        totalCaptures += captures.length;
      }
      
      expect(totalCaptures).toBeGreaterThan(0);
      console.log(`注释类型分类测试完成，共捕获 ${totalCaptures} 个注释`);
    }
  });
});