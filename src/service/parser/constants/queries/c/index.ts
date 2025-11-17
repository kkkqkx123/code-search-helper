/*
C Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import functions from './functions';
import structs from './structs';
import variables from './variables';
import preprocessor from './preprocessor';
import controlFlow from './control-flow';
import dataFlow from './data-flow';
import controlFlowRelationships from './control-flow-relationships';
import semanticRelationships from './semantic-relationships';
import lifecycleRelationships from './lifecycle-relationships';
import concurrencyRelationships from './concurrency-relationships';

const comments = `
; 注释查询
(comment) @comment
`;

export default `
${functions}
${structs}
${variables}
${preprocessor}
${controlFlow}
${dataFlow}
${controlFlowRelationships}
${semanticRelationships}
${lifecycleRelationships}
${concurrencyRelationships}
${comments}
`;