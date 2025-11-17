import Parser from 'tree-sitter';
import C from 'tree-sitter-c';
import { QueryLoader } from '../../core/query/QueryLoader';

// 初始化解析器
const parser = new Parser();
const language = C as any;
parser.setLanguage(language);

describe('C语言结构体查询模式分析测试', () => {
  beforeAll(async () => {
    // 确保C语言查询已加载
    await QueryLoader.loadLanguageQueries('c');
  });

  test('分析tree-sitter结构体查询捕获的实际行为', async () => {
    const code = `
      // 基础结构体定义
      struct Point {
        int x;
        int y;
      };
      
      // 联合体定义
      union Data {
        int i;
        float f;
        char str[20];
      };
      
      // 枚举定义
      enum Color {
        RED,
        GREEN,
        BLUE
      };
      
      // 类型别名
      typedef int Integer;
      
      // 数组声明
      int numbers[10];
      
      // 指针声明
      int *ptr;
      
      // 函数指针
      int (*func_ptr)(int, int);
      
      // 结构体成员访问
      struct Point p;
      p.x = 10;
      p.y = 20;
      
      // 指针成员访问
      struct Point *p_ptr = &p;
      p_ptr->x = 30;
      
      // 数组访问
      numbers[0] = 100;
      
      // 嵌套结构体
      struct Outer {
        struct Inner {
          int value;
        } inner;
      };
      
      // 位域
      struct BitField {
        unsigned int flag1 : 1;
        unsigned int flag2 : 2;
      };
      
      // 函数指针字段
      struct Callback {
        int (*callback)(int);
      };
      
      // 前向声明
      struct ForwardDecl;
      union ForwardUnion;
      enum ForwardEnum;
    `;

    const tree = parser.parse(code);
    const queryPattern = await QueryLoader.getQuery('c', 'structs');
    const query = new Parser.Query(language, queryPattern);
    const captures = query.captures(tree.rootNode);

    console.log('=== 结构体查询模式 ===');
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
        endPosition: capture.node.endPosition,
        nodeType: capture.node.type
      });
    });

    // 分析每个捕获组
    Object.entries(captureGroups).forEach(([captureName, captures]) => {
      console.log(`\n--- ${captureName} (${captures.length}个) ---`);
      captures.forEach(capture => {
        console.log(`  [${capture.index}] ${capture.text}`);
        console.log(`    类型: ${capture.nodeType}`);
        console.log(`    位置: ${capture.startPosition.row + 1}:${capture.startPosition.column} - ${capture.endPosition.row + 1}:${capture.endPosition.column}`);
      });
    });

    // 验证关键问题：相同的节点是否被多个查询模式捕获？
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
    console.log(`唯一节点数: ${nodeTexts.size}`);
    console.log(`重复捕获数: ${duplicateCount}`);
    
    // 验证查询模式是否真的能区分不同类型的结构体声明
    console.log('\n=== 查询模式有效性分析 ===');
    
    // 检查是否有特定的查询模式能匹配到特定的结构体类型
    const expectedPatterns = {
      'definition.struct': ['struct Point', 'struct Outer'],
      'definition.union': ['union Data'],
      'definition.enum': ['enum Color'],
      'definition.type.alias': ['typedef int Integer'],
      'definition.array': ['int numbers[10]'],
      'definition.pointer': ['int *ptr'],
      'definition.function.pointer': ['int (*func_ptr)(int, int)'],
      'definition.member.access': ['p.x', 'p.y'],
      'definition.pointer.member.access': ['p_ptr->x'],
      'definition.array.access': ['numbers[0]'],
      'definition.nested.struct': ['struct Inner'],
      'definition.bitfield': ['unsigned int flag1 : 1'],
      'definition.function.pointer.field': ['int (*callback)(int)'],
      'definition.forward.struct': ['struct ForwardDecl'],
      'definition.forward.union': ['union ForwardUnion'],
      'definition.forward.enum': ['enum ForwardEnum']
    };

    Object.entries(expectedPatterns).forEach(([pattern, expectedTexts]) => {
      const patternCaptures = captureGroups[pattern] || [];
      const matchedTexts = patternCaptures.map(c => c.text);
      
      console.log(`\n${pattern}:`);
      console.log(`  期望匹配: ${expectedTexts.join(', ')}`);
      console.log(`  实际捕获数: ${patternCaptures.length}`);
      
      if (patternCaptures.length > 0) {
        console.log(`  匹配的节点:`);
        matchedTexts.forEach(text => {
          console.log(`    - ${text.trim()}`);
        });
        
        // 检查是否匹配到期望的文本
        const matchedExpected = expectedTexts.some(expected => 
          matchedTexts.some(text => text.includes(expected))
        );
        console.log(`  匹配期望: ${matchedExpected ? '✅' : '❌'}`);
      } else {
        console.log(`  ⚠️  未找到匹配的节点`);
      }
    });

    // 检查查询模式之间的冲突
    console.log('\n=== 查询模式冲突分析 ===');
    const conflictingPatterns = new Set<string>();
    
    Object.keys(expectedPatterns).forEach(pattern1 => {
      Object.keys(expectedPatterns).forEach(pattern2 => {
        if (pattern1 !== pattern2) {
          const captures1 = captureGroups[pattern1] || [];
          const captures2 = captureGroups[pattern2] || [];
          
          // 检查是否有相同的节点被两个模式捕获
          const commonNodes = captures1.filter(c1 => 
            captures2.some(c2 => c1.text === c2.text)
          );
          
          if (commonNodes.length > 0) {
            conflictingPatterns.add(`${pattern1} <-> ${pattern2}`);
            console.log(`冲突: ${pattern1} 和 ${pattern2}`);
            commonNodes.forEach(node => {
              console.log(`  共同节点: ${node.text.trim()}`);
            });
          }
        }
      });
    });

    console.log(`\n总冲突数: ${conflictingPatterns.size}`);
    
    // 结论
    console.log('\n=== 结论 ===');
    if (duplicateCount > 0) {
      console.log('⚠️  发现重复捕获：相同的节点被多个查询模式匹配');
      console.log('   这意味着tree-sitter查询模式无法真正区分结构体类型');
    } else {
      console.log('✅ 没有重复捕获：每个查询模式匹配不同的节点');
    }
    
    if (conflictingPatterns.size > 0) {
      console.log('⚠️  发现查询模式冲突：某些模式捕获了相同的节点');
    } else {
      console.log('✅ 没有查询模式冲突：各模式独立工作');
    }
  });

  test('验证结构体查询模式的语法正确性', async () => {
    const queryPattern = await QueryLoader.getQuery('c', 'structs');
    const validation = QueryLoader.validateQuerySyntax(queryPattern);
    
    console.log('\n=== 结构体查询语法验证 ===');
    console.log(`验证结果: ${validation.valid ? '✅ 有效' : '❌ 无效'}`);
    
    if (!validation.valid) {
      console.log('语法错误:');
      validation.errors.forEach(error => {
        console.log(`  - ${error}`);
      });
    }
    
    expect(validation.valid).toBe(true);
  });

  test('测试结构体查询模式的区分能力', async () => {
    // 测试各种结构体声明的区分能力
    const testCases = [
      {
        name: '简单结构体',
        code: 'struct Point { int x; int y; };',
        expectedPatterns: ['definition.struct', 'type.name', 'field.name', 'field.type']
      },
      {
        name: '联合体',
        code: 'union Data { int i; float f; };',
        expectedPatterns: ['definition.union', 'type.name', 'field.name', 'field.type']
      },
      {
        name: '枚举',
        code: 'enum Color { RED, GREEN, BLUE };',
        expectedPatterns: ['definition.enum', 'type.name', 'enum.constant']
      },
      {
        name: '类型别名',
        code: 'typedef int Integer;',
        expectedPatterns: ['definition.type.alias', 'original.type', 'alias.name']
      },
      {
        name: '数组声明',
        code: 'int arr[10];',
        expectedPatterns: ['definition.array', 'array.name']
      },
      {
        name: '指针声明',
        code: 'int *ptr;',
        expectedPatterns: ['definition.pointer', 'pointer.name']
      },
      {
        name: '成员访问',
        code: 'struct Point p; p.x = 10;',
        expectedPatterns: ['definition.member.access', 'object.name', 'field.name']
      },
      {
        name: '指针成员访问',
        code: 'struct Point *p_ptr; p_ptr->x = 10;',
        expectedPatterns: ['definition.pointer.member.access', 'pointer.name', 'field.name']
      }
    ];

    for (const testCase of testCases) {
      console.log(`\n=== 测试: ${testCase.name} ===`);
      console.log(`代码: ${testCase.code}`);
      
      const tree = parser.parse(testCase.code);
      const queryPattern = await QueryLoader.getQuery('c', 'structs');
      const query = new Parser.Query(language, queryPattern);
      const captures = query.captures(tree.rootNode);

      const captureNames = [...new Set(captures.map(c => c.name))];
      console.log(`捕获的模式: ${captureNames.join(', ')}`);
      
      const missingPatterns = testCase.expectedPatterns.filter(pattern => 
        !captureNames.includes(pattern)
      );
      
      if (missingPatterns.length > 0) {
        console.log(`❌ 缺失模式: ${missingPatterns.join(', ')}`);
      } else {
        console.log('✅ 所有期望模式都匹配成功');
      }
      
      // 验证没有意外的捕获模式
      const unexpectedPatterns = captureNames.filter(pattern => 
        !testCase.expectedPatterns.includes(pattern)
      );
      
      if (unexpectedPatterns.length > 0) {
        console.log(`⚠️  意外模式: ${unexpectedPatterns.join(', ')}`);
      }
    }
  });
});