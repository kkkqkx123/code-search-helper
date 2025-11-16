import Parser from 'tree-sitter';
import Python from 'tree-sitter-python';
import { PythonLanguageAdapter } from '../../core/normalization/adapters/PythonLanguageAdapter';
import { QueryLoader } from '../../core/query/QueryLoader';

// 初始化解析器
const parser = new Parser();
const language = Python as any;
parser.setLanguage(language);

// 创建适配器实例
const adapter = new PythonLanguageAdapter();

describe('Python语言注释查询规则与适配器协调测试', () => {
  beforeAll(async () => {
    // 确保Python语言查询已加载
    await QueryLoader.loadLanguageQueries('python');
  });

  test('单行注释查询', async () => {
    const code = `
      # 这是一个单行注释
      x = 10
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('python', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'python');

    expect(results.length).toBeGreaterThan(0);
    // 注释应该被映射为comment类型
    expect(results[0].type).toBe('comment');

    console.log('单行注释测试通过:', results[0]);
  });

  test('函数文档字符串查询', async () => {
    const code = `
      def function(x):
          """
          这是函数的文档字符串
          包含多行内容
          """
          return x * 2
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('python', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'python');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('函数文档字符串测试通过:', results[0]);
  });

  test('类文档字符串查询', async () => {
    const code = `
      class MyClass:
          """
          这是类的文档字符串
          """
          
          def method(self):
              """方法文档字符串"""
              pass
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('python', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'python');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('类文档字符串测试通过:', results[0]);
  });

  test('TODO/FIXME注释查询', async () => {
    const code = `
      # TODO: 需要实现的功能
      def incomplete():
          # FIXME: 这是一个临时解决方案
          return 0
          # NOTE: 这里需要优化
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('python', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'python');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('TODO/FIXME注释测试通过:', results[0]);
  });

  test('许可证头注释查询', async () => {
    const code = `
      # Copyright (c) 2023 MyCompany
      # Licensed under MIT License
      
      def main():
          return 0
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('python', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'python');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('许可证头注释测试通过:', results[0]);
  });

  test('模块文档字符串查询', async () => {
    const code = `
      """
      模块文档字符串
      此模块提供实用函数
      """
      
      import os  # 标准库导入
      import sys  # 系统模块
      
      # 常量
      PI = 3.14159  # 数学常数
      
      def helper():
          """辅助函数文档字符串"""
          # TODO: 实现辅助函数
          pass
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('python', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'python');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('模块文档字符串测试通过:', results[0]);
  });

  test('异步函数注释查询', async () => {
    const code = `
      async def async_function():
          """
          异步函数文档字符串
          """
          # TODO: 实现异步逻辑
          await some_operation()  # 异步操作
          # NOTE: 处理异常
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('python', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'python');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('异步函数注释测试通过:', results[0]);
  });

  test('数据类注释查询', async () => {
    const code = `
      from dataclasses import dataclass
      
      @dataclass
      class Person:
          """
          人员数据类
          """
          name: str  # 人员姓名
          age: int   # 人员年龄
          
          def __post_init__(self):
              """后初始化钩子"""
              # TODO: 验证年龄
              pass
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('python', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'python');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('数据类注释测试通过:', results[0]);
  });

  test('异常类注释查询', async () => {
    const code = `
      class CustomException(Exception):
          """
          业务逻辑错误的自定义异常
          """
          
          def __init__(self, message: str):
              """带消息的构造函数"""
              super().__init__(message)
              # TODO: 添加错误代码支持
              # FIXME: 改进错误处理
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('python', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'python');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('异常类注释测试通过:', results[0]);
  });

  test('类型提示注释查询', async () => {
    const code = `
      from typing import List, Optional
      
      def process_data(
          data: List[str],  # 输入数据列表
          option: Optional[str] = None  # 处理选项
      ) -> bool:
          """
          处理给定的数据
          
          Args:
              data: 要处理的字符串列表
              option: 可选的处理选项
              
          Returns:
              成功返回True，失败返回False
          """
          # TODO: 实现处理逻辑
          return True  # 临时返回
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('python', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'python');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].type).toBe('comment');

    console.log('类型提示注释测试通过:', results[0]);
  });

  test('混合注释类型查询', async () => {
    const code = `
      """
      模块文档字符串
      此模块提供实用函数
      """
      
      # TODO: 重构这个函数
      def process_data(data):
          """
          处理数据函数
          @param data: 输入数据
          @return: 处理结果
          """
          return data * 2  # FIXME: 添加错误检查
          
      # NOTE: 这个函数可能会被弃用
      def old_function(a, b):
          return a + b
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('python', 'comments');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    const queryResults = captures.map(capture => ({
      captures: [{
        name: capture.name,
        node: capture.node
      }]
    }));

    const results = await adapter.normalize(queryResults, 'comments', 'python');

    expect(results.length).toBeGreaterThan(0);
    expect(results.every(result => result.type === 'comment'));

    console.log('混合注释类型测试通过，找到', results.length, '个注释');
  });
});