import { injectable, inject } from 'inversify';
import Parser from 'tree-sitter';
import { SymbolTable, SymbolTableBuilder } from '../../parser/analysis/SymbolTableBuilder';
import { ControlFlowGraph, CFGBuilder } from '../../parser/analysis/CFGBuilder';
import { DataFlowGraph, DataFlowAnalyzer, DataFlowEdge } from '../../parser/analysis/DataFlowGraph';
import {
  IncrementalAnalyzer,
  FileChange,
  DeltaResult,
  SecurityIssue,
  SecurityIssueType,
  SecuritySeverity,
} from '../../parser/analysis/IncrementalAnalyzer';
import { TreeSitterCoreService } from '../../parser/core/parse/TreeSitterCoreService';
import { TYPES } from '../../../types';

export interface ComprehensiveAnalysisResult {
  filePath: string;
  ast: Parser.SyntaxNode;
  symbolTable: SymbolTable;
  controlFlow: ControlFlowGraph;
  dataFlow: DataFlowGraph;
  securityIssues: SecurityIssue[];
  metrics: CodeMetrics;
  performance: {
    parseTime: number;
    analysisTime: number;
    memoryUsage: number;
  };
}

export interface CodeMetrics {
  linesOfCode: number;
  cyclomaticComplexity: number;
  nestingDepth: number;
  functionCount: number;
  classCount: number;
  variableCount: number;
  securityHotspots: number;
  testCoverage: number;
}

export interface ProjectAnalysisResult {
  files: ComprehensiveAnalysisResult[];
  projectMetrics: ProjectMetrics;
  securitySummary: SecuritySummary;
  crossFileAnalysis: CrossFileAnalysis;
}

export interface ProjectMetrics {
  totalLinesOfCode: number;
  totalFunctions: number;
  totalClasses: number;
  averageComplexity: number;
  securityIssues: number;
  testCoverage: number;
  languageDistribution: Map<string, number>;
}

export interface SecuritySummary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  issues: SecurityIssue[];
  taintSources: string[];
  taintSinks: string[];
}

export interface CrossFileAnalysis {
  functionCalls: Map<string, string[]>;
  classDependencies: Map<string, string[]>;
  variableUsages: Map<string, string[]>;
  securityPropagation: Map<string, string[]>;
}

@injectable()
export class AdvancedTreeSitterService {
  private symbolTableBuilder: SymbolTableBuilder;
  private cfgBuilder: CFGBuilder;
  private dataFlowAnalyzer: DataFlowAnalyzer;
  private incrementalAnalyzer: IncrementalAnalyzer;
  private treeSitterCore: TreeSitterCoreService;

  constructor(@inject(TYPES.TreeSitterCoreService) treeSitterCore: TreeSitterCoreService) {
    this.symbolTableBuilder = new SymbolTableBuilder();
    this.cfgBuilder = new CFGBuilder();
    this.dataFlowAnalyzer = new DataFlowAnalyzer();
    this.incrementalAnalyzer = new IncrementalAnalyzer();
    this.treeSitterCore = treeSitterCore;
  }

  async buildComprehensiveAnalysis(projectPath: string): Promise<ProjectAnalysisResult> {
    const files = await this.getProjectFiles(projectPath);
    const results: ComprehensiveAnalysisResult[] = [];

    for (const filePath of files) {
      try {
        const result = await this.analyzeFile(filePath);
        results.push(result);
      } catch (error) {
        console.error(`Error analyzing ${filePath}:`, error);
      }
    }

    const projectMetrics = this.calculateProjectMetrics(results);
    const securitySummary = this.calculateSecuritySummary(results);
    const crossFileAnalysis = this.performCrossFileAnalysis(results);

    return {
      files: results,
      projectMetrics,
      securitySummary,
      crossFileAnalysis,
    };
  }

