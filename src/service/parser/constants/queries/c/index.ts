/*
C Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import functions from './functions';
import structs from './structs';
import variables from './variables';
import preprocessor from './preprocessor';
import controlFlow from './control-flow';

export default `
${functions}

${structs}

${variables}

${preprocessor}

${controlFlow}
`;