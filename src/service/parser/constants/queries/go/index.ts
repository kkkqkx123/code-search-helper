/*
Go Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import functionsTypes from './functions-types';
import variablesImports from './variables-imports';
import expressionsControlFlow from './expressions-control-flow';
import dataFlow from './data-flow';
import controlFlowRelationships from './control-flow-relationships';
import semanticRelationships from './semantic-relationships';
import lifecycleRelationships from './lifecycle-relationships';
import concurrencyRelationships from './concurrency-relationships';
import comments from './comments';

export default `
${functionsTypes}

${variablesImports}

${expressionsControlFlow}

${dataFlow}

${controlFlowRelationships}

${semanticRelationships}

${lifecycleRelationships}

${concurrencyRelationships}
${comments}
`;