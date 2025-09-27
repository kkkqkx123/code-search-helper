import { inject, injectable } from 'inversify';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../core/LoggerService';
import { ConfigService } from '../../../config/ConfigService';
import { SemgrepScanResult, SemgrepScanOptions, SemgrepFinding, SemgrepRule, ValidationResult } from '../types/StaticAnalysisTypes';

/**
 * Unified Semgrep Integration Service
 * Handles all Semgrep CLI operations and rule management
 */
@injectable()
export class SemgrepIntegrationService {
  private semgrepPath: string;
  private rulesDir: string;
  private enhancedRulesPath: string;

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.ConfigService) private configService: ConfigService
  ) {
    const semgrepConfig = this.configService.get('semgrep');
    this.semgrepPath = semgrepConfig.binaryPath || 'semgrep';
    this.rulesDir = semgrepConfig.customRulesPath || './config/semgrep-rules';
    this.enhancedRulesPath = semgrepConfig.enhancedRulesPath || './enhanced-rules';
  }

  /**
   * Scan a project with Semgrep
   */
  async scanProject(
    projectPath: string,
    options: SemgrepScanOptions = {}
  ): Promise<SemgrepScanResult> {
    const startTime = Date.now();
    this.logger.info(`Starting Semgrep scan for project: ${projectPath}`);

    try {
      // Verify Semgrep is available
      if (!(await this.isSemgrepAvailable())) {
        throw new Error('Semgrep CLI is not available. Please install Semgrep first.');
      }

      // Build command arguments
      const args = this.buildScanArgs(projectPath, options);

      // Execute scan
      const result = await this.executeSemgrep(args);

      const scanResult: SemgrepScanResult = {
        id: `scan-${Date.now()}`,
        projectPath,
        scanTime: new Date(),
        duration: Date.now() - startTime,
        summary: {
          totalFiles: result.stats?.totalFiles || 0,
          totalFindings: (result.findings || []).length,
          errorCount: (result.errors || []).length,
          rulesRun: 0,
          targetBytes: 0,
          timing: {
            totalTime: Date.now() - startTime,
            configTime: 0,
            coreTime: 0,
            parsingTime: 0,
            matchingTime: 0,
            ruleParseTime: 0,
            fileParseTime: 0,
          },
        },
        findings: result.findings || [],
        errors: result.errors || [],
        metadata: {
          semgrepVersion: '',
          configHash: '',
          projectHash: '',
        },
      };

      this.logger.info(`Semgrep scan completed for ${projectPath} in ${scanResult.duration}ms`);
      return scanResult;
    } catch (error) {
      this.logger.error(`Semgrep scan failed for ${projectPath}:`, error);
      throw error;
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
   * Validate a rule
   */
  async validateRule(rule: SemgrepRule): Promise<ValidationResult> {
    try {
      const tempRulePath = path.join(this.rulesDir, 'temp', `${rule.id}.yaml`);
      await fs.mkdir(path.dirname(tempRulePath), { recursive: true });

      const ruleContent = this.generateRuleYaml(rule);
      await fs.writeFile(tempRulePath, ruleContent, 'utf-8');

      // Validate rule with Semgrep
      const args = ['--validate', '--config', tempRulePath, '.'];
      const result = await this.executeSemgrep(args, process.cwd());

      // Clean up temporary file
      await fs.unlink(tempRulePath);

      return {
        valid: result.errors.length === 0,
        errors: result.errors,
      };
    } catch (error) {
      return {
        valid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Check if Semgrep is available
   */
  async isSemgrepAvailable(): Promise<boolean> {
    try {
      const result = await this.executeCommand(this.semgrepPath, ['--version']);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Build scan arguments
   */
  private buildScanArgs(projectPath: string, options: SemgrepScanOptions): string[] {
    const args = ['scan', '--json', '--quiet', '--error'];

    // Add rules
    if (options.rules && options.rules.length > 0) {
      for (const rule of options.rules) {
        args.push('--config', rule);
      }
    } else {
      args.push('--config', this.rulesDir);
    }

    // Add severity filter
    if (options.severity && options.severity.length > 0) {
      for (const severity of options.severity) {
        args.push('--severity', severity);
      }
    }

    // Add timeout
    if (options.timeout) {
      args.push('--timeout', options.timeout.toString());
    }

    // Add max target bytes
    const semgrepConfig = this.configService.get('semgrep');
    const maxTargetBytes = options.maxTargetBytes || semgrepConfig.maxTargetBytes || 1000000;
    args.push('--max-target-bytes', String(maxTargetBytes));

    // Add project path
    args.push(projectPath);

    return args;
  }

  /**
   * Execute Semgrep command
   */
  private async executeSemgrep(args: string[], cwd?: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.semgrepPath, args, {
        cwd: cwd || process.cwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.stderr.on('data', data => {
        stderr += data.toString();
      });

      child.on('close', exitCode => {
        try {
          if (stdout.trim()) {
            const result = JSON.parse(stdout);
            resolve({
              ...result,
              errors: result.errors || [],
              exitCode: exitCode || 0,
            });
          } else {
            resolve({
              findings: [],
              errors: stderr ? [stderr] : [],
              exitCode: exitCode || 0,
            });
          }
        } catch (error) {
          reject(
            new Error(
              `Failed to parse Semgrep output: ${error instanceof Error ? error.message : String(error)}`
            )
          );
        }
      });

      child.on('error', error => {
        reject(new Error(`Failed to execute Semgrep: ${error.message}`));
      });
    });
  }

  /**
   * Execute a command
   */
  private async executeCommand(
    command: string,
    args: string[]
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', data => {
        stdout += data.toString();
      });

      child.stderr.on('data', data => {
        stderr += data.toString();
      });

      child.on('close', exitCode => {
        resolve({ exitCode: exitCode || 0, stdout, stderr });
      });

      child.on('error', error => {
        reject(error);
      });
    });
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