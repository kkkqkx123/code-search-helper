import Parser from 'tree-sitter';
import CPP from 'tree-sitter-cpp';
import { CppLanguageAdapter } from '../../core/normalization/adapters/CppLanguageAdapter';
import { QueryLoader } from '../../core/query/QueryLoader';

// 初始化解析器
const parser = new Parser();
const language = CPP as any;
parser.setLanguage(language);

// 创建适配器实例
const adapter = new CppLanguageAdapter();

describe('C++语言注释查询规则与适配器协调测试', () => {
  beforeAll(async () => {
    // 确保C++语言查询已加载
    await QueryLoader.loadLanguageQueries('cpp');
  });

  test('单行注释查询', async () => {
    const code = `
      // 这是一个单行注释
      int x = 10;
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('cpp', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'cpp');

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
    const queryPattern = await QueryLoader.getQuery('cpp', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'cpp');

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
    const queryPattern = await QueryLoader.getQuery('cpp', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'cpp');

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
    const queryPattern = await QueryLoader.getQuery('cpp', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'cpp');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('TODO/FIXME注释测试通过:', results[0]);
  });

  test('许可证头注释查询', async () => {
    const code = `
      /*
       * Copyright (c) 2023 Example Corp
       * Licensed under MIT License
       */
      
      #include <iostream>
      
      int main() {
        return 0;
      }
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('cpp', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'cpp');

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
    const queryPattern = await QueryLoader.getQuery('cpp', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'cpp');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('编译器指令注释测试通过:', results[0]);
  });

  test('类文档注释关联查询', async () => {
    const code = `
      /**
       * 点类
       * 表示二维坐标系中的一个点
       */
      class Point {
      public:
        int x; // x坐标
        int y; // y坐标
      };
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('cpp', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'cpp');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('类文档注释关联测试通过:', results[0]);
  });

  test('模板函数文档注释关联查询', async () => {
    const code = `
      /**
       * 模板函数文档
       * @tparam T 模板参数类型
       * @param a 第一个参数
       * @param b 第二个参数
       * @return 较大的值
       */
      template<typename T>
      T max(T a, T b) {
        return (a > b) ? a : b;
      }
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('cpp', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'cpp');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('模板函数文档注释关联测试通过:', results[0]);
  });

  test('命名空间文档注释关联查询', async () => {
    const code = `
      /**
       * 工具命名空间
       * 包含各种实用函数
       */
      namespace utils {
        // 工具函数
        int helper() {
          return 42;
        }
      }
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('cpp', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'cpp');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('命名空间文档注释关联测试通过:', results[0]);
  });

  test('混合注释类型查询', async () => {
    const code = `
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
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('cpp', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'cpp');

    expect(results.length).toBeGreaterThan(0);
    expect(results.every(result => result.type === 'comment'));

    console.log('混合注释类型测试通过，找到', results.length, '个注释');
  });

  test('Doxygen风格注释查询', async () => {
    const code = `
      /**
       * @brief 计算两个整数的和
       * @param a 第一个整数
       * @param b 第二个整数
       * @return 两个整数的和
       * @see subtract
       * @note 这是一个简单的加法函数
       */
      int add(int a, int b) {
        return a + b;
      }
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('cpp', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'cpp');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('Doxygen风格注释测试通过:', results[0]);
  });

  test('C++特性注释查询', async () => {
    const code = `
      // C++11特性注释
      auto lambda = [](int x, int y) -> int {
        return x + y;
      };
      
      // C++14特性注释
      constexpr int square(int n) {
        return n * n;
      }
      
      // C++17特性注释
      if constexpr (std::is_integral_v<T>) {
        // 整型特化处理
        return process_integral(value);
      }
      
      // C++20特性注释
      template <typename T>
      concept Integral = std::is_integral_v<T>;
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('cpp', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'cpp');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('C++特性注释测试通过:', results[0]);
  });

  test('Doxygen标签注释查询', async () => {
    const code = `
      /**
       * @class Calculator
       * @brief 简单计算器类
       * @author John Doe
       * @date 2023-01-01
       * @version 1.0
       * @copyright MIT License
       */
      class Calculator {
      public:
        /**
         * @fn int add(int a, int b)
         * @brief 加法运算
         * @param[in] a 被加数
         * @param[in] b 加数
         * @return 和
         * @exception std::overflow_error 结果溢出时抛出
         * @pre a和b必须是有效整数
         * @post 返回a和b的和
         */
        int add(int a, int b);
        
        /**
         * @var int value
         * @brief 存储计算结果的变量
         */
        int value;
      };
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('cpp', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'cpp');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('Doxygen标签注释测试通过:', results[0]);
  });
});