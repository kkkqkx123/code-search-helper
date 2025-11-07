/**
 * 数据格式语言配置
 * 包含简单的数据序列化格式语言
 */
import { LanguageConfig, LanguageStrategy } from './LanguageCore';

export const DATA_FORMAT_STRATEGY: LanguageStrategy = {
  primary: 'universal_bracket',
  fallback: ['universal_line'],
  skipComplexQueries: true,
  maxQueryDepth: 2
};

export const DATA_FORMAT_LANGUAGES: LanguageConfig[] = [
  {
    name: 'json',
    displayName: 'JSON',
    queryDir: 'json',
    hasSubdir: false,
    category: 'data_format',
    extensions: ['.json'],
    aliases: ['json'],
    strategy: DATA_FORMAT_STRATEGY
  },
  
  {
    name: 'yaml',
    displayName: 'YAML',
    queryDir: 'yaml',
    hasSubdir: false,
    category: 'data_format',
    extensions: ['.yaml', '.yml'],
    aliases: ['yaml', 'yml'],
    strategy: DATA_FORMAT_STRATEGY
  },
  
  {
    name: 'toml',
    displayName: 'TOML',
    queryDir: 'toml',
    hasSubdir: false,
    category: 'data_format',
    extensions: ['.toml'],
    aliases: ['toml'],
    strategy: DATA_FORMAT_STRATEGY
  }
];