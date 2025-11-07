/**
 * 混合处理语言配置
 * 包含既有 AST 查询又有专用处理的语言
 */
import { LanguageConfig, LanguageStrategy } from './LanguageCore';

export const HYBRID_PROCESSING_LANGUAGES: LanguageConfig[] = [
  {
    name: 'html',
    displayName: 'HTML',
    queryDir: 'html',
    hasSubdir: true,
    category: 'hybrid_processing',
    extensions: ['.html'],
    aliases: ['html'],
    strategy: {
      primary: 'specialized_processor',
      fallback: ['treesitter_ast'],
      specializedProcessor: 'XMLTextStrategy',
      supportedQueryTypes: ['elements', 'attributes'],
      maxQueryDepth: 10
    }
  },
  
  {
    name: 'css',
    displayName: 'CSS',
    queryDir: 'css',
    hasSubdir: true,
    category: 'hybrid_processing',
    extensions: ['.css'],
    aliases: ['css'],
    strategy: {
      primary: 'specialized_processor',
      fallback: ['treesitter_ast'],
      specializedProcessor: 'CSSTextStrategy',
      supportedQueryTypes: ['rules', 'properties', 'selectors'],
      maxQueryDepth: 8
    }
  }
];