/*
Java Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import classesInterfaces from './classes-interfaces';
import methodsVariables from './methods-variables';
import controlFlowPatterns from './control-flow-patterns';
import dataFlow from './data-flow';
import semanticRelationships from './semantic-relationships';
import lifecycleRelationships from './lifecycle-relationships';
import comments from './comments';

export default `
${classesInterfaces}

${methodsVariables}

${controlFlowPatterns}

${dataFlow}

${semanticRelationships}

${comments}
${lifecycleRelationships}
`;