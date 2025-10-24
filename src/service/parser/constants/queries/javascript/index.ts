/*
JavaScript Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import classes from './classes';
import functions from './functions';
import variables from './variables';
import imports from './imports';
import controlFlow from './control-flow';
import expressions from './expressions';
import exportQueries from './exports';
import interfaces from './interfaces';
import methods from './methods';
import properties from './properties';
import types from './types';

export default `
${classes}

${functions}

${variables}

${imports}

${controlFlow}

${expressions}

${exportQueries}

${interfaces}

${methods}

${properties}

${types}
`;