
# C语言查询规则与适配器测试实现方案

## 概述

本文档提供C语言查询规则与语言适配器协调关系的详细测试实现方案，包括测试框架设计、测试用例实现和测试执行策略。

## 1. 测试框架设计

### 1.1 测试架构

```
测试框架架构
├── 测试基础设施
│   ├── 测试工具类 (CParserTestUtils)
│   ├── 模拟数据生成器 (MockDataGenerator)
│   └── 断言扩展 (CustomAssertions)
├── 查询规则测试
│   ├── 语法验证测试
│   ├── 捕获模式测试
│   └── 查询结果验证测试
├── 适配器测试
│   ├── 标准化功能测试
│   ├── 映射关系测试
│   └── 元数据提取测试
├── 关系提取器测试
│   ├── 节点识别测试
│   ├── 关系提取测试
│   └── 元数据生成测试
└── 集成测试
    ├── 端到端流程测试
    ├── 协调关系验证测试
    └── 性能基准测试
```

### 1.2 测试工具类实现

#### 1.2.1 CParserTestUtils

```typescript
// src/service/parser/__tests__/utils/CParserTestUtils.ts
import Parser from 'tree-sitter';
import C from 'tree-sitter-c';
import { CLanguageAdapter } from '../../core/normalization/adapters/CLanguageAdapter';
import { QueryLoader } from '../../core/query/QueryLoader';

export class CParserTestUtils {
  private static parser: Parser;
  private static language: Parser.Language;
  private static adapter: CLanguageAdapter;

  static initialize() {
    this.parser = new Parser();
    this.language = new C();
    this.parser.setLanguage(this.language);
    this.adapter = new CLanguageAdapter();
  }

  /**
   * 解析C代码并返回AST
   */
  static parseCode(code: string): Parser.SyntaxNode {
    if (!this.parser) {
      this.initialize();
    }
    return this.parser.parse(code).rootNode;
  }

  /**
   * 执行Tree-sitter查询
   */
  static executeQuery(code: string, queryPattern: string): any[] {
    const tree = this.parseCode(code);
    const query = new Parser.Query(this.language, queryPattern);
    const captures = query.captures(tree);
    
    return captures.map(capture => ({
      name: capture.name,
      node: capture.node,
      text: capture.node.text
    }));
  }

  /**
   * 创建模拟查询结果
   */
  static createMockResult(captures: Array<{name: string, text: string, type?: string}>): any {
    return {
      captures: captures.map(c => ({
        name: c.name,
        node: {
          text: c.text,
          type: c.type || 'identifier',
          startPosition: { row: 0, column: 0 },
          endPosition: { row: 0, column: c.text.length }
        }
      }))
    };
  }

  /**
   * 验证查询规则与适配器的协调
   */
  static async verifyCoordination(
    queryFile: string,
    testCases: Array<{
      name: string;
      code: string;
      expectedCaptures: Array<{name: string, text: string}>;
      expectedType?: string;
    }>
  ): Promise<void> {
    const queryPattern = await QueryLoader.getQuery('c', queryFile);
    
    for (const testCase of testCases) {
      const results = this.executeQuery(testCase.code, queryPattern);
      
      // 验证捕获结果
      expect(results).toHaveLength(testCase.expectedCaptures.length);
      
      for (let i = 0; i < testCase.expectedCaptures.length; i++) {
        const expected = testCase.expectedCaptures[i];
        const actual = results[i];
        
        expect(actual.name).toBe(expected.name);
        expect(actual.text).toBe(expected.text);
      }
      
      // 验证适配器标准化
      const mockResult = this.createMockResult(
        testCase.expectedCaptures.map(c => ({ name: c.name, text: c.text }))
      );
      
      const standardized = await this.adapter.normalize(
        [mockResult],
        queryFile,
        'c'
      );
      
      if (testCase.expectedType) {
        expect(standardized[0].type).toBe(testCase.expectedType);
      }
      
      expect(standardized[0].name).toBeDefined();
      expect(standardized[0].nodeId).toBeDefined();
    }
  }

  /**
   * 测试关系提取器
   */
  static async testRelationshipExtractor(
    extractorName: string,
    testCases: Array<{
      name: string;
      code: string;
      expectedRelationships: Array<{
        type: string;
        fromNodeId?: string;
        toNodeId?: string;
        [key: string]: any;
      }>;
    }>
  ): Promise<void> {
    for (const testCase of testCases) {
      const astNode = this.parseCode(testCase.code);
      const mockResult = this.createMockResult([
        { name: 'test', text: testCase.code, type: astNode.type }
      ]);
      
      // 动态调用关系提取器
      const extractor = this.getExtractor(extractorName);
      const relationships = extractor.extractRelationships(mockResult);
      
      expect(relationships).toHaveLength(testCase.expectedRelationships.length);
      
      for (let i = 0; i < testCase.expectedRelationships.length; i++) {
        const expected = testCase.expectedRelationships[i];
        const actual = relationships[i];
        
        expect(actual.type).toBe(expected.type);
        
        if (expected.fromNodeId) {
          expect(actual.fromNodeId).toBeDefined();
        }
        
        if (expected.toNodeId) {
          expect(actual.toNodeId).toBeDefined();
        }
        
        // 验证其他属性
        Object.keys(expected).forEach(key => {
          if (key !== 'type' && key !== 'fromNodeId' && key !== 'toNodeId') {
            expect(actual[key]).toBe(expected[key]);
          }
        });
      }
    }
  }

  private static getExtractor(extractorName: string): any {
    // 根据名称获取对应的关系提取器实例
    const extractors: Record<string, any> = {
      'DataFlowRelationshipExtractor': new (require('../../core/normalization/adapters/c-utils/DataFlowRelationshipExtractor').DataFlowRelationshipExtractor)(),
      'ControlFlowRelationshipExtractor': new (require('../../core/normalization/adapters/c-utils/ControlFlowRelationshipExtractor').ControlFlowRelationshipExtractor)(),
      'SemanticRelationshipExtractor': new (require('../../core/normalization/adapters/c-utils/SemanticRelationshipExtractor').SemanticRelationshipExtractor)(),
      'CallRelationshipExtractor': new (require('../../core/normalization/adapters/c-utils/CallRelationshipExtractor').CallRelationshipExtractor)(),
    };
    
    return extractors[extractorName];
  }
}
```

