const fs = require('fs');

// 读取JSON文件
const testData = JSON.parse(fs.readFileSync('d:/ide/tool/code-search-helper/src/service/parser/__tests__/c/lifecycle-relationships/c-lifecycle-relationships.json', 'utf8'));

// 手动创建一个完全正确的查询模式 - 逐行构建确保括号匹配
const absolutelyCorrectQuery = `(function_definition
  declarator: (function_declarator
    declarator: (identifier) @resource.constructor))
  body: (compound_statement
    (expression_statement
      (call_expression
        function: (identifier) @resource.allocation.function)))
  (#set! "operation" "construct")) @lifecycle.relationship.resource.constructor`;

console.log('绝对正确的查询模式:');
console.log(absolutelyCorrectQuery);

// 检查括号匹配
function checkParentheses(query) {
  let count = 0;
  for (let char of query) {
    if (char === '(') count++;
    if (char === ')') count--;
  }
  return count === 0;
}

console.log('\n查询括号匹配:', checkParentheses(absolutelyCorrectQuery));

// 手动检查括号
let count = 0;
let position = 0;
for (let char of absolutelyCorrectQuery) {
  if (char === '(') {
    count++;
    console.log(`位置 ${position}: '(' - 计数: ${count}`);
  } else if (char === ')') {
    count--;
    console.log(`位置 ${position}: ')' - 计数: ${count}`);
  }
  position++;
}

console.log(`\n最终括号计数: ${count}`);

// 创建真正正确的查询模式 - 手动修复
// 问题在于最后一行有多余的右括号
const lines = absolutelyCorrectQuery.split('\n');
console.log('\n按行分析:');
lines.forEach((line, index) => {
  let lineCount = 0;
  for (let char of line) {
    if (char === '(') lineCount++;
    if (char === ')') lineCount--;
  }
  console.log(`行 ${index}: ${lineCount > 0 ? '+' : ''}${lineCount} (${line.trim()})`);
});

// 修复最后一行 - 移除多余的右括号
const fixedLines = [...lines];
const lastLine = fixedLines[fixedLines.length - 1];
// 移除最后一个多余的右括号
fixedLines[fixedLines.length - 1] = lastLine.substring(0, lastLine.length - 1);

const finalQuery = fixedLines.join('\n');

console.log('\n最终正确的查询模式:');
console.log(finalQuery);

console.log('\n最终查询括号匹配:', checkParentheses(finalQuery));

// 更新测试用例22（索引21）
testData.requests[21].query = finalQuery;

// 写回文件
fs.writeFileSync('d:/ide/tool/code-search-helper/src/service/parser/__tests__/c/lifecycle-relationships/c-lifecycle-relationships.json', JSON.stringify(testData, null, 2));

console.log('\n已修复问题22的查询模式');