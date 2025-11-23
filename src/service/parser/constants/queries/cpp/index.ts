/*
C++ Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import classes from './entities/classes';
import functions from './entities/functions';
import variables from './entities/variables';
import types from './entities/types';
import namespaces from './entities/namespaces';
import preprocessor from './entities/preprocessor';
import controlFlow from './relationships/control-flow';
import modernFeatures from './entities/modern-features';
import dataFlow from './relationships/data-flow';
import semanticRelationships from './relationships/semantic-relationships';
import lifecycleRelationships from './relationships/lifecycle-relationships';
import concurrencyRelationships from './relationships/concurrency-relationships';

const comments = `
; 注释查询
(comment) @comment
`;

export default `
${classes}

${functions}

${variables}

${types}

${namespaces}

${preprocessor}

${controlFlow}

${modernFeatures}

${dataFlow}

${semanticRelationships}

${lifecycleRelationships}

${concurrencyRelationships}

${comments}
`;
