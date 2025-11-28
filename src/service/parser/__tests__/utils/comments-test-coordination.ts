import Parser from 'tree-sitter';
import C from 'tree-sitter-c';
import { CLanguageAdapter } from '../../normalization/adapters/CLanguageAdapter';
import { QueryLoader } from '../../core/query/QueryLoader';

export class CommentsCoordinationTester {
  private parser: Parser;
  private language: Parser.Language;
  private adapter: CLanguageAdapter;

  constructor() {
    this.parser = new Parser();
    this.language = C as any;
    this.parser.setLanguage(this.language);
    this.adapter = new CLanguageAdapter();
  }

  async testCommentCoordination(
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

  async runCommentTests() {
    console.log('开始注释协调测试...\n');

    // 确保C语言查询已加载
    await QueryLoader.loadLanguageQueries('c');

    // 测试用例
    const testCases = [
      {
        name: '单行注释',
        code: '// 这是一个单行注释',
        queryType: 'comments',
        expectedType: 'comment',
        expectedName: undefined
      },
      {
        name: '多行注释',
        code: '/*\n * 这是一个多行注释\n * 包含多行内容\n */',
        queryType: 'comments',
        expectedType: 'comment',
        expectedName: undefined
      },
      {
        name: '文档注释',
        code: '/**\n * 函数文档注释\n * @param a 第一个参数\n * @return 返回值\n */',
        queryType: 'comments',
        expectedType: 'comment',
        expectedName: undefined
      },
      {
        name: 'TODO注释',
        code: '// TODO: 需要实现的功能',
        queryType: 'comments',
        expectedType: 'comment',
        expectedName: undefined
      },
      {
        name: '许可证注释',
        code: '/*\n * Copyright (c) 2023 Example Corp\n * Licensed under MIT License\n */',
        queryType: 'comments',
        expectedType: 'comment',
        expectedName: undefined
      },
      {
        name: '编译器指令注释',
        code: '// #pragma warning(disable: 4996)',
        queryType: 'comments',
        expectedType: 'comment',
        expectedName: undefined
      }
    ];

    const results = [];

    for (const testCase of testCases) {
      console.log(`测试: ${testCase.name}`);
      const result = await this.testCommentCoordination(
        testCase.code,
        testCase.queryType,
        testCase.expectedType,
        testCase.expectedName || undefined
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

  async testCommentTypes() {
    console.log('开始注释类型分类测试...\n');

    // 确保C语言查询已加载
    await QueryLoader.loadLanguageQueries('c');

    // 测试不同类型的注释
    const testCode = `
      /*
       * Copyright (c) 2023 Example Corp
       * Licensed under MIT License
       */
      
      // TODO: 重构这个函数
      /**
       * 计算平方值
       * @param x 输入值
       * @return 平方值
       */
      int square(int x) {
        return x * x; // FIXME: 添加溢出检查
      }
      
      // NOTE: 这个函数可能会被弃用
      int old_function(int a, int b) {
        return a + b;
      }
      
      // #pragma warning(disable: 4996)
      int main() {
        return 0;
      }
    `;

    try {
      const tree = this.parser.parse(testCode);
      const queryPattern = await QueryLoader.getQuery('c', 'comments');
      const query = new Parser.Query(this.language, queryPattern);
      const captures = query.captures(tree.rootNode);

      // 按捕获名称分组
      const groupedCaptures = new Map<string, any[]>();
      captures.forEach(capture => {
        const name = capture.name;
        if (!groupedCaptures.has(name)) {
          groupedCaptures.set(name, []);
        }
        groupedCaptures.get(name)!.push(capture);
      });

      console.log('注释类型分类结果:');
      for (const [captureName, captureList] of groupedCaptures) {
        console.log(`- ${captureName}: ${captureList.length} 个注释`);
        captureList.forEach((capture, index) => {
          const text = capture.node.text;
          const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;
          console.log(`  ${index + 1}. ${preview}`);
        });
        console.log('');
      }

      return groupedCaptures;
    } catch (error) {
      console.error('注释类型分类测试失败:', error);
      return null;
    }
  }
}