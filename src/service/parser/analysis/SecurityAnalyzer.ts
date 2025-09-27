import { injectable } from 'inversify';
import { SymbolTable } from './SymbolTableBuilder';
import { ControlFlowGraph } from './CFGBuilder';
import { DataFlowGraph } from './DataFlowGraph';
import { SecurityIssue, SecurityIssueType, SecuritySeverity } from './IncrementalAnalyzer';

export interface SecurityPattern {
  type: SecurityIssueType;
  severity: SecuritySeverity;
  patterns: RegExp[];
  taintSources: string[];
  taintSinks: string[];
  sanitizers: string[];
  description: string;
  remediation: string;
}

export interface SecurityAnalysisResult {
  issues: SecurityIssue[];
  summary: {
    total: number;
    bySeverity: Record<SecuritySeverity, number>;
    byType: Record<SecurityIssueType, number>;
  };
  recommendations: string[];
}

@injectable()
export class SecurityAnalyzer {
  private securityPatterns: SecurityPattern[] = [
    {
      type: SecurityIssueType.SQL_INJECTION,
      severity: SecuritySeverity.HIGH,
      patterns: [
        /SELECT.*FROM.*WHERE.*\+/i,
        /INSERT.*INTO.*VALUES.*\+/i,
        /UPDATE.*SET.*WHERE.*\+/i,
        /DELETE.*FROM.*WHERE.*\+/i,
        /query\s*\([^)]*\+/i,
        /execute\s*\([^)]*\+/i,
      ],
      taintSources: ['req.body', 'req.query', 'req.params', 'userInput', 'input'],
      taintSinks: ['query', 'execute', 'exec', 'prepare', 'Statement'],
      sanitizers: ['sanitize', 'escape', 'parameterize', 'bind'],
      description: 'Potential SQL injection vulnerability',
      remediation: 'Use parameterized queries or prepared statements',
    },
    {
      type: SecurityIssueType.XSS,
      severity: SecuritySeverity.HIGH,
      patterns: [
        /innerHTML\s*=\s*[^;]+/i,
        /outerHTML\s*=\s*[^;]+/i,
        /document\.write\s*\([^)]+\)/i,
        /eval\s*\([^)]+\)/i,
        /setTimeout\s*\([^)]+\)/i,
        /setInterval\s*\([^)]+\)/i,
      ],
      taintSources: ['req.body', 'req.query', 'req.params', 'userInput', 'input'],
      taintSinks: ['innerHTML', 'outerHTML', 'document.write', 'eval', 'setTimeout', 'setInterval'],
      sanitizers: ['escapeHTML', 'sanitize', 'encode', 'DOMPurify'],
      description: 'Potential XSS vulnerability',
      remediation: 'Encode output and validate input using proper HTML encoding',
    },
    {
      type: SecurityIssueType.COMMAND_INJECTION,
      severity: SecuritySeverity.CRITICAL,
      patterns: [
        /exec\s*\([^)]*\+/i,
        /spawn\s*\([^)]*\+/i,
        /system\s*\([^)]*\+/i,
        /shell\s*\([^)]*\+/i,
        /cmd\s*\([^)]*\+/i,
      ],
      taintSources: ['req.body', 'req.query', 'req.params', 'userInput', 'input'],
      taintSinks: ['exec', 'spawn', 'system', 'shell', 'cmd'],
      sanitizers: ['escapeShell', 'validate', 'sanitize'],
      description: 'Potential command injection vulnerability',
      remediation: 'Avoid system commands with user input, use safe alternatives',
    },
    {
      type: SecurityIssueType.PATH_TRAVERSAL,
      severity: SecuritySeverity.HIGH,
      patterns: [
        /readFile\s*\([^)]*\+/i,
        /writeFile\s*\([^)]*\+/i,
        /open\s*\([^)]*\+/i,
        /fs\.readFile\s*\([^)]*\+/i,
        /fs\.writeFile\s*\([^)]*\+/i,
        /\.\.\//i,
      ],
      taintSources: ['req.body', 'req.query', 'req.params', 'userInput', 'input'],
      taintSinks: ['readFile', 'writeFile', 'open', 'fs.readFile', 'fs.writeFile'],
      sanitizers: ['resolve', 'normalize', 'validatePath', 'sanitize'],
      description: 'Potential path traversal vulnerability',
      remediation: 'Validate and sanitize file paths, use path resolution',
    },
    {
      type: SecurityIssueType.XXE,
      severity: SecuritySeverity.HIGH,
      patterns: [/<!ENTITY/i, /SYSTEM\s*["\']/i, /PUBLIC\s*["\']/i, /DOCTYPE/i, /xml\s+version/i],
      taintSources: ['xmlInput', 'xmlFile', 'xmlString'],
      taintSinks: ['parse', 'parseXML', 'load', 'loadXML'],
      sanitizers: ['disableExternalEntities', 'secureParser', 'validate'],
      description: 'Potential XXE vulnerability',
      remediation: 'Disable external entity processing in XML parsers',
    },
    {
      type: SecurityIssueType.SSRF,
      severity: SecuritySeverity.HIGH,
      patterns: [
        /http:\/\/.*localhost/i,
        /http:\/\/.*127\.0\.0\.1/i,
        /http:\/\/.*0\.0\.0\.0/i,
        /file:\/\//i,
        /ftp:\/\//i,
      ],
      taintSources: ['req.body', 'req.query', 'req.params', 'userInput', 'url'],
      taintSinks: ['fetch', 'request', 'axios', 'http', 'https'],
      sanitizers: ['validate', 'whitelist', 'sanitize', 'restrict'],
      description: 'Potential SSRF vulnerability',
      remediation: 'Validate and restrict URLs, use allowlists for allowed domains',
    },
  ];

  analyze(
    sourceCode: string,
    filePath: string,
    symbolTable: SymbolTable,
    cfg: ControlFlowGraph,
    dataFlow: DataFlowGraph
  ): SecurityAnalysisResult {
    const issues: SecurityIssue[] = [];

    // 1. 基于模式的静态检测
    const patternIssues = this.detectByPatterns(sourceCode, filePath);
    issues.push(...patternIssues);

    // 2. 基于数据流的检测
    const dataFlowIssues = this.detectByDataFlow(sourceCode, filePath, symbolTable, dataFlow);
    issues.push(...dataFlowIssues);

    // 3. 基于控制流的检测
    const controlFlowIssues = this.detectByControlFlow(sourceCode, filePath, cfg);
    issues.push(...controlFlowIssues);

    // 4. 基于符号表的检测
    const symbolIssues = this.detectBySymbols(sourceCode, filePath, symbolTable);
    issues.push(...symbolIssues);

    return {
      issues,
      summary: this.generateSummary(issues),
      recommendations: this.generateRecommendations(issues),
    };
  }

  private detectByPatterns(sourceCode: string, filePath: string): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    const lines = sourceCode.split('\n');
    lines.forEach((line, lineIndex) => {
      this.securityPatterns.forEach(pattern => {
        pattern.patterns.forEach(regex => {
          // 使用有限制的匹配，避免无限循环
          const matches = line.match(regex);
          if (matches) {
            matches.forEach((match, matchIndex) => {
              const matchStart = line.indexOf(match, matchIndex > 0 ? line.indexOf(matches[matchIndex - 1]) + matches[matchIndex - 1].length : 0);
              issues.push({
                id: `pattern_${Date.now()}_${Math.random()}`,
                type: pattern.type,
                severity: pattern.severity,
                message: pattern.description,
                location: {
                  filePath,
                  startLine: lineIndex + 1,
                  endLine: lineIndex + 1,
                  startColumn: matchStart + 1,
                  endColumn: matchStart + match.length + 1,
                },
                variables: [],
                taintPath: [],
                code: line.trim(),
                remediation: pattern.remediation,
              });
            });
          }
        });
      });
    });

    return issues;
  }

  private detectByDataFlow(
    sourceCode: string,
    filePath: string,
    symbolTable: SymbolTable,
    dataFlow: DataFlowGraph
  ): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测数据流中的敏感信息传播
    const sensitiveSources = [
      'req.body',
      'req.params',
      'req.query',
      'request.body',
      'input',
      'user_input',
      'form_data',
      'post_data',
    ];

    const sensitiveSinks = [
      'query',
      'execute',
      'exec',
      'innerHTML',
      'document.write',
      'eval',
      'Function',
      'setTimeout',
      'setInterval',
    ];

    // 简化的数据流分析 - 只在实际代码中检测到相关模式时才分析
    const hasSensitiveContent = sensitiveSources.some(source => sourceCode.includes(source)) ||
      sensitiveSinks.some(sink => sourceCode.includes(sink));

    if (hasSensitiveContent) {
      // 分析从source到sink的数据流
      for (const source of sensitiveSources) {
        for (const sink of sensitiveSinks) {
          // 简化的数据流分析 - 实际实现需要调用dataFlow.getPaths(source, sink)
          // 这里只是模拟，不生成实际路径
          if (sourceCode.includes(source) && sourceCode.includes(sink)) {
            issues.push({
              id: `dataflow_${Date.now()}_${Math.random()}`,
              type: this.getIssueTypeForSink(sink),
              severity: SecuritySeverity.HIGH,
              message: `Potential ${this.getIssueTypeForSink(sink)} from ${source} to ${sink}`,
              location: {
                filePath,
                startLine: 1,
                endLine: 1,
                startColumn: 1,
                endColumn: 1,
              },
              variables: [source, sink],
              taintPath: [],
              code: `${source} -> ${sink}`,
              remediation: `Validate and sanitize ${source} before using in ${sink}`,
            });
          }
        }
      }
    }

    return issues;
  }

  private detectByControlFlow(
    sourceCode: string,
    filePath: string,
    cfg: ControlFlowGraph
  ): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测条件分支中的安全问题
    (cfg as any).nodes?.forEach((node: any) => {
      if (node.type === 'condition' && node.conditions) {
        node.conditions.forEach((condition: string) => {
          // 检测条件中的安全检查缺失
          if (this.isMissingSecurityCheck(condition)) {
            issues.push({
              id: `controlflow_${Date.now()}_${Math.random()}`,
              type: SecurityIssueType.XSS,
              severity: SecuritySeverity.MEDIUM,
              message: 'Missing security check in conditional statement',
              location: {
                filePath,
                startLine: node.startLine || 1,
                endLine: node.startLine || 1,
                startColumn: 1,
                endColumn: 1,
              },
              variables: [],
              taintPath: [],
              code: condition,
              remediation: 'Add proper input validation and sanitization',
            });
          }
        });
      }
    });

    return issues;
  }

  private detectBySymbols(
    sourceCode: string,
    filePath: string,
    symbolTable: SymbolTable
  ): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // 检测符号表中的敏感变量使用 - 限制检测范围
    const sensitivePatterns = [/password/i, /secret/i, /key/i, /token/i, /credential/i];

    // 只在代码较短时进行完整检测，避免大文件导致性能问题
    const maxLinesForFullScan = 1000;
    const lines = sourceCode.split('\n');

    if (lines.length <= maxLinesForFullScan) {
      sensitivePatterns.forEach(pattern => {
        if (pattern.test(sourceCode)) {
          lines.forEach((line, lineIndex) => {
            if (pattern.test(line)) {
              issues.push({
                id: `symbol_${Date.now()}_${Math.random()}`,
                type: SecurityIssueType.INSECURE_DESERIALIZATION,
                severity: SecuritySeverity.MEDIUM,
                message: 'Sensitive information detected in source code',
                location: {
                  filePath,
                  startLine: lineIndex + 1,
                  endLine: lineIndex + 1,
                  startColumn: 1,
                  endColumn: line.length,
                },
                variables: [],
                taintPath: [],
                code: line.trim(),
                remediation: 'Avoid hardcoding sensitive information, use secure configuration',
              });
            }
          });
        }
      });
    }

    return issues;
  }

  private isMissingSecurityCheck(condition: string): boolean {
    const securityPatterns = [/validate/i, /sanitize/i, /escape/i, /encode/i, /filter/i];
    return !securityPatterns.some(pattern => pattern.test(condition));
  }

  private getIssueTypeForSink(sink: string): SecurityIssueType {
    const sinkMap: Record<string, SecurityIssueType> = {
      query: SecurityIssueType.SQL_INJECTION,
      execute: SecurityIssueType.SQL_INJECTION,
      innerHTML: SecurityIssueType.XSS,
      'document.write': SecurityIssueType.XSS,
      eval: SecurityIssueType.COMMAND_INJECTION,
      exec: SecurityIssueType.COMMAND_INJECTION,
      Function: SecurityIssueType.COMMAND_INJECTION,
    };
    return sinkMap[sink] || SecurityIssueType.XSS;
  }

  private generateSummary(issues: SecurityIssue[]): SecurityAnalysisResult['summary'] {
    const summary = {
      total: issues.length,
      bySeverity: {
        [SecuritySeverity.CRITICAL]: 0,
        [SecuritySeverity.HIGH]: 0,
        [SecuritySeverity.MEDIUM]: 0,
        [SecuritySeverity.LOW]: 0,
      },
      byType: {
        [SecurityIssueType.SQL_INJECTION]: 0,
        [SecurityIssueType.XSS]: 0,
        [SecurityIssueType.COMMAND_INJECTION]: 0,
        [SecurityIssueType.PATH_TRAVERSAL]: 0,
        [SecurityIssueType.INSECURE_DESERIALIZATION]: 0,
        [SecurityIssueType.XXE]: 0,
        [SecurityIssueType.LDAP_INJECTION]: 0,
        [SecurityIssueType.SSRF]: 0,
        [SecurityIssueType.BUFFER_OVERFLOW]: 0,
        [SecurityIssueType.AUTHENTICATION]: 0,
        [SecurityIssueType.AUTHORIZATION]: 0,
        [SecurityIssueType.CRYPTOGRAPHY]: 0,
        [SecurityIssueType.DESERIALIZATION]: 0,
        [SecurityIssueType.LOGGING]: 0,
        [SecurityIssueType.CONFIGURATION]: 0,
      },
    };

    issues.forEach(issue => {
      summary.bySeverity[issue.severity]++;
      summary.byType[issue.type]++;
    });

    return summary;
  }

  private generateRecommendations(issues: SecurityIssue[]): string[] {
    const recommendations = new Set<string>();

    issues.forEach(issue => {
      recommendations.add(issue.remediation);
    });

    if (issues.length > 0) {
      recommendations.add('Implement comprehensive input validation');
      recommendations.add('Use security linters and static analysis tools');
      recommendations.add('Regular security code reviews');
      recommendations.add('Implement automated security testing');
    }

    return Array.from(recommendations);
  }
}
