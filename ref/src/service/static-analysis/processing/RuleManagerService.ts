import { inject, injectable } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../core/LoggerService';
import { ConfigService } from '../../../config/ConfigService';
import { SemgrepRule, ValidationResult } from '../types/StaticAnalysisTypes';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * Rule Manager Service
 * Handles management of static analysis rules
 */
@injectable()
export class RuleManagerService {
  private rulesDir: string;
  private enhancedRulesPath: string;

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ConfigService) private configService: ConfigService
  ) {
    const semgrepConfig = this.configService.get('semgrep');
    this.rulesDir = semgrepConfig.customRulesPath || './config/semgrep-rules';
    this.enhancedRulesPath = semgrepConfig.enhancedRulesPath || './enhanced-rules';
  }

  /**
   * Get available rules
   */
  async getAvailableRules(): Promise<SemgrepRule[]> {
    try {
      const rules: SemgrepRule[] = [];

      // Check if rules directory exists
      try {
        await fs.access(this.rulesDir);
      } catch {
        return rules;
      }

      const files = await fs.readdir(this.rulesDir, { recursive: true });

      for (const file of files) {
        if (file.toString().endsWith('.yaml') || file.toString().endsWith('.yml')) {
          const filePath = path.join(this.rulesDir, file.toString());
          const content = await fs.readFile(filePath, 'utf-8');

          // Parse YAML file and extract rule information
          const rule = this.parseRuleFromYaml(content);
          if (rule) {
            rules.push(rule);
          }
        }
      }

      return rules;
    } catch (error) {
      this.logger.error('Failed to get available rules:', error);
      return [];
    }
  }

  /**
   * Add a custom rule
   */
  async addCustomRule(rule: SemgrepRule): Promise<void> {
    try {
      const rulePath = path.join(this.rulesDir, `${rule.id}.yaml`);
      const ruleContent = this.generateRuleYaml(rule);

      await fs.mkdir(path.dirname(rulePath), { recursive: true });
      await fs.writeFile(rulePath, ruleContent, 'utf-8');

      this.logger.info(`Added custom Semgrep rule: ${rule.id}`);
    } catch (error) {
      this.logger.error('Failed to add custom rule:', error);
      throw error;
    }
  }

  /**
   * Validate a rule
   */
  async validateRule(rule: SemgrepRule): Promise<ValidationResult> {
    try {
      // In a real implementation, this would validate the rule syntax and structure
      // For now, we'll do a basic validation
      if (!rule.id || !rule.message || !rule.severity || !rule.languages) {
        return {
          valid: false,
          errors: ['Missing required fields: id, message, severity, or languages'],
        };
      }

      // Check severity is valid
      const validSeverities = ['ERROR', 'WARNING', 'INFO'];
      if (!validSeverities.includes(rule.severity)) {
        return {
          valid: false,
          errors: [`Invalid severity: ${rule.severity}. Must be one of: ${validSeverities.join(', ')}`],
        };
      }

      // Check languages is not empty
      if (rule.languages.length === 0) {
        return {
          valid: false,
          errors: ['Languages array cannot be empty'],
        };
      }

      return {
        valid: true,
        errors: [],
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Generate rule templates
   */
  generateRuleTemplates(): SemgrepRule[] {
    return [
      {
        id: 'template-security-check',
        message: 'Security issue detected',
        severity: 'WARNING',
        languages: ['javascript', 'typescript'],
        pattern: '// TODO: Add pattern here',
        metadata: {
          category: 'security',
        },
        fix: '// TODO: Add fix suggestion',
        options: {},
      },
      {
        id: 'template-performance-check',
        message: 'Performance issue detected',
        severity: 'WARNING',
        languages: ['javascript', 'typescript'],
        pattern: '// TODO: Add pattern here',
        metadata: {
          category: 'performance',
        },
        fix: '// TODO: Add fix suggestion',
        options: {},
      },
      {
        id: 'template-best-practice',
        message: 'Best practice violation',
        severity: 'INFO',
        languages: ['javascript', 'typescript'],
        pattern: '// TODO: Add pattern here',
        metadata: {
          category: 'best-practice',
        },
        fix: '// TODO: Add fix suggestion',
        options: {},
      },
    ];
  }

  /**
   * Get enhanced rules for specific analysis types
   */
  getEnhancedRules(analysisType: string): string[] {
    switch (analysisType) {
      case 'security':
        return [
          `${this.enhancedRulesPath}/security/sql-injection.yml`,
          `${this.enhancedRulesPath}/security/xss-detection.yml`,
          `${this.enhancedRulesPath}/security/path-traversal.yml`,
          `${this.enhancedRulesPath}/security/command-injection.yml`,
        ];
      case 'control-flow':
        return [
          `${this.enhancedRulesPath}/control-flow/basic-cfg.yml`,
          `${this.enhancedRulesPath}/control-flow/cross-function-analysis.yml`,
        ];
      case 'data-flow':
        return [
          `${this.enhancedRulesPath}/data-flow/taint-analysis.yml`,
        ];
      default:
        return [
          `${this.enhancedRulesPath}/security/sql-injection.yml`,
          `${this.enhancedRulesPath}/security/xss-detection.yml`,
        ];
    }
  }

  /**
   * Generate rule YAML
   */
  private generateRuleYaml(rule: SemgrepRule): string {
    return `
rules:
  - id: ${rule.id}
    message: ${rule.message}
    severity: ${rule.severity.toLowerCase()}
    languages:
${rule.languages.map(lang => `      - ${lang}`).join('\n')}
    pattern: |
      ${rule.pattern || ''}
${
  rule.metadata
    ? `
    metadata:
${Object.entries(rule.metadata)
  .map(([key, value]) => `      ${key}: ${value}`)
  .join('\n')}
`
    : ''
}
`;
  }

  /**
   * Parse rule from YAML
   */
  private parseRuleFromYaml(content: string): SemgrepRule | null {
    try {
      // Simple YAML parsing, in a real project we should use a proper YAML parser library
      const ruleMatch = content.match(/- id:\s*(\w+)/);
      const messageMatch = content.match(/message:\s*(.+)/);
      const severityMatch = content.match(/severity:\s*(\w+)/);
      const languagesMatch = content.match(/languages:([\s\S]*?)(?=\n\s*\w+:|$)/);
      const patternMatch = content.match(/pattern:\s*\|([\s\S]*?)(?=\n\s*\w+:|$)/);

      if (!ruleMatch || !messageMatch || !severityMatch || !languagesMatch || !patternMatch) {
        return null;
      }

      return {
        id: ruleMatch[1],
        message: messageMatch[1].trim(),
        severity: severityMatch[1].toUpperCase() as 'ERROR' | 'WARNING' | 'INFO',
        languages: languagesMatch[1]
          .trim()
          .split('\n')
          .map(l => l.trim().replace('- ', '')),
        pattern: patternMatch[1].trim(),
        metadata: {},
        fix: '',
        options: {},
      };
    } catch {
      return null;
    }
  }
}