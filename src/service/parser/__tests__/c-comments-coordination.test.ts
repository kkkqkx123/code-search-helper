import Parser from 'tree-sitter';
import C from 'tree-sitter-c';
import { CLanguageAdapter } from '../core/normalization/adapters/CLanguageAdapter';
import { QueryLoader } from '../core/query/QueryLoader';

// 初始化解析器
const parser = new Parser();
const language = C as any;
parser.setLanguage(language);

// 创建适配器实例
const adapter = new CLanguageAdapter();

describe('C语言注释查询规则与适配器协调测试', () => {
  beforeAll(async () => {
    // 确保C语言查询已加载
    await QueryLoader.loadLanguageQueries('c');
  });

  test('单行注释查询', async () => {
    const code = `
      // 这是一个单行注释
      int x = 10;
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'comments', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    // 注释应该被映射为comment类型
    expect(results[0].type).toBe('comment');
    
    console.log('单行注释测试通过:', results[0]);
  });

  test('多行注释查询', async () => {
    const code = `
      /*
       * 这是一个多行注释
       * 包含多行内容
       */
      int y = 20;
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'comments', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');
    
    console.log('多行注释测试通过:', results[0]);
  });

  test('文档注释查询', async () => {
    const code = `
      /**
       * 函数文档注释
       * @param a 第一个参数
       * @return 返回值
       */
      int add(int a, int b) {
        return a + b;
      }
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'comments', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');
    
    console.log('文档注释测试通过:', results[0]);
  });

  test('TODO/FIXME注释查询', async () => {
    const code = `
      // TODO: 需要实现的功能
      int x = 10;
      
      // FIXME: 修复这个bug
      int y = 20;
      
      // NOTE: 注意事项
      int z = 30;
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'comments', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');
    
    console.log('TODO/FIXME注释测试通过:', results[0]);
  });

  test('许可证头注释查询', async () => {
    const code = `
      /*
       * Copyright (c) 2023 Example Corp
       * Licensed under the MIT License
       */
      
      #include <stdio.h>
      
      int main() {
        return 0;
      }
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'comments', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');
    
    console.log('许可证头注释测试通过:', results[0]);
  });

  test('编译器指令注释查询', async () => {
    const code = `
      // #pragma warning(disable: 4996)
      int x = 10;
      
      /*
       * #define MAX_SIZE 100
       * #ifdef DEBUG
       */
      int y = 20;
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'comments', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');
    
    console.log('编译器指令注释测试通过:', results[0]);
  });

  test('函数文档注释关联查询', async () => {
    const code = `
      /**
       * 计算两个数的和
       * @param a 第一个数
       * @param b 第二个数
       * @return 两数之和
       */
      int calculate_sum(int a, int b) {
        return a + b;
      }
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'comments', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');
    
    console.log('函数文档注释关联测试通过:', results[0]);
  });

  test('结构体文档注释关联查询', async () => {
    const code = `
      /**
       * 点结构体
       * 表示二维坐标系中的一个点
       */
      struct Point {
        int x; // x坐标
        int y; // y坐标
      };
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'comments', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');
    
    console.log('结构体文档注释关联测试通过:', results[0]);
  });

  test('枚举文档注释关联查询', async () => {
    const code = `
      /**
       * 颜色枚举
       * 定义基本颜色值
       */
      enum Color {
        RED,   // 红色
        GREEN, // 绿色
        BLUE   // 蓝色
      };
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'comments', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');
    
    console.log('枚举文档注释关联测试通过:', results[0]);
  });

  test('变量文档注释关联查询', async () => {
    const code = `
      /**
       * 全局计数器
       * 用于跟踪系统状态
       */
      int global_counter = 0;
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'comments', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');
    
    console.log('变量文档注释关联测试通过:', results[0]);
  });

  test('宏定义文档注释关联查询', async () => {
    const code = `
      /**
       * 最大数组大小
       * 定义数组的最大长度限制
       */
      #define MAX_ARRAY_SIZE 1024
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'comments', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');
    
    console.log('宏定义文档注释关联测试通过:', results[0]);
  });

  test('预处理器条件文档注释关联查询', async () => {
    const code = `
      /**
       * 调试模式开关
       * 控制调试信息的输出
       */
      #ifdef DEBUG
        #define LOG_ENABLED 1
      #else
        #define LOG_ENABLED 0
      #endif
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'comments', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');
    
    console.log('预处理器条件文档注释关联测试通过:', results[0]);
  });

  test('混合注释类型查询', async () => {
    const code = `
      /*
       * Copyright (c) 2023 Example Corp
       * Licensed under the MIT License
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
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'comments', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results.every(result => result.type === 'comment'));
    
    console.log('混合注释类型测试通过，找到', results.length, '个注释');
  });
});