#### 1.2.2 MockDataGenerator

```typescript
// src/service/parser/__tests__/utils/MockDataGenerator.ts
import Parser from 'tree-sitter';

export class MockDataGenerator {
  /**
   * 生成模拟AST节点
   */
  static createMockNode(
    text: string,
    type: string,
    startPosition = { row: 0, column: 0 },
    endPosition?: { row: number, column: number }
  ): Parser.SyntaxNode {
    return {
      text,
      type,
      startPosition,
      endPosition: endPosition || {
        row: startPosition.row,
        column: startPosition.column + text.length
      },
      childCount: 0,
      children: [],
      childForFieldName: jest.fn(),
      parent: null
    } as any;
  }

  /**
   * 生成模拟查询结果
   */
  static createMockQueryResult(
    captures: Array<{
      name: string;
      text: string;
      type?: string;
    }>
  ): any {
    return {
      captures: captures.map(c => ({
        name: c.name,
        node: this.createMockNode(c.text, c.type || 'identifier')
      }))
    };
  }

  /**
   * 生成C代码测试用例
   */
  static generateCTestCases(): Record<string, Array<{
    name: string;
    code: string;
    description: string;
  }>> {
    return {
      functions: [
        {
          name: 'simple_function',
          code: 'int add(int a, int b) { return a + b; }',
          description: '简单函数定义'
        },
        {
          name: 'function_with_pointer',
          code: 'void process(int* data) { *data = 42; }',
          description: '带指针参数的函数'
        },
        {
          name: 'function_call',
          code: 'result = calculate(x, y);',
          description: '函数调用'
        },
        {
          name: 'recursive_function',
          code: 'int factorial(int n) { return n <= 1 ? 1 : n * factorial(n - 1); }',
          description: '递归函数'
        }
      ],
      structs: [
        {
          name: 'simple_struct',
          code: 'struct Point { int x; int y; };',
          description: '简单结构体'
        },
        {
          name: 'nested_struct',
          code: 'struct Rectangle { struct Point top_left; struct Point bottom_right; };',
          description: '嵌套结构体'
        },
        {
          name: 'struct_with_function_pointer',
          code: 'struct Handler { void (*callback)(int); };',
          description: '包含函数指针的结构体'
        }
      ],
      dataFlow: [
        {
          name: 'simple_assignment',
          code: 'int x = y;',
          description: '简单赋值'
        },
        {
          name: 'parameter_passing',
          code: 'process(data);',
          description: '参数传递'
        },
        {
          name: 'return_value',
          code: 'return result;',
          description: '返回值'
        },
        {
          name: 'pointer_assignment',
          code: 'int* ptr = &variable;',
          description: '指针赋值'
        }
      ],
      controlFlow: [
        {
          name: 'if_statement',
          code: 'if (condition) { do_something(); }',
          description: 'if语句'
        },
        {
          name: 'for_loop',
          code: 'for (int i = 0; i < 10; i++) { process(i); }',
          description: 'for循环'
        },
        {
          name: 'while_loop',
          code: 'while (running) { update(); }',
          description: 'while循环'
        },
        {
          name: 'switch_statement',
          code: 'switch (value) { case 1: handle_one(); break; }',
          description: 'switch语句'
        }
      ]
    };
  }
}
```

