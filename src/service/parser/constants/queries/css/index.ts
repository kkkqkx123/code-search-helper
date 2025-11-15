/*
CSS Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import selectors from './selectors';
import properties from './properties';
import rules from './rules';
import comments from './comments';

export default `
${selectors}

${properties}

${comments}
${rules}
`;