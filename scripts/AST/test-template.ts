import { BalancedChunker } from '../../src/service/parser/splitting/BalancedChunker';

const chunker = new BalancedChunker();

console.log('Initial state:', chunker.getCurrentState());
console.log('Can safely split:', chunker.canSafelySplit());

chunker.analyzeLineSymbols('const str = `Hello ${');
console.log('After "const str = `Hello ${":', chunker.getCurrentState());
console.log('Can safely split:', chunker.canSafelySplit());

chunker.analyzeLineSymbols('  name');
console.log('After "  name":', chunker.getCurrentState());
console.log('Can safely split:', chunker.canSafelySplit());

chunker.analyzeLineSymbols('}`;');
console.log('After "`};":', chunker.getCurrentState());
console.log('Can safely split:', chunker.canSafelySplit());