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

describe('C语言查询规则与适配器协调测试', () => {
  test('函数定义查询与适配器协调', async () => {
    const code = `
      int add(int a, int b) {
        return a + b;
      }
    `;
    
    // 1. 解析代码
    const tree = parser.parse(code);
    
    // 2. 获取查询规则
    const queryPattern = await QueryLoader.getQuery('c', 'functions');
    const query = new Parser.Query(language, queryPattern);
    
    // 3. 执行查询
    const captures = query.captures(tree.rootNode);
    
    // 4. 转换为查询结果格式
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    // 5. 适配器标准化
    const results = await adapter.normalize(queryResults, 'functions', 'c');
    
    // 6. 验证结果
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('function');
    expect(results[0].name).toBe('add');
    expect(results[0].nodeId).toBeDefined();
    
    console.log('函数定义测试通过:', results[0]);
  });

  test('结构体定义查询与适配器协调', async () => {
    const code = `
      struct Point {
        int x;
        int y;
      };
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'structs');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'structs', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('class'); // 结构体映射为类
    expect(results[0].name).toBe('Point');
    
    console.log('结构体定义测试通过:', results[0]);
  });

  test('数据流查询与适配器协调', async () => {
    const code = `
      int x = y;
      result = calculate(x);
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'data-flow');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'data-flow', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('data-flow');
    
    console.log('数据流测试通过:', results[0]);
  });

  test('变量声明查询与适配器协调', async () => {
    const code = `
      int x = 10;
      const char* message = "Hello";
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'variables');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'variables', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('variable');
    
    console.log('变量声明测试通过:', results[0]);
  });

  test('预处理器查询与适配器协调', async () => {
    const code = `
      #include <stdio.h>
      #define MAX_SIZE 100
      #ifdef DEBUG
        #define LOG(x) printf(x)
      #endif
    `;
    
    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'preprocessor');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);
    
    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));
    
    const results = await adapter.normalize(queryResults, 'preprocessor', 'c');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('expression'); // 预处理器映射为表达式
    
    console.log('预处理器测试通过:', results[0]);
  });
});