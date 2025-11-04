/*
Rust Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import functionsStructs from './functions-structs';
import modulesImports from './modules-imports';
import variablesExpressions from './variables-expressions';
import typesMacros from './types-macros';
import controlFlow from './control-flow';
import dataFlow from './data-flow';
import controlFlowRelationships from './control-flow-relationships';
import semanticRelationships from './semantic-relationships';
import lifecycleRelationships from './lifecycle-relationships';
import concurrencyRelationships from './concurrency-relationships';

export default `
${functionsStructs}

${modulesImports}

${variablesExpressions}

${typesMacros}

${controlFlow}

${dataFlow}

${controlFlowRelationships}

${semanticRelationships}

${lifecycleRelationships}

${concurrencyRelationships}
`;