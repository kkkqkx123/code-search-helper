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

  test('Python特性注释查询 - 异步特性', async () => {
    const code = `
      # 异步函数装饰器
      import asyncio
      
      # 异步上下文管理器
      async with async_session():
          # 异步迭代器
          async for item in async_iterable:
              # 异步生成器
              yield item
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

    console.log('Python异步特性注释测试通过，找到', results.length, '个注释');
  });

  test('Python特性注释查询 - 装饰器特性', async () => {
    const code = `
      # 类装饰器
      @classmethod
      def class_method(cls):
          # 静态方法装饰器
          @staticmethod
          def static_method():
              # 属性装饰器
              @property
              def name(self):
                  return self._name
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

    console.log('Python装饰器特性注释测试通过，找到', results.length, '个注释');
  });

  test('Python特性注释查询 - 类型提示特性', async () => {
    const code = `
      from typing import List, Dict, Optional, Union
      
      # 类型变量定义
      TypeVar = Union[str, int]
      
      def process_data(
          data: List[str],  # 列表类型参数
          config: Optional[Dict] = None,  # 可选字典参数
      ) -> bool:  # 返回类型注解
          """
          处理数据函数
          
          Args:
              data: 输入数据列表
              config: 配置字典
              
          Returns:
              处理结果
          """
          return True
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

    console.log('Python类型提示特性注释测试通过，找到', results.length, '个注释');
  });

  test('测试和性能注释查询 - unittest', async () => {
    const code = `
      import unittest
      
      # unittest测试类
      class TestMathOperations(unittest.TestCase):
          # 测试设置方法
          def setUp(self):
              self.data = [1, 2, 3]
          
          # 测试加法操作
          def test_addition(self):
              # 断言测试结果
              self.assertEqual(1 + 1, 2)
          
          # 测试清理方法
          def tearDown(self):
              self.data = None
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

    console.log('Python unittest测试注释测试通过，找到', results.length, '个注释');
  });

  test('测试和性能注释查询 - pytest', async () => {
    const code = `
      import pytest
      
      # pytest fixture
      @pytest.fixture
      def sample_data():
          # 返回测试数据
          return [1, 2, 3]
      
      # pytest参数化测试
      @pytest.mark.parametrize("input,expected", [
          (1, 2),
          (2, 4),
          (3, 6)
      ])
      def test_double(input, expected):
          # pytest断言
          assert input * 2 == expected
      
      # pytest跳过测试
      @pytest.mark.skip(reason="功能尚未实现")
      def test_skipped():
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
    expect(results.every(result => result.type === 'comment'));

    console.log('Python pytest测试注释测试通过，找到', results.length, '个注释');
  });

  test('数据处理和机器学习注释查询 - pandas', async () => {
    const code = `
      import pandas as pd
      
      # pandas数据框创建
      df = pd.DataFrame({
          'name': ['Alice', 'Bob', 'Charlie'],  # 列名
          'age': [25, 30, 35]  # 年龄列
      })
      
      # pandas数据过滤
      filtered_df = df[df['age'] > 30]  # 过滤年龄大于30的记录
      
      # pandas数据聚合
      grouped_df = df.groupby('name').sum()  # 按姓名分组求和
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

    console.log('Python pandas数据注释测试通过，找到', results.length, '个注释');
  });

  test('数据处理和机器学习注释查询 - numpy', async () => {
    const code = `
      import numpy as np
      
      # numpy数组创建
      arr = np.array([1, 2, 3, 4, 5])  # 一维数组
      
      # numpy数组运算
      result = np.sum(arr)  # 数组求和
      
      # numpy矩阵操作
      matrix = np.zeros((3, 3))  # 零矩阵
      
      # numpy随机数生成
      random_data = np.random.randn(100)  # 正态分布随机数
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

    console.log('Python numpy数据注释测试通过，找到', results.length, '个注释');
  });

  test('数据处理和机器学习注释查询 - tensorflow', async () => {
    const code = `
      import tensorflow as tf
      
      # tensorflow模型定义
      model = tf.keras.Sequential([
          # 全连接层
          tf.keras.layers.Dense(128, activation='relu'),
          # 输出层
          tf.keras.layers.Dense(10, activation='softmax')
      ])
      
      # tensorflow模型编译
      model.compile(
          optimizer='adam',  # 优化器
          loss='sparse_categorical_crossentropy'  # 损失函数
      )
      
      # tensorflow模型训练
      model.fit(X_train, y_train, epochs=10)  # 训练10个epoch
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

    console.log('Python tensorflow机器学习注释测试通过，找到', results.length, '个注释');
  });

  test('数据处理和机器学习注释查询 - pytorch', async () => {
    const code = `
      import torch
      import torch.nn as nn
      
      # pytorch神经网络定义
      class NeuralNetwork(nn.Module):
          def __init__(self):
              super().__init__()
              # 全连接层
              self.fc1 = nn.Linear(784, 128)
              # 输出层
              self.fc2 = nn.Linear(128, 10)
          
          def forward(self, x):
              # 前向传播
              x = torch.relu(self.fc1(x))
              return self.fc2(x)
      
      # pytorch损失函数
      criterion = nn.CrossEntropyLoss()  # 交叉熵损失
      
      # pytorch优化器
      optimizer = torch.optim.Adam(model.parameters())  # Adam优化器
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

    console.log('Python pytorch机器学习注释测试通过，找到', results.length, '个注释');
  });

  test('安全和配置注释查询 - 认证相关', async () => {
    const code = `
      import hashlib
      import jwt
      
      # 密码哈希处理
      def hash_password(password: str) -> str:
          # 使用SHA256哈希算法
          return hashlib.sha256(password.encode()).hexdigest()
      
      # JWT token生成
      def generate_token(user_id: int) -> str:
          # 生成JWT token
          payload = {'user_id': user_id}
          return jwt.encode(payload, 'secret_key', algorithm='HS256')
      
      # 用户认证验证
      def authenticate_user(username: str, password: str) -> bool:
          # 验证用户凭据
          stored_hash = get_user_password_hash(username)
          return hash_password(password) == stored_hash
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

    console.log('Python认证安全注释测试通过，找到', results.length, '个注释');
  });

  test('安全和配置注释查询 - 验证相关', async () => {
    const code = `
      import re
      from typing import Optional
      
      # 邮箱格式验证
      def validate_email(email: str) -> bool:
          # 使用正则表达式验证邮箱格式
          pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
          return re.match(pattern, email) is not None
      
      # 输入数据验证
      def validate_input(data: dict) -> Optional[str]:
          # 验证必填字段
          required_fields = ['name', 'email', 'age']
          for field in required_fields:
              if field not in data:
                  return f'Missing required field: {field}'
          
          # 验证数据类型
          if not isinstance(data['age'], int):
              return 'Age must be an integer'
          
          return None
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

    console.log('Python验证安全注释测试通过，找到', results.length, '个注释');
  });

  test('许可证头注释查询 - MIT许可证', async () => {
    const code = `
      # MIT License
      #
      # Copyright (c) 2023 MyCompany
      #
      # Permission is hereby granted, free of charge, to any person obtaining a copy
      # of this software and associated documentation files (the "Software"), to deal
      # in the Software without restriction, including without limitation the rights
      # to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
      # copies of the Software, and to permit persons to whom the Software is
      # furnished to do so, subject to the following conditions:
      #
      # The above copyright notice and this permission notice shall be included in all
      # copies or substantial portions of the Software.
      
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
    expect(results.every(result => result.type === 'comment'));

    console.log('Python MIT许可证注释测试通过，找到', results.length, '个注释');
  });

  test('许可证头注释查询 - Apache许可证', async () => {
    const code = `
      # Apache License 2.0
      #
      # Copyright 2023 MyCompany
      #
      # Licensed under the Apache License, Version 2.0 (the "License");
      # you may not use this file except in compliance with the License.
      # You may obtain a copy of the License at
      #
      #     http://www.apache.org/licenses/LICENSE-2.0
      #
      # Unless required by applicable law or agreed to in writing, software
      # distributed under the License is distributed on an "AS IS" BASIS,
      # WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
      # See the License for the specific language governing permissions and
      # limitations under the License.
      
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
    expect(results.every(result => result.type === 'comment'));

    console.log('Python Apache许可证注释测试通过，找到', results.length, '个注释');
  });

  test('导入和模块注释查询 - 标准库导入', async () => {
    const code = `
      # 标准库导入
      import os  # 操作系统接口
      import sys  # 系统相关功能
      import json  # JSON数据处理
      from datetime import datetime  # 日期时间处理
      from typing import List, Dict, Optional  # 类型提示
      
      # 使用标准库
      def process_data():
          # 获取当前时间
          now = datetime.now()
          # 获取环境变量
          path = os.getenv('PATH')
          return {'time': now, 'path': path}
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

    console.log('Python标准库导入注释测试通过，找到', results.length, '个注释');
  });

  test('导入和模块注释查询 - 第三方库导入', async () => {
    const code = `
      # 第三方库导入
      import requests  # HTTP请求库
      import pandas as pd  # 数据处理库
      import numpy as np  # 数值计算库
      from flask import Flask, request  # Web框架
      from sqlalchemy import create_engine  # 数据库ORM
      
      # 使用第三方库
      def fetch_data():
          # 发送HTTP请求
          response = requests.get('https://api.example.com/data')
          # 使用pandas处理数据
          df = pd.DataFrame(response.json())
          return df
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

    console.log('Python第三方库导入注释测试通过，找到', results.length, '个注释');
  });

  test('调试和日志注释查询 - print调试', async () => {
    const code = `
      def debug_function(x: int, y: int) -> int:
          # 输入参数调试
          print(f'Input x: {x}, y: {y}')
          
          result = x + y
          # 中间结果调试
          print(f'Intermediate result: {result}')
          
          if result > 100:
              # 条件分支调试
              print('Result exceeds 100')
          
          # 返回值调试
          print(f'Final result: {result}')
          return result
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

    console.log('Python print调试注释测试通过，找到', results.length, '个注释');
  });

  test('调试和日志注释查询 - logging模块', async () => {
    const code = `
      import logging
      
      # 配置日志
      logging.basicConfig(
          level=logging.INFO,  # 设置日志级别
          format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
      )
      
      # 创建日志器
      logger = logging.getLogger(__name__)
      
      def process_data(data: dict) -> bool:
          # 信息日志
          logger.info(f'Processing data: {data}')
          
          try:
              # 调试日志
              logger.debug('Starting data processing')
              
              if not data:
                  # 警告日志
                  logger.warning('Empty data received')
                  return False
              
              # 错误日志
              logger.error('Data processing failed')
              return False
              
          except Exception as e:
              # 异常日志
              logger.exception(f'Exception occurred: {e}')
              return False
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

    console.log('Python logging模块注释测试通过，找到', results.length, '个注释');
  });
});