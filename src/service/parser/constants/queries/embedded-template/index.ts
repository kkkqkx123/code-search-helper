/*
Embedded Template Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import codeBlocks from './code-blocks';
import outputBlocks from './output-blocks';
import comments from './comments';

export default `
${codeBlocks}

${outputBlocks}

${comments}
`;