/**
 * 特殊处理语言配置
 * 包含使用专用处理器的语言（跳过 AST）
 */
import { LanguageConfig, LanguageStrategy } from './LanguageCore';

export const SPECIAL_PROCESSING_LANGUAGES: LanguageConfig[] = [
  {
    name: 'markdown',
    displayName: 'Markdown',
    queryDir: 'markdown',
    hasSubdir: false,
    category: 'special_processing',
    extensions: ['.md', '.markdown'],
    aliases: ['md', 'markdown'],
    strategy: {
      primary: 'specialized_processor',
      skipASTParsing: true,
      specializedProcessor: 'MarkdownProcessor',
      maxQueryDepth: 1,
      fallback: ['universal_line']
    }
  },

  {
    name: 'xml',
    displayName: 'XML',
    queryDir: 'xml',
    hasSubdir: false,
    category: 'special_processing',
    extensions: ['.xml'],
    aliases: ['xml'],
    strategy: {
      primary: 'specialized_processor',
      skipASTParsing: true,
      specializedProcessor: 'XMLTextStrategy',
      maxQueryDepth: 1,
      fallback: ['universal_line']
    }
  }
];