## 2. 查询规则测试实现

### 2.1 函数查询测试

```typescript
// src/service/parser/__tests__/c-language/queries/functions.test.ts
import { CParserTestUtils } from '../../utils/CParserTestUtils';
import { MockDataGenerator } from '../../utils/MockDataGenerator';

describe('C Functions Query Tests', () => {
  beforeAll(() => {
    CParserTestUtils.initialize();
  });

  describe('Function Definition Queries', () => {
    it('should correctly parse simple function definitions', async () => {
      const testCases = [
        {
          name: 'simple_function',
          code: 'int add(int a, int b) { return a + b; }',
          expectedCaptures: [
            { name: 'function.name', text: 'add' },
            { name: 'function.body', text: '{ return a + b; }' },
            { name: 'definition.function', text: 'int add(int a, int b) { return a + b; }' }
          ],
          expectedType: 'function'
        },
        {
          name: 'void_function',
          code: 'void print_message(const char* msg) { printf("%s\\n", msg); }',
          expectedCaptures: [
            { name: 'function.name', text: 'print_message' },
            { name: 'function.body', text: '{ printf("%s\\n", msg); }' },
            { name: 'definition.function', text: 'void print_message(const char* msg) { printf("%s\\n", msg); }' }
          ],
          expectedType: 'function'
        }
      ];

      await CParserTestUtils.verifyCoordination('functions', testCases);
    });

    it('should correctly parse function prototypes', async () => {
      const testCases = [
        {
          name: 'function_prototype',
          code: 'int calculate(int x, int y);',
          expectedCaptures: [
            { name: 'function.name', text: 'calculate' },
            { name: 'definition.function.prototype', text: 'int calculate(int x, int y);' }
          ],
          expectedType: 'function'
        }
      ];

      await CParserTestUtils.verifyCoordination('functions', testCases);
    });

    it('should correctly parse function pointers', async () => {
      const testCases = [
        {
          name: 'function_pointer_declaration',
          code: 'int (*operation)(int, int);',
          expectedCaptures: [
            { name: 'function.pointer.name', text: 'operation' },
            { name: 'definition.function.pointer', text: 'int (*operation)(int, int);' }
          ],
          expectedType: 'function'
        }
      ];

      await CParserTestUtils.verifyCoordination('functions', testCases);
    });
  });

  describe('Function Call Queries', () => {
    it('should correctly parse function calls', async () => {
      const testCases = [
        {
          name: 'simple_call',
          code: 'result = add(a, b);',
          expectedCaptures: [
            { name: 'call.function', text: 'add' },
            { name: 'call.argument', text: 'a' },
            { name: 'call.argument', text: 'b' },
            { name: 'definition.function.call', text: 'add(a, b)' }
          ]
        }
      ];

      await CParserTestUtils.verifyCoordination('functions', testCases);
    });

    it('should correctly parse recursive calls', async () => {
      const testCases = [
        {
          name: 'recursive_call',
          code: 'return factorial(n - 1);',
          expectedCaptures: [
            { name: 'recursive.call', text: 'factorial' },
            { name: 'definition.recursive.call', text: 'factorial(n - 1)' }
          ]
        }
      ];

      await CParserTestUtils.verifyCoordination('functions', testCases);
    });
  });
});
```

