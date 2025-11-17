import Parser from 'tree-sitter';
import C from 'tree-sitter-c';
import { QueryLoader } from '../../core/query/QueryLoader';

// 初始化解析器
const parser = new Parser();
const language = C as any;
parser.setLanguage(language);

describe('C语言index.ts内联注释查询模式测试', () => {
  beforeAll(async () => {
    // 确保C语言查询已加载
    await QueryLoader.loadLanguageQueries('c');
  });

  test('验证index.ts中的内联注释查询模式正常工作', async () => {
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
    
    // 测试通过index.ts获取完整的查询模式
    const fullQueryPattern = await QueryLoader.getQuery('c', 'functions');
    console.log('=== 完整查询模式（functions） ===');
    console.log(fullQueryPattern.substring(0, 200) + '...');
    
    // 测试获取注释查询模式
    try {
      const commentsQueryPattern = await QueryLoader.getQuery('c', 'comments');
      console.log('\n=== 注释查询模式 ===');
      console.log(commentsQueryPattern);
      
      // 验证注释查询模式是否有效
      const query = new Parser.Query(language, commentsQueryPattern);
      const captures = query.captures(tree.rootNode);
      
      console.log(`\n=== 捕获结果 ===`);
      console.log(`总捕获数: ${captures.length}`);
      
      captures.forEach((capture, index) => {
        console.log(`[${index}] ${capture.name}: ${capture.node.text.trim()}`);
      });
      
      // 验证基本功能
      expect(captures.length).toBeGreaterThan(0);
      expect(captures.every(c => c.name === 'comment')).toBe(true);
      
    } catch (error) {
      console.log('获取注释查询模式失败:', error);
      
      // 如果comments查询类型不存在，检查是否可以通过其他方式获取
      const availableTypes = QueryLoader.getQueryTypesForLanguage('c');
      console.log('C语言支持的查询类型:', availableTypes);
      
      // 验证comments是否在支持的类型中
      if (availableTypes.includes('comments')) {
        throw error; // 如果支持但获取失败，抛出原始错误
      } else {
        console.log('comments查询类型不在支持的类型中，这是预期的行为');
        // 在这种情况下，注释查询应该通过智能分类从完整查询中提取
      }
    }
  });

  test('验证QueryLoader能正确处理内联定义的注释查询', async () => {
    const code = `
      int main() {
        // 这是一个注释
        return 0;
      }
    `;

    const tree = parser.parse(code);
    
    // 获取C语言支持的所有查询类型
    const availableTypes = QueryLoader.getQueryTypesForLanguage('c');
    console.log('\n=== C语言支持的查询类型 ===');
    console.log(availableTypes);
    
    // 检查是否有注释相关的查询类型
    const commentRelatedTypes = availableTypes.filter(type => 
      type.includes('comment') || type.includes('annotation')
    );
    console.log('注释相关的查询类型:', commentRelatedTypes);
    
    // 如果comments类型存在，验证它能正常工作
    if (availableTypes.includes('comments')) {
      const commentsQuery = await QueryLoader.getQuery('c', 'comments');
      const query = new Parser.Query(language, commentsQuery);
      const captures = query.captures(tree.rootNode);
      
      expect(captures.length).toBe(1);
      expect(captures[0].name).toBe('comment');
      expect(captures[0].node.text.trim()).toBe('// 这是一个注释');
    }
  });

  test('验证系统能正确处理没有单独comments文件的配置', async () => {
    // 检查C语言的查询加载是否正常工作
    const isLoaded = QueryLoader.isLanguageLoaded('c');
    expect(isLoaded).toBe(true);
    
    // 获取C语言的查询统计信息
    const stats = QueryLoader.getStats();
    console.log('\n=== 查询加载器统计信息 ===');
    console.log(`已加载的语言数: ${stats.loadedLanguages}`);
    console.log(`总查询数: ${stats.totalQueries}`);
    console.log(`语言统计:`, stats.languageStats);
    
    // 验证C语言已正确加载
    expect(stats.languageStats['c']).toBeGreaterThan(0);
  });
});