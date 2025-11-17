/*
C# Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import classes from './classes';
import methods from './methods';
import properties from './properties';
import linq from './linq';
import patterns from './patterns';
import expressions from './expressions';
import dataFlow from './data-flow';
import controlFlow from './control-flow';
import semanticRelationships from './semantic-relationships';
import lifecycleRelationships from './lifecycle-relationships';
import concurrencyRelationships from './concurrency-relationships';

const comments = `
; 注释查询
(comment) @comment
`;

export default `
${classes}
${methods}
${properties}
${linq}
${patterns}
${expressions}
${dataFlow}
${controlFlow}
${semanticRelationships}
${lifecycleRelationships}
${concurrencyRelationships}
${comments}
`;