  async analyzeFile(filePath: string, content?: string): Promise<ComprehensiveAnalysisResult> {
    const startTime = Date.now();

    // Read file content if not provided
    const fileContent = content !== undefined ? content : await this.readFileContent(filePath);

    // Parse AST
    const parseStart = Date.now();
    const parseResult = await this.treeSitterCore.parseFile(filePath, fileContent);
    const parseTime = Date.now() - parseStart;

    if (!parseResult.success) {
      throw new Error(`Failed to parse ${filePath}: ${parseResult.error}`);
    }

    // Build symbol table
    const symbolStart = Date.now();
    const symbolTable = this.symbolTableBuilder.build(parseResult.ast, filePath);

    // Build control flow graph
    const cfgStart = Date.now();
    const cfg = this.cfgBuilder.build(parseResult.ast, filePath);

    // Build data flow graph
    const dataFlowStart = Date.now();
    const dataFlowGraph = this.dataFlowAnalyzer.analyze(cfg, symbolTable);

    // Detect security issues
    const securityStart = Date.now();
    const securityIssues = this.detectSecurityIssues(filePath, dataFlowGraph);

    // Calculate metrics
    const metricsStart = Date.now();
    const metrics = this.calculateMetrics(parseResult.ast, cfg, symbolTable);

    const totalAnalysisTime = Date.now() - startTime;
    const memoryUsage = this.estimateMemoryUsage(parseResult.ast, symbolTable, cfg, dataFlowGraph);

    return {
      filePath,
      ast: parseResult.ast,
      symbolTable,
      controlFlow: cfg,
      dataFlow: dataFlowGraph,
      securityIssues,
      metrics,
      performance: {
        parseTime,
        analysisTime: totalAnalysisTime - parseTime,
        memoryUsage,
      },
    };
  }

  async analyzeIncremental(changes: FileChange[]): Promise<DeltaResult> {
    return this.incrementalAnalyzer.analyzeChanges(changes);
  }

  async analyzeFunction(
    projectPath: string,
    functionName: string
  ): Promise<{
    symbolTable: SymbolTable;
    cfg: ControlFlowGraph;
    dataFlow: DataFlowGraph;
    securityIssues: SecurityIssue[];
  }> {
    const files = await this.getProjectFiles(projectPath);

    for (const filePath of files) {
      const result = await this.analyzeFile(filePath);
      const functionSymbols = result.symbolTable.functions.get(functionName);

      if (functionSymbols) {
        return {
          symbolTable: result.symbolTable,
          cfg: result.controlFlow,
          dataFlow: result.dataFlow,
          securityIssues: result.securityIssues.filter(issue =>
            issue.variables.includes(functionName)
          ),
        };
      }
    }

    throw new Error(`Function ${functionName} not found in project ${projectPath}`);
  }

  async analyzeClass(
    projectPath: string,
    className: string
  ): Promise<{
    symbolTable: SymbolTable;
    methods: Map<string, ControlFlowGraph>;
    dataFlow: DataFlowGraph;
    securityIssues: SecurityIssue[];
  }> {
    const files = await this.getProjectFiles(projectPath);

    for (const filePath of files) {
      const result = await this.analyzeFile(filePath);
      const classSymbols = result.symbolTable.classes.get(className);

      if (classSymbols) {
        const methods = new Map<string, ControlFlowGraph>();

        for (const [methodName, methodCFG] of result.controlFlow.functions) {
          if (methodName.startsWith(`${className}.`)) {
            methods.set(methodName, methodCFG);
          }
        }

        return {
          symbolTable: result.symbolTable,
          methods,
          dataFlow: result.dataFlow,
          securityIssues: result.securityIssues.filter(issue =>
            issue.variables.some(v => v.startsWith(className))
          ),
        };
      }
    }

    throw new Error(`Class ${className} not found in project ${projectPath}`);
  }

  async trackVariable(
    projectPath: string,
    variableName: string
  ): Promise<{
    definitions: string[];
    uses: string[];
    taintPath: string[];
    securityIssues: SecurityIssue[];
  }> {
    const files = await this.getProjectFiles(projectPath);
    const allDefinitions: string[] = [];
    const allUses: string[] = [];
    const allTaintPaths: string[] = [];
    const allSecurityIssues: SecurityIssue[] = [];

    for (const filePath of files) {
      const result = await this.analyzeFile(filePath);
      const variableFlows = result.dataFlow.getVariableFlows(variableName);

      if (variableFlows.length > 0) {
        const definitions = result.dataFlow.getVariableDefinitions(variableName);
        const uses = result.dataFlow.getVariableUses(variableName);

        allDefinitions.push(...definitions.map(d => `${filePath}:${d.startLine}`));
        allUses.push(...uses.map(u => `${filePath}:${u.startLine}`));

        if (result.dataFlow.isVariableTainted(variableName)) {
          allTaintPaths.push(filePath);
        }

        allSecurityIssues.push(
          ...result.securityIssues.filter(issue => issue.variables.includes(variableName))
        );
      }
    }

    return {
      definitions: allDefinitions,
      uses: allUses,
      taintPath: allTaintPaths,
      securityIssues: allSecurityIssues,
    };
  }