### 2.2 数据流查询测试

```typescript
// src/service/parser/__tests__/c-language/queries/data-flow.test.ts
import { CParserTestUtils } from '../../utils/CParserTestUtils';

describe('C Data Flow Query Tests', () => {
  beforeAll(() => {
    CParserTestUtils.initialize();
  });

  describe('Assignment Data Flow', () => {
    it('should correctly parse variable assignments', async () => {
      const testCases = [
        {
          name: 'simple_assignment',
          code: 'x = y;',
          expectedCaptures: [
            { name: 'target.variable', text: 'x' },
            { name: 'source.variable', text: 'y' },
            { name: 'data.flow.assignment', text: 'x = y;' }
          ]
        },
        {
          name: 'compound_assignment',
          code: 'x += y;',
          expectedCaptures: [
            { name: 'target.variable', text: 'x' },
            { name: 'source.variable1', text: 'x' },
            { name: 'compound.operator', text: '+=' },
            { name: 'source.variable2', text: 'y' },
            { name: 'data.flow.compound.assignment', text: 'x += y;' }
          ]
        }
      ];

      await CParserTestUtils.verifyCoordination('data-flow', testCases);
    });

    it('should correctly parse pointer assignments', async () => {
      const testCases = [
        {
          name: 'pointer_assignment',
          code: 'ptr = &variable;',
          expectedCaptures: [
            { name: 'target.pointer', text: 'ptr' },
            { name: 'source.variable', text: 'variable' },
            { name: 'data.flow.address.assignment', text: 'ptr = &variable;' }
          ]
        }
      ];

      await CParserTestUtils.verifyCoordination('data-flow', testCases);
    });
  });

  describe('Function Parameter Data Flow', () => {
    it('should correctly parse parameter passing', async () => {
      const testCases = [
        {
          name: 'parameter_passing',
          code: 'process(data, count);',
          expectedCaptures: [
            { name: 'target.function', text: 'process' },
            { name: 'source.parameter', text: 'data' },
            { name: 'source.parameter', text: 'count' },
            { name: 'data.flow.parameter.passing', text: 'process(data, count)' }
          ]
        }
      ];

      await CParserTestUtils.verifyCoordination('data-flow', testCases);
    });
  });

  describe('Return Value Data Flow', () => {
    it('should correctly parse return values', async () => {
      const testCases = [
        {
          name: 'return_variable',
          code: 'return result;',
          expectedCaptures: [
            { name: 'source.variable', text: 'result' },
            { name: 'data.flow.return.value', text: 'return result;' }
          ]
        },
        {
          name: 'return_function_call',
          code: 'return calculate(x, y);',
          expectedCaptures: [
            { name: 'source.function', text: 'calculate' },
            { name: 'data.flow.return.value', text: 'return calculate(x, y);' }
          ]
        }
      ];

      await CParserTestUtils.verifyCoordination('data-flow', testCases);
    });
  });
});
```

## 3. 适配器测试实现

### 3.1 CLanguageAdapter测试

