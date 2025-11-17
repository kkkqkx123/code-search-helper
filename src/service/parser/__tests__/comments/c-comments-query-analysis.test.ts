import Parser from 'tree-sitter';
import C from 'tree-sitter-c';
import { QueryLoader } from '../../core/query/QueryLoader';

// 初始化解析器
const parser = new Parser();
const language = C as any;
parser.setLanguage(language);

describe('C语言注释查询模式分析测试', () => {
  beforeAll(async () => {
    // 确保C语言查询已加载
    await QueryLoader.loadLanguageQueries('c');
  });

  test('分析tree-sitter查询捕获的实际行为', async () => {
    const code = `
      /*
       * Copyright (c) 2023 Example Corp
       * Licensed under MIT License
       */
      
      // TODO: 需要实现的功能
      int x = 10;
      
      /**
       * 函数文档注释
       * @param a 第一个参数
       * @return 返回值
       */
      int add(int a, int b) {
        return a + b; // FIXME: 添加溢出检查
      }
      
      // #pragma warning(disable: 4996)
      int y = 20;
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    console.log('=== 查询模式 ===');
    console.log(queryPattern);
    
    console.log('\n=== 捕获结果分析 ===');
    const captureGroups: Record<string, any[]> = {};
    
    captures.forEach((capture, index) => {
      const captureName = capture.name;
      const text = capture.node.text;
      
      if (!captureGroups[captureName]) {
        captureGroups[captureName] = [];
      }
      
      captureGroups[captureName].push({
        index,
        text: text.trim(),
        startPosition: capture.node.startPosition,
        endPosition: capture.node.endPosition
      });
    });

    // 分析每个捕获组
    Object.entries(captureGroups).forEach(([captureName, captures]) => {
      console.log(`\n--- ${captureName} (${captures.length}个) ---`);
      captures.forEach(capture => {
        console.log(`  [${capture.index}] ${capture.text}`);
        console.log(`    位置: ${capture.startPosition.row + 1}:${capture.startPosition.column} - ${capture.endPosition.row + 1}:${capture.endPosition.column}`);
      });
    });

    // 验证关键问题：相同的注释节点是否被多个查询模式捕获？
    console.log('\n=== 重复捕获分析 ===');
    const nodeTexts = new Map<string, string[]>();
    
    captures.forEach(capture => {
      const nodeText = capture.node.text;
      const captureName = capture.name;
      
      if (!nodeTexts.has(nodeText)) {
        nodeTexts.set(nodeText, []);
      }
      nodeTexts.get(nodeText)!.push(captureName);
    });

    let duplicateCount = 0;
    nodeTexts.forEach((captureNames, text) => {
      if (captureNames.length > 1) {
        duplicateCount++;
        console.log(`重复捕获 (${captureNames.length}次): ${text.trim()}`);
        console.log(`  捕获名称: ${captureNames.join(', ')}`);
      }
    });

    console.log(`\n总捕获数: ${captures.length}`);
    console.log(`唯一注释数: ${nodeTexts.size}`);
    console.log(`重复捕获数: ${duplicateCount}`);
    
    // 验证查询模式是否真的能区分不同类型的注释
    console.log('\n=== 查询模式有效性分析 ===');
    
    // 检查是否有特定的查询模式能匹配到特定的注释
    const expectedPatterns = {
      'comment.license': ['Copyright', 'License'],
      'comment.todo': ['TODO', 'FIXME'],
      'comment.doc': ['@param', '@return'],
      'comment.directive': ['#pragma']
    };

    Object.entries(expectedPatterns).forEach(([pattern, keywords]) => {
      const patternCaptures = captureGroups[pattern] || [];
      const matchedTexts = patternCaptures.map(c => c.text);
      
      console.log(`\n${pattern}:`);
      console.log(`  期望匹配关键词: ${keywords.join(', ')}`);
      console.log(`  实际捕获数: ${patternCaptures.length}`);
      
      if (patternCaptures.length > 0) {
        console.log(`  匹配的注释:`);
        matchedTexts.forEach(text => {
          console.log(`    - ${text.trim()}`);
        });
      } else {
        console.log(`  ⚠️  未找到匹配的注释`);
      }
    });

    // 结论
    console.log('\n=== 结论 ===');
    if (duplicateCount > 0) {
      console.log('⚠️  发现重复捕获：相同的注释被多个查询模式匹配');
      console.log('   这意味着tree-sitter查询模式无法真正区分注释类型');
      console.log('   注释类型的区分需要在后处理中基于文本内容实现');
    } else {
      console.log('✅ 没有重复捕获：每个查询模式匹配不同的注释');
      console.log('   这意味着tree-sitter查询模式能够区分注释类型');
    }
  });

  test('验证查询模式的语法正确性', async () => {
    const queryPattern = await QueryLoader.getQuery('c', 'comments');
    const validation = QueryLoader.validateQuerySyntax(queryPattern);
    
    console.log('\n=== 查询语法验证 ===');
    console.log(`验证结果: ${validation.valid ? '✅ 有效' : '❌ 无效'}`);
    
    if (!validation.valid) {
      console.log('语法错误:');
      validation.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
    
    expect(validation.valid).toBe(true);
  });
});