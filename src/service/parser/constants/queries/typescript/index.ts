/*
TypeScript Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import classes from './classes';
import functions from './functions';
import _exports from './exports';
import imports from './imports';
import interfaces from './interfaces';
import methods from './methods';
import properties from './properties';
import types from './types';
import variables from './variables';

export default `
${classes}

${functions}


${_exports}
${imports}

${interfaces}

${methods}

${properties}

${types}

${variables}
`;