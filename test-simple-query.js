const Parser = require('tree-sitter');
const C = require('tree-sitter-c');

// 初始化解析器
const parser = new Parser();
const language = C;
parser.setLanguage(language);

// 简单的测试查询模式
const simpleQuery = `
(call_expression
  function: (identifier) @test.function
  (#match? @test.function "^(pthread_create)$")
  arguments: (argument_list)) @test.relationship
`;

try {
  const query = new Parser.Query(language, simpleQuery);
  console.log('✅ 简单查询语法正确');
} catch (error) {
  console.log('❌ 简单查询语法错误:', error.message);
}

// 测试完整的并发关系查询
const fs = require('fs');
const content = fs.readFileSync('src/service/parser/constants/queries/c/concurrency-relationships.ts', 'utf8');
const queryContent = content.substring(content.indexOf('export default `') + 15, content.lastIndexOf('`'));

console.log('查询内容长度:', queryContent.length);

// 分段测试查询模式
const patterns = queryContent.split('\n\n');
console.log('模式数量:', patterns.length);

let validCount = 0;
let errorCount = 0;

for (let i = 0; i < patterns.length; i++) {
  const pattern = patterns[i].trim();
  if (pattern && !pattern.startsWith(';')) {
    try {
      const query = new Parser.Query(language, pattern);
      validCount++;
    } catch (error) {
      errorCount++;
      console.log(`❌ 模式 ${i+1} 语法错误:`, error.message);
      console.log('模式内容:', pattern.substring(0, 100) + '...');
    }
  }
}

console.log(`\n结果: ${validCount} 个模式有效, ${errorCount} 个模式有错误`);