```typescript
// src/service/parser/__tests__/c-language/adapters/CLanguageAdapter.test.ts
import { CLanguageAdapter } from '../../../core/normalization/adapters/CLanguageAdapter';
import { MockDataGenerator } from '../../utils/MockDataGenerator';
import { CParserTestUtils } from '../../utils/CParserTestUtils';

describe('CLanguageAdapter Tests', () => {
  let adapter: CLanguageAdapter;

  beforeAll(() => {
    adapter = new CLanguageAdapter();
    CParserTestUtils.initialize();
  });

  describe('Query Type Mapping', () => {
    it('should correctly map function queries', () => {
      const supportedTypes = adapter.getSupportedQueryTypes();
      expect(supportedTypes).toContain('functions');
      expect(supportedTypes).toContain('structs');
      expect(supportedTypes).toContain('variables');
    });

    it('should correctly map query types to standard types', () => {
      expect(adapter.mapQueryTypeToStandardType('functions')).toBe('function');
      expect(adapter.mapQueryTypeToStandardType('structs')).toBe('class');
      expect(adapter.mapQueryTypeToStandardType('variables')).toBe('variable');
    });
  });

  describe('Node Type Mapping', () => {
    it('should correctly map C node types', () => {
      expect(adapter.mapNodeType('function_definition')).toBe('function');
      expect(adapter.mapNodeType('struct_specifier')).toBe('struct');
      expect(adapter.mapNodeType('call_expression')).toBe('call');
    });
  });

  describe('Name Extraction', () => {
    it('should extract function names correctly', () => {
      const mockResult = MockDataGenerator.createMockQueryResult([
        { name: 'function.name', text: 'testFunction' }
      ]);
      
      const name = adapter.extractName(mockResult);
      expect(name).toBe('testFunction');
    });

    it('should extract struct names correctly', () => {
      const mockResult = MockDataGenerator.createMockQueryResult([
        { name: 'type.name', text: 'TestStruct' }
      ]);
      
      const name = adapter.extractName(mockResult);
      expect(name).toBe('TestStruct');
    });

    it('should return unnamed when no name found', () => {
      const mockResult = MockDataGenerator.createMockQueryResult([
        { name: 'other.capture', text: 'someValue' }
      ]);
      
      const name = adapter.extractName(mockResult);
      expect(name).toBe('unnamed');
    });
  });

  describe('Normalization', () => {
    it('should normalize function definitions correctly', async () => {
      const mockResult = MockDataGenerator.createMockQueryResult([
        { name: 'function.name', text: 'calculateSum' },
        { name: 'function.body', text: '{ return a + b; }' }
      ]);
      
      const results = await adapter.normalize([mockResult], 'functions', 'c');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('function');
      expect(results[0].name).toBe('calculateSum');
      expect(results[0].nodeId).toBeDefined();
      expect(results[0].metadata).toBeDefined();
    });

    it('should normalize struct definitions correctly', async () => {
      const mockResult = MockDataGenerator.createMockQueryResult([
        { name: 'type.name', text: 'Point' },
        { name: 'field.name', text: 'x' },
        { name: 'field.type', text: 'int' }
      ]);
      
      const results = await adapter.normalize([mockResult], 'structs', 'c');
      
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('class');
      expect(results[0].name).toBe('Point');
      expect(results[0].nodeId).toBeDefined();
    });
  });

  describe('Dependency Extraction', () => {
    it('should extract function call dependencies', () => {
      const mockNode = MockDataGenerator.createMockNode('result = calculate(x, y);', 'expression_statement');
      const mockResult = { captures: [{ node: mockNode }] };
      
      const dependencies = adapter.extractDependencies(mockResult);
      expect(dependencies).toContain('calculate');
    });

    it('should extract type dependencies', () => {
      const mockNode = MockDataGenerator.createMockNode('struct Point p;', 'declaration');
      const mockResult = { captures: [{ node: mockNode }] };
      
      const dependencies = adapter.extractDependencies(mockResult);
      expect(dependencies).toContain('Point');
    });
  });

  describe('Modifier Extraction', () => {
    it('should extract C language modifiers', () => {
      const mockNode = MockDataGenerator.createMockNode('static const int MAX_SIZE = 100;', 'declaration');
      const mockResult = { captures: [{ node: mockNode }] };
      
      const modifiers = adapter.extractModifiers(mockResult);
      expect(modifiers).toContain('static');
      expect(modifiers).toContain('const');
    });
  });

  describe('Complexity Calculation', () => {
    it('should calculate complexity based on C language features', () => {
      const mockNode = MockDataGenerator.createMockNode('static void* malloc(size_t size);', 'declaration');
      const mockResult = { captures: [{ node: mockNode }] };
      
      const complexity = adapter.calculateComplexity(mockResult);
      expect(complexity).toBeGreaterThan(0);
    });
  });
});
```

## 4. 关系提取器测试实现

### 4.1 数据流关系提取器测试

