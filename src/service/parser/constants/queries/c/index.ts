/*
C Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
Reorganized to match relationship extractors
*/

// Entity queries
import functions from './entities/functions';
import structs from './entities/structs';
import variables from './entities/variables';
import preprocessor from './entities/preprocessor';

// Relationship queries
import annotation from './relationships/annotation';
import call from './relationships/call';
import controlFlow from './relationships/control-flow';
import dataFlow from './relationships/data-flow';
import creation from './relationships/creation';
import dependency from './relationships/dependency';
import inheritance from './relationships/inheritance';
import lifecycle from './relationships/lifecycle';
import concurrency from './relationships/concurrency';
import semantic from './relationships/semantic';
import reference from './relationships/reference';

const comments = `
; 注释查询
(comment) @comment
`;

export default `
${functions}
${structs}
${variables}
${preprocessor}
${annotation}
${call}
${controlFlow}
${dataFlow}
${creation}
${dependency}
${inheritance}
${lifecycle}
${concurrency}
${semantic}
${reference}
${comments}
`;