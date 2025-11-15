/*
Vue Tree-Sitter Query Patterns
Optimized for code chunking and vector embedding
*/
import components from './components';
import templateDirectives from './template-directives';
import comments from './comments';

export default `
${components}

${templateDirectives}
${comments}
`;