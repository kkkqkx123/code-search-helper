/*
Go Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import functionsTypes from './functions-types';
import variablesImports from './variables-imports';
import expressionsControlFlow from './expressions-control-flow';

export default `
${functionsTypes}

${variablesImports}

${expressionsControlFlow}
`;