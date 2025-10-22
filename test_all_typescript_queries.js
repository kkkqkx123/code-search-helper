const Parser = require('tree-sitter');
const TypeScript = require('tree-sitter-typescript');

// 测试代码 - 包含各种TypeScript结构
const testCode = `
// Classes
class TestClass {
  constructor(public value: string) {}
  
  method(): void {
    console.log('test');
  }
}

abstract class AbstractClass {
  abstract abstractMethod(): void;
}

// Interfaces
interface TestInterface {
  method(): void;
}

// Functions
function testFunction(): void {
  console.log('test');
}

async function asyncFunction(): Promise<void> {
  await Promise.resolve();
}

const arrowFunction = () => {};

// Types
type TestType = string;

enum TestEnum {
  A, B, C
}

namespace TestNamespace {
  export const value = 42;
}

// Variables
let variable: string = 'test';
const constant: number = 42;
`;

function testAllQueries() {
  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);
  
  const tree = parser.parse(testCode);
  
  console.log('=== 测试所有TypeScript查询 ===\n');
  
  const queryFiles = [
    'classes',
    'exports', 
    'functions',
    'imports',
    'interfaces',
    'methods',
    'properties',
    'types',
    'variables'
  ];
  
  queryFiles.forEach(queryName => {
    try {
      // 动态导入查询
      const queryModule = require(`./src/service/parser/constants/queries/typescript/${queryName}.ts`);
      const queryString = queryModule.default;
      
      console.log(`=== 测试 ${queryName} 查询 ===`);
      console.log(`查询长度: ${queryString.length}`);
      console.log(`查询前100字符: ${queryString.substring(0, 100)}...`);
      
      const query = new Parser.Query(TypeScript.typescript, queryString);
      const matches = query.matches(tree.rootNode);
      
      console.log(`✅ ${queryName} 查询创建成功，找到 ${matches.length} 个匹配\n`);
      
    } catch (error) {
      console.log(`❌ ${queryName} 查询失败: ${error.message}\n`);
    }
  });
}

testAllQueries();