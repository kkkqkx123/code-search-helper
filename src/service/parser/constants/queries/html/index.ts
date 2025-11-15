/*
HTML Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import elements from './elements';
import attributesContent from './attributes-content';
import comments from './comments';

export default `
${elements}

${attributesContent}
${comments}
`;