  private async getProjectFiles(projectPath: string): Promise<string[]> {
    // Implement file discovery logic
    // This should recursively find all source files in the project
    const fs = require('fs');
    const path = require('path');

    const files: string[] = [];
    const extensions = ['.js', '.ts', '.py', '.java', '.go', '.rs', '.cpp', '.c'];

    function findFiles(dir: string) {
      const items = fs.readdirSync(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // Skip node_modules and other common ignore directories
          if (!['node_modules', '.git', 'dist', 'build'].includes(item)) {
            findFiles(fullPath);
          }
        } else if (extensions.includes(path.extname(item))) {
          files.push(fullPath);
        }
      }
    }

    findFiles(projectPath);
    return files;
  }

  private async readFileContent(filePath: string): Promise<string> {
    const fs = require('fs');
    return fs.readFileSync(filePath, 'utf8');
  }

  private calculateProjectMetrics(results: ComprehensiveAnalysisResult[]): ProjectMetrics {
    let totalLinesOfCode = 0;
    let totalFunctions = 0;
    let totalClasses = 0;
    let totalComplexity = 0;
    let totalSecurityIssues = 0;
    const languageDistribution = new Map<string, number>();

    for (const result of results) {
      totalLinesOfCode += result.metrics.linesOfCode;
      totalFunctions += result.metrics.functionCount;
      totalClasses += result.metrics.classCount;
      totalComplexity += result.metrics.cyclomaticComplexity;
      totalSecurityIssues += result.securityIssues.length;

      const language = this.detectLanguage(result.filePath);
      languageDistribution.set(language, (languageDistribution.get(language) || 0) + 1);
    }

    return {
      totalLinesOfCode,
      totalFunctions,
      totalClasses,
      averageComplexity: totalFunctions > 0 ? totalComplexity / totalFunctions : 0,
      securityIssues: totalSecurityIssues,
      testCoverage: 0, // Would need test coverage data
      languageDistribution,
    };
  }

  private calculateSecuritySummary(results: ComprehensiveAnalysisResult[]): SecuritySummary {
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;
    const allIssues: SecurityIssue[] = [];
    const taintSources = new Set<string>();
    const taintSinks = new Set<string>();

    for (const result of results) {
      for (const issue of result.securityIssues) {
        allIssues.push(issue);

        switch (issue.severity) {
          case 'critical':
            critical++;
            break;
          case 'high':
            high++;
            break;
          case 'medium':
            medium++;
            break;
          case 'low':
            low++;
            break;
        }
      }

      // Collect taint sources and sinks
      for (const flow of result.dataFlow.getTaintedFlows()) {
        taintSources.add(flow.sourceNode.id);
        taintSinks.add(flow.targetNode.id);
      }
    }

    return {
      critical,
      high,
      medium,
      low,
      issues: allIssues,
      taintSources: Array.from(taintSources),
      taintSinks: Array.from(taintSinks),
    };
  }

  private performCrossFileAnalysis(results: ComprehensiveAnalysisResult[]): CrossFileAnalysis {
    const functionCalls = new Map<string, string[]>();
    const classDependencies = new Map<string, string[]>();
    const variableUsages = new Map<string, string[]>();
    const securityPropagation = new Map<string, string[]>();

    for (const result of results) {
      // Analyze function calls across files
      this.analyzeFunctionCalls(result, functionCalls);

      // Analyze class dependencies
      this.analyzeClassDependencies(result, classDependencies);

      // Analyze variable usages
      this.analyzeVariableUsages(result, variableUsages);

      // Analyze security propagation
      this.analyzeSecurityPropagation(result, securityPropagation);
    }

    return {
      functionCalls,
      classDependencies,
      variableUsages,
      securityPropagation,
    };
  }

  private analyzeFunctionCalls(
    result: ComprehensiveAnalysisResult,
    functionCalls: Map<string, string[]>
  ): void {
    // Implementation for cross-file function call analysis
  }

  private analyzeClassDependencies(
    result: ComprehensiveAnalysisResult,
    classDependencies: Map<string, string[]>
  ): void {
    // Implementation for cross-file class dependency analysis
  }

  private analyzeVariableUsages(
    result: ComprehensiveAnalysisResult,
    variableUsages: Map<string, string[]>
  ): void {
    // Implementation for cross-file variable usage analysis
  }

  private analyzeSecurityPropagation(
    result: ComprehensiveAnalysisResult,
    securityPropagation: Map<string, string[]>
  ): void {
    // Implementation for security issue propagation analysis
  }

  private calculateMetrics(
    ast: Parser.SyntaxNode,
    cfg: ControlFlowGraph,
    symbolTable: SymbolTable
  ): CodeMetrics {
    const linesOfCode = this.countLinesOfCode(ast);
    const cyclomaticComplexity = this.calculateCyclomaticComplexity(cfg);
    const nestingDepth = this.calculateNestingDepth(ast);
    const functionCount = symbolTable.functions.size;
    const classCount = symbolTable.classes.size;
    const variableCount = symbolTable.getAllSymbols().length;
    const securityHotspots = 0; // Would need security analysis
    const testCoverage = 0; // Would need test data

    return {
      linesOfCode,
      cyclomaticComplexity,
      nestingDepth,
      functionCount,
      classCount,
      variableCount,
      securityHotspots,
      testCoverage,
    };
  }

  private countLinesOfCode(ast: Parser.SyntaxNode): number {
    return ast.endPosition.row - ast.startPosition.row + 1;
  }

  private calculateCyclomaticComplexity(cfg: ControlFlowGraph): number {
    const edges = cfg.edges.length;
    const nodes = cfg.nodes.length;
    const components = 1; // Assuming single component

    return edges - nodes + 2 * components;
  }

  private calculateNestingDepth(ast: Parser.SyntaxNode): number {
    let maxDepth = 0;

    function traverse(node: Parser.SyntaxNode, currentDepth: number) {
      if (
        ['if_statement', 'while_statement', 'for_statement', 'switch_statement'].includes(node.type)
      ) {
        currentDepth++;
        maxDepth = Math.max(maxDepth, currentDepth);
      }

      for (const child of node.children) {
        traverse(child, currentDepth);
      }
    }

    traverse(ast, 0);
    return maxDepth;
  }

  private estimateMemoryUsage(
    ast: Parser.SyntaxNode,
    symbolTable: SymbolTable,
    cfg: ControlFlowGraph,
    dataFlow: DataFlowGraph
  ): number {
    const astSize = JSON.stringify(ast).length;
    const symbolSize = JSON.stringify(symbolTable).length;
    const cfgSize = JSON.stringify(cfg).length;
    const dataFlowSize = JSON.stringify(dataFlow).length;

    return astSize + symbolSize + cfgSize + dataFlowSize;
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const languageMap: { [key: string]: string } = {
      js: 'javascript',
      ts: 'typescript',
      py: 'python',
      java: 'java',
      go: 'go',
      rs: 'rust',
      cpp: 'cpp',
      c: 'c',
    };

    return languageMap[ext || ''] || 'unknown';
  }

  private detectSecurityIssues(filePath: string, dataFlowGraph: DataFlowGraph): SecurityIssue[] {
    const issues: SecurityIssue[] = [];

    // Get all tainted flows from the data flow graph
    const taintedFlows = dataFlowGraph.getTaintedFlows();

    for (const flow of taintedFlows) {
      // Check for SQL injection
      if (this.isSQLSink(flow)) {
        issues.push({
          id: `sql_injection_${filePath}_${flow.targetNode.startLine}`,
          type: SecurityIssueType.SQL_INJECTION,
          severity: SecuritySeverity.HIGH,
          message: `Potential SQL injection: variable ${flow.variable} flows to SQL sink`,
          location: {
            filePath,
            startLine: flow.targetNode.startLine,
            endLine: flow.targetNode.endLine,
            startColumn: 0,
            endColumn: 0,
          },
          variables: [flow.variable],
          taintPath: [],
          remediation: 'Use parameterized queries or prepared statements to prevent SQL injection',
          code: flow.targetNode.statements.map(s => s.text).join('\n'),
        });
      }

      // Check for XSS
      if (this.isXSSSink(flow)) {
        issues.push({
          id: `xss_${filePath}_${flow.targetNode.startLine}`,
          type: SecurityIssueType.XSS,
          severity: SecuritySeverity.HIGH,
          message: `Potential XSS: variable ${flow.variable} flows to XSS sink`,
          location: {
            filePath,
            startLine: flow.targetNode.startLine,
            endLine: flow.targetNode.endLine,
            startColumn: 0,
            endColumn: 0,
          },
          variables: [flow.variable],
          taintPath: [],
          remediation: 'Use proper output encoding or Content Security Policy to prevent XSS',
          code: flow.targetNode.statements.map(s => s.text).join('\n'),
        });
      }

      // Check for command injection
      if (this.isCommandSink(flow)) {
        issues.push({
          id: `command_injection_${filePath}_${flow.targetNode.startLine}`,
          type: SecurityIssueType.COMMAND_INJECTION,
          severity: SecuritySeverity.HIGH,
          message: `Potential command injection: variable ${flow.variable} flows to command sink`,
          location: {
            filePath,
            startLine: flow.targetNode.startLine,
            endLine: flow.targetNode.endLine,
            startColumn: 0,
            endColumn: 0,
          },
          variables: [flow.variable],
          taintPath: [],
          remediation: 'Use safe APIs or proper input validation to prevent command injection',
          code: flow.targetNode.statements.map(s => s.text).join('\n'),
        });
      }

      // Check for path traversal
      if (this.isPathTraversalSink(flow)) {
        issues.push({
          id: `path_traversal_${filePath}_${flow.targetNode.startLine}`,
          type: SecurityIssueType.PATH_TRAVERSAL,
          severity: SecuritySeverity.MEDIUM,
          message: `Potential path traversal: variable ${flow.variable} flows to file operation`,
          location: {
            filePath,
            startLine: flow.targetNode.startLine,
            endLine: flow.targetNode.endLine,
            startColumn: 0,
            endColumn: 0,
          },
          variables: [flow.variable],
          taintPath: [],
          remediation: 'Validate and sanitize file paths to prevent path traversal attacks',
          code: flow.targetNode.statements.map(s => s.text).join('\n'),
        });
      }
    }

    return issues;
  }

  private isSQLSink(flow: DataFlowEdge): boolean {
    const sqlPatterns = ['query', 'execute', 'exec', 'prepare', 'Statement'];
    const text = flow.targetNode.statements
      .map(s => s.text)
      .join(' ')
      .toLowerCase();
    return sqlPatterns.some(pattern => text.includes(pattern.toLowerCase()));
  }

  private isXSSSink(flow: DataFlowEdge): boolean {
    const xssPatterns = ['innerHTML', 'outerHTML', 'document.write', 'eval'];
    const text = flow.targetNode.statements
      .map(s => s.text)
      .join(' ')
      .toLowerCase();
    return xssPatterns.some(pattern => text.includes(pattern.toLowerCase()));
  }

  private isCommandSink(flow: DataFlowEdge): boolean {
    const commandPatterns = ['exec', 'spawn', 'system', 'shell', 'cmd'];
    const text = flow.targetNode.statements
      .map(s => s.text)
      .join(' ')
      .toLowerCase();
    return commandPatterns.some(pattern => text.includes(pattern.toLowerCase()));
  }

  private isPathTraversalSink(flow: DataFlowEdge): boolean {
    const pathPatterns = ['readFile', 'writeFile', 'open', 'fs.', 'path.'];
    const text = flow.targetNode.statements
      .map(s => s.text)
      .join(' ')
      .toLowerCase();
    return pathPatterns.some(pattern => text.includes(pattern.toLowerCase()));
  }
}
