import { BalancedChunker } from './src/service/parser/splitting/BalancedChunker';

// Simple console log function to replace mock logger
const mockLogger: any = {
  debug: console.log,
  info: console.log,
  warn: console.log,
  error: console.log,
};

console.log('Testing template string handling...');

const chunker = new BalancedChunker(mockLogger);

console.log('Initial state:', JSON.stringify(chunker['symbolStack']));

chunker.analyzeLineSymbols('const str = `Hello ${');
console.log('After `const str = `Hello ${`:', JSON.stringify(chunker['symbolStack']));
console.log('Can safely split:', chunker.canSafelySplit());

chunker.analyzeLineSymbols('  name');
console.log('After `  name`:', JSON.stringify(chunker['symbolStack']));
console.log('Can safely split:', chunker.canSafelySplit());

// 逐字符分析 '}`;'
console.log('\n--- 逐字符分析 `}`; ---');
const line = '}`;';
let inSingleComment = false;
let inMultiComment = false;
let inString = true; // 我们在模板字符串中
let stringChar = '`';
let templateExprDepth = 1; // 我们在表达式中

console.log('初始状态: inString=', inString, 'stringChar=', stringChar, 'templateExprDepth=', templateExprDepth);

for (let i = 0; i < line.length; i++) {
  const char = line[i];
  const nextChar = line[i + 1];
  
  console.log(`处理字符 '${char}' (位置 ${i})`);
  
  // 跳过注释和字符串内容
  if (inSingleComment) {
    console.log('  在单行注释中，跳过');
    continue;
  }
  if (inMultiComment) {
    if (char === '*' && nextChar === '/') {
      inMultiComment = false;
      i++; // 跳过'*/'
      console.log('  结束多行注释');
    }
    continue;
  }
  if (inString) {
    // 处理转义字符
    if (char === '\\' && i + 1 < line.length) {
      i++; // 跳过下一个字符
      console.log('  转义字符，跳过下一个字符');
      continue;
    }
    
    // 处理模板字符串中的表达式
    if (stringChar === '`' && char === '$' && nextChar === '{') {
      templateExprDepth++;
      console.log('  开始模板表达式，templateExprDepth=', templateExprDepth);
      i++; // 跳过'{'
      continue;
    }
    
    // 处理模板字符串中表达式的结束
    if (stringChar === '`' && char === '}' && templateExprDepth > 0) {
      templateExprDepth--;
      console.log('  结束模板表达式，templateExprDepth=', templateExprDepth);
      continue;
    }
    
    // 结束字符串（对于模板字符串，只有在顶层时才能结束）
    if (char === stringChar && (stringChar !== '`' || templateExprDepth === 0)) {
      inString = false;
      console.log('  结束字符串');
      continue;
    }
    
    console.log('  在字符串中，跳过');
    continue;
  }
  
  console.log('  不在字符串中');
}

chunker.analyzeLineSymbols('}`;');
console.log('After `};`:', JSON.stringify(chunker['symbolStack']));
console.log('Can safely split:', chunker.canSafelySplit());