/*
C# Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import classes from './entities/classes';
import methods from './entities/methods';
import properties from './entities/properties';
import linq from './entities/linq';
import patterns from './entities/patterns';
import expressions from './entities/expressions';
import dataFlow from './relationships/data-flow';
import controlFlow from './relationships/control-flow';
import semanticRelationships from './relationships/semantic-relationships';
import lifecycleRelationships from './relationships/lifecycle-relationships';
import concurrencyRelationships from './relationships/concurrency-relationships';
import { SHARED_CALL_EXPRESSIONS, SHARED_FUNCTION_ANNOTATIONS } from './shared';

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
${SHARED_CALL_EXPRESSIONS}
${SHARED_FUNCTION_ANNOTATIONS}
${comments}
`;