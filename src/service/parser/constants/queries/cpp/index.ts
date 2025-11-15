/*
C++ Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import classes from './classes';
import functions from './functions';
import variables from './variables';
import types from './types';
import namespaces from './namespaces';
import preprocessor from './preprocessor';
import controlFlow from './control-flow';
import modernFeatures from './modern-features';
import dataFlow from './data-flow';
import semanticRelationships from './semantic-relationships';
import lifecycleRelationships from './lifecycle-relationships';
import concurrencyRelationships from './concurrency-relationships';
import comments from './comments';
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