```typescript
// src/service/parser/__tests__/c-language/extractors/DataFlowRelationshipExtractor.test.ts
import { DataFlowRelationshipExtractor } from '../../../core/normalization/adapters/c-utils/DataFlowRelationshipExtractor';
import { MockDataGenerator } from '../../utils/MockDataGenerator';
import { CParserTestUtils } from '../../utils/CParserTestUtils';

describe('DataFlowRelationshipExtractor Tests', () => {
  let extractor: DataFlowRelationshipExtractor;

  beforeAll(() => {
    extractor = new DataFlowRelationshipExtractor();
    CParserTestUtils.initialize();
  });

  describe('Data Flow Node Identification', () => {
    it('should identify assignment expressions', () => {
      const astNode = CParserTestUtils.parseCode('x = y;');
      const mockResult = MockDataGenerator.createMockQueryResult([
        { name: 'test', text: 'x = y;', type: 'assignment_expression' }
      ]);
      
      const relationships = extractor.extractDataFlowRelationships(mockResult);
      expect(relationships).toHaveLength(1);
      expect(relationships[0].type).toBe('data-flow');
    });

    it('should identify parameter declarations', () => {
      const astNode = CParserTestUtils.parseCode('int param');
      const mockResult = MockDataGenerator.createMockQueryResult([
        { name: 'test', text: 'int param', type: 'parameter_declaration' }
      ]);
      
      const relationships = extractor.extractDataFlowRelationships(mockResult);
      expect(relationships).toHaveLength(1);
      expect(relationships[0].type).toBe('data-flow');
    });

    it('should ignore non-data-flow nodes', () => {
      const mockResult = MockDataGenerator.createMockQueryResult([
        { name: 'test', text: 'if (condition)', type: 'if_statement' }
      ]);
      
      const relationships = extractor.extractDataFlowRelationships(mockResult);
      expect(relationships).toHaveLength(0);
    });
  });

  describe('Data Flow Type Determination', () => {
    it('should determine variable assignment flow type', () => {
      const astNode = CParserTestUtils.parseCode('x = y;');
      const mockResult = MockDataGenerator.createMockQueryResult([
        { name: 'test', text: 'x = y;', type: 'assignment_expression' }
      ]);
      
      const relationships = extractor.extractDataFlowRelationships(mockResult);
      expect(relationships[0].flowType).toBe('variable_assignment');
    });

    it('should determine parameter passing flow type', () => {
      const mockResult = MockDataGenerator.createMockQueryResult([
        { name: 'test', text: 'int param', type: 'parameter_declaration' }
      ]);
      
      const relationships = extractor.extractDataFlowRelationships(mockResult);
      expect(relationships[0].flowType).toBe('parameter_passing');
    });

    it('should determine return value flow type', () => {
      const mockResult = MockDataGenerator.createMockQueryResult([
        { name: 'test', text: 'return result;', type: 'return_statement' }
      ]);
      
      const relationships = extractor.extractDataFlowRelationships(mockResult);
      expect(relationships[0].flowType).toBe('return_value');
    });
  });

  describe('Data Flow Metadata Extraction', () => {
    it('should extract correct metadata for assignment', () => {
      const astNode = CParserTestUtils.parseCode('x = y;');
      const mockResult = MockDataGenerator.createMockQueryResult([
        { name: 'test', text: 'x = y;', type: 'assignment_expression' }
      ]);
      
      const metadata = extractor.extractDataFlowMetadata(mockResult, astNode, null);
      
      expect(metadata).toBeDefined();
      expect(metadata.type).toBe('data-flow');
      expect(metadata.flowType).toBe('variable_assignment');
      expect(metadata.fromNodeId).toBeDefined();
      expect(metadata.toNodeId).toBeDefined();
      expect(metadata.location).toBeDefined();
    });

    it('should extract data type information', () => {
      const astNode = CParserTestUtils.parseCode('int x = y;');
      const mockResult = MockDataGenerator.createMockQueryResult([
        { name: 'test', text: 'int x = y;', type: 'assignment_expression' }
      ]);
      
      const metadata = extractor.extractDataFlowMetadata(mockResult, astNode, null);
      
      expect(metadata.dataType).toBeDefined();
    });
  });

  describe('Complex Data Flow Scenarios', () => {
    it('should handle pointer assignments', () => {
      const testCases = [
        {
          name: 'pointer_assignment',
          code: 'ptr = &variable;',
          expectedRelationships: [
            {
              type: 'data-flow',
              flowType: 'variable_assignment'
            }
          ]
        },
        {
          name: 'pointer_dereference_assignment',
          code: '*ptr = value;',
          expectedRelationships: [
            {
              type: 'data-flow',
              flowType: 'variable_assignment'
            }
          ]
        }
      ];

      CParserTestUtils.testRelationshipExtractor('DataFlowRelationshipExtractor', testCases);
    });

    it('should handle array assignments', () => {
      const testCases = [
        {
          name: 'array_element_assignment',
          code: 'arr[0] = value;',
          expectedRelationships: [
            {
              type: 'data-flow',
              flowType: 'variable_assignment'
            }
          ]
        }
      ];

      CParserTestUtils.testRelationshipExtractor('DataFlowRelationshipExtractor', testCases);
    });
  });
});
```

