import { inject, injectable } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../core/LoggerService';
import { SemgrepFinding, SemgrepError, SemgrepScanResult, AnalysisContext } from '../types/StaticAnalysisTypes';

/**
 * Result Processor Service
 * Handles processing and transformation of static analysis results
 */
@injectable()
export class ResultProcessorService {
  constructor(@inject(TYPES.LoggerService) private logger: LoggerService) {}

  /**
   * Process raw Semgrep results
   */
  async processResults(rawResult: any, context: AnalysisContext): Promise<any> {
    try {
      const findings = this.extractFindings(rawResult);
      const summary = this.calculateSummary(rawResult, findings);
      const errors = this.extractErrors(rawResult);

      return {
        id: `scan-${Date.now()}`,
        projectPath: context.projectPath,
        scanTime: new Date(),
        duration: rawResult.time?.duration || 0,
        findings,
        errors,
        summary,
        metadata: {
          semgrepVersion: '',
          configHash: '',
          projectHash: '',
        },
      };
    } catch (error) {
      this.logger.error('Failed to process Semgrep result:', error);
      return {
        id: `scan-${Date.now()}`,
        projectPath: context.projectPath,
        scanTime: new Date(),
        duration: 0,
        findings: [],
        errors: [
          {
            type: 'ProcessingError',
            message: error instanceof Error ? error.message : String(error),
            level: 'ERROR',
          },
        ],
        summary: {
          totalFiles: 0,
          totalFindings: 0,
          errorCount: 1,
          rulesRun: 0,
          targetBytes: 0,
          timing: {
            totalTime: 0,
            configTime: 0,
            coreTime: 0,
            parsingTime: 0,
            matchingTime: 0,
            ruleParseTime: 0,
            fileParseTime: 0,
          },
        },
        metadata: {
          semgrepVersion: '',
          configHash: '',
          projectHash: '',
        },
      };
    }
  }

  /**
   * Extract findings from raw result
   */
  private extractFindings(rawResult: any): SemgrepFinding[] {
    if (!rawResult.findings) {
      return [];
    }

    return rawResult.findings
      .map((result: any) => {
        return this.transformFinding(result);
      })
      .filter(Boolean);
  }

  /**
   * Transform a single finding
   */
  private transformFinding(result: any): SemgrepFinding | null {
    try {
      const finding: SemgrepFinding = {
        id: `${result.check_id || 'unknown-rule'}-${result.path || 'unknown'}-${result.start?.line || 1}`,
        ruleId: result.check_id || 'unknown-rule',
        message: result.extra?.message || result.message || 'No message provided',
        severity: this.mapSemgrepSeverity(result.extra?.severity || 'INFO'),
        confidence: 'HIGH',
        category: 'security',
        location: {
          file: result.path || 'unknown-file',
          start: {
            line: result.start?.line || 1,
            col: result.start?.col || 1,
            offset: 0,
          },
          end: {
            line: result.end?.line || result.start?.line || 1,
            col: result.end?.col || result.start?.col || 1,
            offset: 0,
          },
          lines: result.extra?.lines || [],
        },
        extra: result.extra || {},
        codeContext: {
          id: '',
          filePath: result.path || 'unknown-file',
          language: '',
          content: result.extra?.lines || '',
          astPath: '',
          nodeType: '',
          parentType: '',
          children: [],
          metadata: {},
          type: 'variable',
          lineStart: result.start?.line || 1,
          lineEnd: result.end?.line || result.start?.line || 1,
        },
        cwe: result.extra?.metadata?.cwe || [],
        owasp: result.extra?.metadata?.owasp || [],
        references: result.extra?.metadata?.references || [],
        fix: result.extra?.fix,
      };

      return finding;
    } catch (error) {
      this.logger.warn('Failed to transform finding:', error);
      return null;
    }
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(
    rawResult: any,
    findings: SemgrepFinding[]
  ): any {
    return {
      totalFiles: rawResult.paths?.scanned?.length || 0,
      totalFindings: findings.length,
      errorCount: rawResult.errors?.length || 0,
      rulesRun: 0,
      targetBytes: 0,
      timing: {
        totalTime: rawResult.time?.duration || 0,
        configTime: 0,
        coreTime: 0,
        parsingTime: 0,
        matchingTime: 0,
        ruleParseTime: 0,
        fileParseTime: 0,
      },
    };
  }

  /**
   * Extract errors
   */
  private extractErrors(rawResult: any): SemgrepError[] {
    if (!rawResult.errors) {
      return [];
    }

    return rawResult.errors.map((error: any) => {
      if (typeof error === 'string') {
        return {
          type: 'GenericError',
          message: error,
          level: 'ERROR',
        };
      }

      if (error.message) {
        return {
          type: error.type || 'Error',
          message: error.message,
          level: error.level || 'ERROR',
          details: error.details,
          path: error.path,
        };
      }

      return {
        type: 'UnknownError',
        message: JSON.stringify(error),
        level: 'ERROR',
      };
    });
  }

  /**
   * Map Semgrep severity levels
   */
  private mapSemgrepSeverity(severity: string): 'ERROR' | 'WARNING' | 'INFO' {
    const severityMap: Record<string, 'ERROR' | 'WARNING' | 'INFO'> = {
      ERROR: 'ERROR',
      error: 'ERROR',
      WARNING: 'WARNING',
      warning: 'WARNING',
      INFO: 'INFO',
      info: 'INFO',
    };

    return severityMap[severity] || 'INFO';
  }

  /**
   * Group findings by severity
   */
  groupBySeverity(findings: SemgrepFinding[]): Record<string, SemgrepFinding[]> {
    const groups: Record<string, SemgrepFinding[]> = {
      ERROR: [],
      WARNING: [],
      INFO: [],
    };

    for (const finding of findings) {
      groups[finding.severity].push(finding);
    }

    return groups;
  }

  /**
   * Group findings by file
   */
  groupByFile(findings: SemgrepFinding[]): Record<string, SemgrepFinding[]> {
    const groups: Record<string, SemgrepFinding[]> = {};

    for (const finding of findings) {
      const fileName = finding.location.file;
      if (!groups[fileName]) {
        groups[fileName] = [];
      }
      groups[fileName].push(finding);
    }

    return groups;
  }

  /**
   * Group findings by rule
   */
  groupByRule(findings: SemgrepFinding[]): Record<string, SemgrepFinding[]> {
    const groups: Record<string, SemgrepFinding[]> = {};

    for (const finding of findings) {
      if (!groups[finding.ruleId]) {
        groups[finding.ruleId] = [];
      }
      groups[finding.ruleId].push(finding);
    }

    return groups;
  }

  /**
   * Generate summary report
   */
  generateSummaryReport(result: SemgrepScanResult): {
    summary: string;
    details: any[];
  } {
    const severityCounts = this.groupBySeverity(result.findings);
    const categoryCounts = this.groupByCategory(result.findings);

    const summary = `Scan completed: found ${result.findings.length} issues, ${result.summary.totalFiles} files scanned`;

    return {
      summary,
      details: [
        {
          type: 'severity',
          counts: severityCounts,
          description: 'Grouped by severity',
        },
        {
          type: 'category',
          counts: categoryCounts,
          description: 'Grouped by category',
        },
      ],
    };
  }

  /**
   * Group by category
   */
  private groupByCategory(findings: any[]): Record<string, any[]> {
    const groups: Record<string, any[]> = {};

    for (const finding of findings) {
      const category = finding.category || finding.type || 'UNKNOWN';
      if (!groups[category]) {
        groups[category] = [];
      }
      groups[category].push(finding);
    }

    return groups;
  }
}