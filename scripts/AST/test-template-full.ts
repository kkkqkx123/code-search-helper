import { BalancedChunker } from '../../src/service/parser/splitting/BalancedChunker';

const chunker = new BalancedChunker();

console.log('=== Full template string test ===');
console.log('Initial state:', chunker.getCurrentState());
console.log('Can safely split:', chunker.canSafelySplit());

// 模拟完整的模板字符串处理流程
chunker.analyzeLineSymbols('const str = `Hello ${');  // 开始模板字符串，开始表达式
console.log('\nAfter "const str = `Hello ${":', chunker.getCurrentState());
console.log('Can safely split:', chunker.canSafelySplit());

chunker.analyzeLineSymbols('  name');  // 表达式内容
console.log('\nAfter "  name":', chunker.getCurrentState());
console.log('Can safely split:', chunker.canSafelySplit());

chunker.analyzeLineSymbols('}`');  // 结束表达式，结束模板字符串
console.log('\nAfter "`}":', chunker.getCurrentState());
console.log('Can safely split:', chunker.canSafelySplit());

chunker.analyzeLineSymbols(';');  // 语句结束
console.log('\nAfter ";":', chunker.getCurrentState());
console.log('Can safely split:', chunker.canSafelySplit());