import { BalancedChunker } from './src/service/parser/splitting/BalancedChunker';

// Simple console log function to replace mock logger
const mockLogger: any = {
  debug: console.log,
  info: console.log,
  warn: console.log,
  error: console.log,
};

console.log('Testing comment handling...');

const chunker = new BalancedChunker(mockLogger);

// 清空缓存
chunker.clearCache();

console.log('Initial state:', JSON.stringify(chunker['symbolStack']));

chunker.analyzeLineSymbols('function test() { // comment with }');
console.log('After line 1:', JSON.stringify(chunker['symbolStack']));
console.log('Can safely split:', chunker.canSafelySplit());
console.log('inSingleComment:', chunker['inSingleComment']);

chunker.analyzeLineSymbols('  return true;');
console.log('After line 2:', JSON.stringify(chunker['symbolStack']));
console.log('Can safely split:', chunker.canSafelySplit());
console.log('inSingleComment:', chunker['inSingleComment']);

chunker.analyzeLineSymbols('}');
console.log('After line 3:', JSON.stringify(chunker['symbolStack']));
console.log('Can safely split:', chunker.canSafelySplit());
console.log('inSingleComment:', chunker['inSingleComment']);