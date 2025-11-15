/*
TSX Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import comments from './comments';
import typescriptQueries from '../typescript/index';
import components from './components';
import jsx from './jsx';
import typesHooks from './types-hooks';

export default `
${typescriptQueries}
${comments}

${components}

${jsx}

${typesHooks}
`;