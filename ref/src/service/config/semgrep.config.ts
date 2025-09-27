import { ConfigService } from '../config/ConfigService';

export interface SemgrepConfig {
  binaryPath: string;
  timeout: number;
  maxMemory: number;
  maxTargetBytes: number;
  jobs: number;
  noGitIgnore: boolean;
  noRewriteRuleIds: boolean;
  strict: boolean;
  configPaths: string[];
  customRulesPath: string;
  outputFormat: 'json' | 'sarif' | 'text';
  excludePatterns: string[];
  includePatterns: string[];
  severityLevels: string[];
}

export const defaultSemgrepConfig: SemgrepConfig = {
  binaryPath: 'semgrep',
  timeout: 30000,
  maxMemory: 512,
  maxTargetBytes: 1000000,
  jobs: 4,
  noGitIgnore: false,
  noRewriteRuleIds: false,
  strict: false,
  configPaths: [
    'auto',
    'p/security-audit',
    'p/secrets',
    'p/owasp-top-ten',
    'p/javascript',
    'p/python',
    'p/java',
    'p/go',
    'p/typescript',
  ],
  customRulesPath: './rules/semgrep',
  outputFormat: 'json',
  excludePatterns: [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
    '*.min.js',
    '*.min.css',
    'vendor',
    'test/fixtures',
    'tests/fixtures',
  ],
  includePatterns: [
    '*.js',
    '*.ts',
    '*.jsx',
    '*.tsx',
    '*.py',
    '*.java',
    '*.go',
    '*.php',
    '*.rb',
    '*.cs',
  ],
  severityLevels: ['ERROR', 'WARNING', 'INFO'],
};

export function getSemgrepConfig(configService: ConfigService): SemgrepConfig {
  const semgrepConfig = configService.get('semgrep');
  return {
    binaryPath: semgrepConfig.binaryPath || defaultSemgrepConfig.binaryPath,
    timeout: semgrepConfig.timeout || defaultSemgrepConfig.timeout,
    maxMemory: semgrepConfig.maxMemory || defaultSemgrepConfig.maxMemory,
    maxTargetBytes: semgrepConfig.maxTargetBytes || defaultSemgrepConfig.maxTargetBytes,
    jobs: semgrepConfig.jobs || defaultSemgrepConfig.jobs,
    noGitIgnore: semgrepConfig.noGitIgnore ?? defaultSemgrepConfig.noGitIgnore,
    noRewriteRuleIds: semgrepConfig.noRewriteRuleIds ?? defaultSemgrepConfig.noRewriteRuleIds,
    strict: semgrepConfig.strict ?? defaultSemgrepConfig.strict,
    configPaths: semgrepConfig.configPaths || defaultSemgrepConfig.configPaths,
    customRulesPath: semgrepConfig.customRulesPath || defaultSemgrepConfig.customRulesPath,
    outputFormat: semgrepConfig.outputFormat || defaultSemgrepConfig.outputFormat,
    excludePatterns: semgrepConfig.excludePatterns || defaultSemgrepConfig.excludePatterns,
    includePatterns: semgrepConfig.includePatterns || defaultSemgrepConfig.includePatterns,
    severityLevels: semgrepConfig.severityLevels || defaultSemgrepConfig.severityLevels,
  };
}
