import { BalancedChunker } from '../../src/service/parser/splitting/BalancedChunker';

const chunker = new BalancedChunker();

console.log('=== Original test reproduction ===');
console.log('Initial state:', chunker.getCurrentState());
console.log('Can safely split:', chunker.canSafelySplit());

chunker.analyzeLineSymbols('const str = `Hello ${');
console.log('\nAfter "const str = `Hello ${":', chunker.getCurrentState());
console.log('Can safely split:', chunker.canSafelySplit());

chunker.analyzeLineSymbols('  name');
console.log('\nAfter "  name":', chunker.getCurrentState());
console.log('Can safely split:', chunker.canSafelySplit());

chunker.analyzeLineSymbols('}`;');
console.log('\nAfter "`};":', chunker.getCurrentState());
console.log('Can safely split:', chunker.canSafelySplit());