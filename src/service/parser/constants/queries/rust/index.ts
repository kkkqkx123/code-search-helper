/*
Rust Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import functionsStructs from './functions-structs';
import modulesImports from './modules-imports';
import variablesExpressions from './variables-expressions';
import typesMacros from './types-macros';
import controlFlow from './control-flow';

export default `
${functionsStructs}

${modulesImports}

${variablesExpressions}

${typesMacros}

${controlFlow}
`;