import Parser from 'tree-sitter';
import C from 'tree-sitter-c';
import { CLanguageAdapter } from '../../core/normalization/adapters/CLanguageAdapter';
import { QueryLoader } from '../../core/query/QueryLoader';

export class CoordinationTester {
  private parser: Parser;
  private language: Parser.Language;
  private adapter: CLanguageAdapter;

  constructor() {
    this.parser = new Parser();
    this.language = C as any;
    this.parser.setLanguage(this.language);
    this.adapter = new CLanguageAdapter();
  }

  async testCoordination(
    code: string, 
    queryType: string,
    expectedType: string,
    expectedName?: string
  ) {
    try {
      // 解析代码
      const tree = this.parser.parse(code);
      
      // 获取查询规则
      const queryPattern = await QueryLoader.getQuery('c', queryType);
      const query = new Parser.Query(this.language, queryPattern);
      
      // 执行查询
      const captures = query.captures(tree.rootNode);
      
      if (captures.length === 0) {
        console.warn(`警告: 查询类型 ${queryType} 未找到匹配项`);
        return null;
      }
      
      // 转换为查询结果格式
      const queryResults = captures.map(capture => ({
        captures: [{
          name: capture.name,
          node: capture.node
        }]
      }));
      
      // 适配器标准化
      const results = await this.adapter.normalize(queryResults, queryType, 'c');
      
      // 验证结果
      if (results.length > 0) {
        const result = results[0];
        console.log(`✓ ${queryType} 测试通过:`, {
          type: result.type,
          name: result.name,
          nodeId: result.nodeId,
          expectedType,
          expectedName,
          typeMatch: result.type === expectedType,
          nameMatch: expectedName ? result.name === expectedName : true
        });
        
        return result;
      } else {
        console.warn(`警告: ${queryType} 适配器返回空结果`);
        return null;
      }
    } catch (error) {
      console.error(`✗ ${queryType} 测试失败:`, error);
      return null;
    }
  }

  async runBasicTests() {
    console.log('开始基础协调测试...\n');
    
    // 测试用例
    const testCases = [
      {
        name: '简单函数',
        code: 'int add(int a, int b) { return a + b; }',
        queryType: 'functions',
        expectedType: 'function',
        expectedName: 'add'
      },
      {
        name: '结构体定义',
        code: 'struct Point { int x; int y; };',
        queryType: 'structs',
        expectedType: 'class',
        expectedName: 'Point'
      },
      {
        name: '变量声明',
        code: 'int x = 10;',
        queryType: 'variables',
        expectedType: 'variable',
        expectedName: 'x'
      },
      {
        name: '数据流赋值',
        code: 'x = y;',
        queryType: 'data-flow',
        expectedType: 'data-flow'
      },
      {
        name: '函数调用',
        code: 'result = calculate(x, y);',
        queryType: 'functions',
        expectedType: 'call'
      }
    ];
    
    const results = [];
    
    for (const testCase of testCases) {
      console.log(`测试: ${testCase.name}`);
      const result = await this.testCoordination(
        testCase.code,
        testCase.queryType,
        testCase.expectedType,
        testCase.expectedName
      );
      results.push({
        ...testCase,
        result,
        success: result !== null
      });
      console.log('');
    }
    
    // 汇总结果
    const successCount = results.filter(r => r.success).length;
    const totalCount = results.length;
    
    console.log(`\n测试完成: ${successCount}/${totalCount} 通过`);
    
    if (successCount < totalCount) {
      console.log('\n失败的测试:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`- ${r.name}: ${r.queryType}`);
      });
    }
    
    return results;
  }
}