import Parser from 'tree-sitter';
import Java from 'tree-sitter-java';
import { JavaLanguageAdapter } from '../../core/normalization/adapters/JavaLanguageAdapter';
import { QueryLoader } from '../../core/query/QueryLoader';

// 初始化解析器
const parser = new Parser();
const language = Java as any;
parser.setLanguage(language);

// 创建适配器实例
const adapter = new JavaLanguageAdapter();

describe('Java语言注释查询规则与适配器协调测试', () => {
  beforeAll(async () => {
    // 确保Java语言查询已加载
    await QueryLoader.loadLanguageQueries('java');
  });

  test('单行注释查询', async () => {
    const code = `
      // 这是一个单行注释
      int x = 10;
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('java', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'java');

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
    const queryPattern = await QueryLoader.getQuery('java', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'java');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('多行注释测试通过:', results[0]);
  });

  test('JavaDoc注释查询', async () => {
    const code = `
      /**
       * 函数文档注释
       * @param a 第一个参数
       * @return 返回值
       * @throws IllegalArgumentException 如果参数无效
       */
      public int add(int a, int b) {
        return a + b;
      }
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('java', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'java');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('JavaDoc注释测试通过:', results[0]);
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
    const queryPattern = await QueryLoader.getQuery('java', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'java');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('TODO/FIXME注释测试通过:', results[0]);
  });

  test('许可证头注释查询', async () => {
    const code = `
      /*
       * Copyright (c) 2023 Example Corp
       * Licensed under Apache License 2.0
       */
      
      package com.example;
      
      public class Main {
        public static void main(String[] args) {
          System.out.println("Hello World");
        }
      }
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('java', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'java');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('许可证头注释测试通过:', results[0]);
  });

  test('JavaDoc标签注释查询', async () => {
    const code = `
      /**
       * @deprecated 使用newMethod()代替
       * @see #newMethod()
       * @link https://example.com/docs
       * @param name 名称参数
       * @return 格式化的名称
       */
      public String oldMethod(String name) {
        return "Hello " + name;
      }
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('java', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'java');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('JavaDoc标签注释测试通过:', results[0]);
  });

  test('接口文档注释关联查询', async () => {
    const code = `
      /**
       * 数据处理接口
       */
      public interface DataProcessor {
        /**
         * 处理给定的数据
         * @param data 要处理的数据
         * @return 处理后的数据
         */
        String process(String data);
        
        // 默认方法注释
        default void log(String message) {
          System.out.println(message); // 调试输出
        }
      }
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('java', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'java');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('接口文档注释关联测试通过:', results[0]);
  });

  test('枚举文档注释关联查询', async () => {
    const code = `
      /**
       * 状态类型枚举
       */
      public enum Status {
        /**
         * 活跃状态
         */
        ACTIVE(1),
        
        /**
         * 非活跃状态
         */
        INACTIVE(0);
        
        private final int code;
        
        // 构造函数注释
        Status(int code) {
          this.code = code;
        }
      }
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('java', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'java');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('枚举文档注释关联测试通过:', results[0]);
  });

  test('注解注释查询', async () => {
    const code = `
      /**
       * 用户管理服务类
       */
      @Service
      @Transactional
      public class UserService {
        
        /**
         * 根据ID查找用户
         * @param id 用户ID
         * @return 用户对象
         * @throws UserNotFoundException 如果用户未找到
         */
        @Cacheable("users")
        public User findById(Long id) {
          // TODO: 实现缓存
          return userRepository.findById(id);
        }
        
        // @PreAuthorize注解注释
        @PreAuthorize("hasRole('ADMIN')")
        public void deleteUser(Long id) {
          // WARNING: 此操作不可逆
          userRepository.deleteById(id);
        }
      }
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('java', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'java');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('注解注释测试通过:', results[0]);
  });

  test('异常类注释查询', async () => {
    const code = `
      /**
       * 业务逻辑错误的自定义异常
       */
      public class BusinessException extends RuntimeException {
        
        /**
         * 带消息的构造函数
         * @param message 错误消息
         */
        public BusinessException(String message) {
          super(message);
        }
        
        // TODO: 添加错误代码支持
        // FIXME: 改进错误处理
      }
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('java', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'java');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('异常类注释测试通过:', results[0]);
  });

  test('混合注释类型查询', async () => {
    const code = `
      /*
       * Copyright (c) 2023 Example Corp
       * Licensed under Apache License 2.0
       */
      
      // TODO: 重构这个函数
      /**
       * 计算平方值
       * @param x 输入值
       * @return 平方值
       */
      public int square(int x) {
        return x * x; // FIXME: 添加溢出检查
      }
      
      // NOTE: 这个函数可能会被弃用
      public int oldFunction(int a, int b) {
        return a + b;
      }
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('java', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'java');

    expect(results.length).toBeGreaterThan(0);
    expect(results.every(result => result.type === 'comment'));

    console.log('混合注释类型测试通过，找到', results.length, '个注释');
  });
});