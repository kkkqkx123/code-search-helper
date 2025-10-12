import { BalancedChunker } from '../../src/service/parser/splitting/BalancedChunker';

const chunker = new BalancedChunker();

console.log('=== Braces tracking test ===');
console.log('Initial state:', chunker.getCurrentState());

// 逐字符分析"const str = `Hello ${"，特别关注花括号
const line = 'const str = `Hello ${';
console.log(`\nAnalyzing line: "${line}"`);

for (let i = 0; i < line.length; i++) {
  const char = line[i];
  console.log(`Char ${i}: '${char}'`);

  // 创建一个新的chunker只分析这一个字符
  const tempChunker = new BalancedChunker();
  tempChunker.analyzeLineSymbols(line.substring(0, i + 1));
  console.log(`  State after this char:`, tempChunker.getCurrentState());
}