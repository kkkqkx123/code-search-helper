import { injectable } from 'inversify';
import * as Joi from 'joi';
import { BaseConfigService } from './BaseConfigService';

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
  enhancedRulesPath: string;
  outputFormat: 'json' | 'sarif' | 'text';
  excludePatterns: string[];
  includePatterns: string[];
  severityLevels: string[];
  enableControlFlow: boolean;
  enableDataFlow: boolean;
  enableTaintAnalysis: boolean;
  securitySeverity: string[];
}

@injectable()
export class SemgrepConfigService extends BaseConfigService<SemgrepConfig> {
  loadConfig(): SemgrepConfig {
    const rawConfig = {
      binaryPath: process.env.SEMGREP_BINARY_PATH || '/usr/local/bin/semgrep',
      timeout: parseInt(process.env.SEMGREP_TIMEOUT || '3000'),
      maxMemory: parseInt(process.env.SEMGREP_MAX_MEMORY || '512'),
      maxTargetBytes: parseInt(process.env.SEMGREP_MAX_TARGET_BYTES || '1000000'),
      jobs: parseInt(process.env.SEMGREP_JOBS || '4'),
      noGitIgnore: process.env.SEMGREP_NO_GIT_IGNORE === 'true',
      noRewriteRuleIds: process.env.SEMGREP_NO_REWRITE_RULE_IDS === 'true',
      strict: process.env.SEMGREP_STRICT === 'true',
      configPaths: process.env.SEMGREP_CONFIG_PATHS 
        ? process.env.SEMGREP_CONFIG_PATHS.split(',')
        : ['auto', 'p/security-audit', 'p/secrets', 'p/owasp-top-ten', 'p/javascript', 'p/python', 'p/java', 'p/go', 'p/typescript'],
      customRulesPath: process.env.SEMGREP_CUSTOM_RULES_PATH || './config/semgrep-rules',
      enhancedRulesPath: process.env.SEMGREP_ENHANCED_RULES_PATH || './enhanced-rules',
      outputFormat: (process.env.SEMGREP_OUTPUT_FORMAT as 'json' | 'sarif' | 'text') || 'json',
      excludePatterns: process.env.SEMGREP_EXCLUDE_PATTERNS 
        ? process.env.SEMGREP_EXCLUDE_PATTERNS.split(',')
        : ['node_modules', '.git', 'dist', 'build', 'coverage', '*.min.js', '*.min.css', 'vendor', 'test/fixtures', 'tests/fixtures'],
      includePatterns: process.env.SEMGREP_INCLUDE_PATTERNS 
        ? process.env.SEMGREP_INCLUDE_PATTERNS.split(',')
        : ['*.js', '*.ts', '*.jsx', '*.tsx', '*.py', '*.java', '*.go', '*.php', '*.rb', '*.cs'],
      severityLevels: process.env.SEMGREP_SEVERITY_LEVELS 
        ? process.env.SEMGREP_SEVERITY_LEVELS.split(',')
        : ['ERROR', 'WARNING', 'INFO'],
      enableControlFlow: process.env.SEMGREP_ENABLE_CONTROL_FLOW === 'true',
      enableDataFlow: process.env.SEMGREP_ENABLE_DATA_FLOW === 'true',
      enableTaintAnalysis: process.env.SEMGREP_ENABLE_TAINT_ANALYSIS === 'true',
      securitySeverity: process.env.SEMGREP_SECURITY_SEVERITY 
        ? process.env.SEMGREP_SECURITY_SEVERITY.split(',')
        : ['HIGH', 'MEDIUM'],
    };

    return this.validateConfig(rawConfig);
  }

  validateConfig(config: any): SemgrepConfig {
    const schema = Joi.object({
      binaryPath: Joi.string().default('/usr/local/bin/semgrep'),
      timeout: Joi.number().positive().default(3000),
      maxMemory: Joi.number().positive().default(512),
      maxTargetBytes: Joi.number().positive().default(1000000),
      jobs: Joi.number().positive().default(4),
      noGitIgnore: Joi.boolean().default(false),
      noRewriteRuleIds: Joi.boolean().default(false),
      strict: Joi.boolean().default(false),
      configPaths: Joi.array()
        .items(Joi.string())
        .default([
          'auto',
          'p/security-audit',
          'p/secrets',
          'p/owasp-top-ten',
          'p/javascript',
          'p/python',
          'p/java',
          'p/go',
          'p/typescript',
        ]),
      customRulesPath: Joi.string().default('./config/semgrep-rules'),
      enhancedRulesPath: Joi.string().default('./enhanced-rules'),
      outputFormat: Joi.string().valid('json', 'sarif', 'text').default('json'),
      excludePatterns: Joi.array()
        .items(Joi.string())
        .default([
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
        ]),
      includePatterns: Joi.array()
        .items(Joi.string())
        .default([
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
        ]),
      severityLevels: Joi.array().items(Joi.string()).default(['ERROR', 'WARNING', 'INFO']),
      enableControlFlow: Joi.boolean().default(false),
      enableDataFlow: Joi.boolean().default(false),
      enableTaintAnalysis: Joi.boolean().default(false),
      securitySeverity: Joi.array().items(Joi.string()).default(['HIGH', 'MEDIUM']),
    });

    const { error, value } = schema.validate(config);
    if (error) {
      throw new Error(`Semgrep config validation error: ${error.message}`);
    }

    return value;
  }

  getDefaultConfig(): SemgrepConfig {
    return {
      binaryPath: '/usr/local/bin/semgrep',
      timeout: 3000,
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
      customRulesPath: './config/semgrep-rules',
      enhancedRulesPath: './enhanced-rules',
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
      enableControlFlow: false,
      enableDataFlow: false,
      enableTaintAnalysis: false,
      securitySeverity: ['HIGH', 'MEDIUM'],
    };
  }
}