## 5. 集成测试实现

### 5.1 端到端协调测试

```typescript
// src/service/parser/__tests__/c-language/integration/query-adapter-coordination.test.ts
import { CLanguageAdapter } from '../../../core/normalization/adapters/CLanguageAdapter';
import { QueryLoader } from '../../../core/query/QueryLoader';
import { CParserTestUtils } from '../../utils/CParserTestUtils';
import { MockDataGenerator } from '../../utils/MockDataGenerator';

describe('Query-Adapter Coordination Integration Tests', () => {
  let adapter: CLanguageAdapter;

  beforeAll(() => {
    adapter = new CLanguageAdapter();
    CParserTestUtils.initialize();
  });

  describe('Functions Query Coordination', () => {
    it('should coordinate function queries with adapter correctly', async () => {
      const testCode = `
        int calculate(int a, int b) {
          return a + b;
        }
        
        int main() {
          int result = calculate(5, 3);
          return result;
        }
      `;

      // 执行查询
      const queryPattern = await QueryLoader.getQuery('c', 'functions');
      const queryResults = CParserTestUtils.executeQuery(testCode, queryPattern);

      // 适配器标准化
      const standardizedResults = await adapter.normalize(queryResults, 'functions', 'c');

      // 验证结果
      expect(standardizedResults.length).toBeGreaterThan(0);
      
      // 验证函数定义
      const functionDefinitions = standardizedResults.filter(r => r.type === 'function');
      expect(functionDefinitions.length).toBeGreaterThanOrEqual(1);
      
      const calculateFunction = functionDefinitions.find(f => f.name === 'calculate');
      expect(calculateFunction).toBeDefined();
      expect(calculateFunction?.metadata).toBeDefined();
      
      // 验证函数调用
      const functionCalls = standardizedResults.filter(r => r.type === 'call');
      expect(functionCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle complex function scenarios', async () => {
      const testCode = `
        typedef struct {
          int (*operation)(int, int);
        } MathOperation;
        
        int add(int a, int b) { return a + b; }
        int multiply(int a, int b) { return a * b; }
        
        int execute(MathOperation* op, int x, int y) {
          return op->operation(x, y);
        }
      `;

      const queryPattern = await QueryLoader.getQuery('c', 'functions');
      const queryResults = CParserTestUtils.executeQuery(testCode, queryPattern);
      const standardizedResults = await adapter.normalize(queryResults, 'functions', 'c');

      // 验证函数指针
      const functionPointers = standardizedResults.filter(r => 
        r.name && r.name.includes('operation')
      );
      expect(functionPointers.length).toBeGreaterThan(0);

      // 验证关系提取
      for (const result of queryResults) {
        const relationships = adapter.extractDataFlowRelationships(result);
        // 验证关系提取不会出错
        expect(Array.isArray(relationships)).toBe(true);
      }
    });
  });

  describe('Data Flow Query Coordination', () => {
    it('should coordinate data flow queries with adapter correctly', async () => {
      const testCode = `
        void process_data() {
          int input = get_input();
          int processed = transform(input);
          int result = finalize(processed);
          output(result);
        }
      `;

      const queryPattern = await QueryLoader.getQuery('c', 'data-flow');
      const queryResults = CParserTestUtils.executeQuery(testCode, queryPattern);
      const standardizedResults = await adapter.normalize(queryResults, 'data-flow', 'c');

      // 验证数据流关系
      expect(standardizedResults.length).toBeGreaterThan(0);
      
      const dataFlowResults = standardizedResults.filter(r => r.type === 'data-flow');
      expect(dataFlowResults.length).toBeGreaterThan(0);

      // 验证数据流元数据
      for (const result of dataFlowResults) {
        expect(result.metadata).toBeDefined();
        expect(result.metadata.flowType).toBeDefined();
      }
    });
  });

  describe('Multi-Query Coordination', () => {
    it('should handle multiple query types coordination', async () => {
      const testCode = `
        #include <stdio.h>
        #include <stdlib.h>
        
        typedef struct {
          int id;
          char* name;
        } User;
        
        User* create_user(int id, char* name) {
          User* user = (User*)malloc(sizeof(User));
          user->id = id;
          user->name = name;
          return user;
        }
        
        void print_user(User* user) {
          printf("User %d: %s\\n", user->id, user->name);
        }
      `;

      // 执行多种查询
      const queryTypes = ['functions', 'structs', 'data-flow', 'preprocessor'];
      const allResults = [];

      for (const queryType of queryTypes) {
        const queryPattern = await QueryLoader.getQuery('c', queryType);
        const queryResults = CParserTestUtils.executeQuery(testCode, queryPattern);
        const standardizedResults = await adapter.normalize(queryResults, queryType, 'c');
        allResults.push(...standardizedResults);
      }

      // 验证结果完整性
      expect(allResults.length).toBeGreaterThan(0);
      
      // 验证不同类型的结果
      const functionResults = allResults.filter(r => r.type === 'function');
      const structResults = allResults.filter(r => r.type === 'class');
      const dataFlowResults = allResults.filter(r => r.type === 'data-flow');
      const preprocessorResults = allResults.filter(r => r.type === 'expression');

      expect(functionResults.length).toBeGreaterThan(0);
      expect(structResults.length).toBeGreaterThan(0);
      expect(dataFlowResults.length).toBeGreaterThan(0);
      expect(preprocessorResults.length).toBeGreaterThan(0);

      // 验证节点ID唯一性
      const nodeIds = allResults.map(r => r.nodeId);
      const uniqueNodeIds = [...new Set(nodeIds)];
      expect(uniqueNodeIds.length).toBe(nodeIds.length);
    });
  });

  describe('Error Handling Coordination', () => {
    it('should handle malformed code gracefully', async () => {
      const malformedCode = `
        int broken_function( {
          // 缺少参数和右括号
          return 42;
      `;

      // 即使代码有语法错误，适配器也应该能处理
      try {
        const queryPattern = await QueryLoader.getQuery('c', 'functions');
        const queryResults = CParserTestUtils.executeQuery(malformedCode, queryPattern);
        const standardizedResults = await adapter.normalize(queryResults, 'functions', 'c');
        
        // 应该返回空结果或错误结果，而不是崩溃
        expect(Array.isArray(standardizedResults)).toBe(true);
      } catch (error) {
        // 如果抛出错误，应该是预期的解析错误
        expect(error).toBeDefined();
      }
    });

    it('should handle unexpected query results gracefully', async () => {
      const unexpectedResult = {
        captures: [
          {
            name: 'unexpected.capture',
            node: {
              text: 'unexpected',
              type: 'unexpected_type',
              startPosition: { row: 0, column: 0 },
              endPosition: { row: 0, column: 9 }
            }
          }
        ]
      };

      // 适配器应该能处理意外的查询结果
      const standardizedResults = await adapter.normalize([unexpectedResult], 'functions', 'c');
      
      expect(standardizedResults).toHaveLength(1);
      expect(standardizedResults[0].name).toBe('unnamed'); // 回退到默认名称
    });
  });
});
```

## 6. 测试执行策略

### 6.1 测试运行配置

```json
// jest.config.js 添加C语言解析器测试配置
module.exports = {
  // ... 其他配置
  testMatch: [
    '**/src/service/parser/__tests__/c-language/**/*.test.ts'
  ],
  setupFilesAfterEnv: [
    '<rootDir>/src/service/parser/__tests__/setup/c-parser-test-setup.ts'
  ],
  collectCoverageFrom: [
    'src/service/parser/core/normalization/adapters/CLanguageAdapter.ts',
    'src/service/parser/core/normalization/adapters/c-utils/*.ts',
    'src/service/parser/constants/queries/c/*.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

### 6.2 测试环境设置

