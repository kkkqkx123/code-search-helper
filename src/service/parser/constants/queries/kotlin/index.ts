/*
Kotlin Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import classesFunctions from './classes-functions';
import constructorsProperties from './constructors-properties';
import methodsVariables from './methods-variables';
import controlFlowPatterns from './control-flow-patterns';
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
${classesFunctions}
${constructorsProperties}
${methodsVariables}
${controlFlowPatterns}
${dataFlow}
${controlFlowRelationships}
${semanticRelationships}
${lifecycleRelationships}
${concurrencyRelationships}
${comments}
`;