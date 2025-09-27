import { injectable } from 'inversify';
import Parser from 'tree-sitter';
import { SymbolTable, SymbolTableBuilder } from './SymbolTableBuilder';
import { ControlFlowGraph, CFGBuilder } from './CFGBuilder';
import { DataFlowGraph, DataFlowAnalyzer } from './DataFlowGraph';

export interface FileChange {
  filePath: string;
  changeType: 'added' | 'modified' | 'deleted';
  oldContent?: string;
  newContent?: string;
  changeRange?: {
    startLine: number;
    endLine: number;
  };
}

export interface AnalysisScope {
  files: string[];
  affectedFunctions: string[];
  affectedClasses: string[];
  dependencies: Map<string, string[]>;
}

export interface DeltaResult {
  affectedVariables: string[];
  affectedFunctions: string[];
  affectedClasses: string[];
  newSecurityIssues: SecurityIssue[];
  resolvedSecurityIssues: SecurityIssue[];
  performanceImpact: {
    analysisTime: number;
    memoryUsage: number;
  };
}

export interface SecurityIssue {
  id: string;
  type: SecurityIssueType;
  severity: SecuritySeverity;
  message: string;
  location: {
    filePath: string;
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
  };
  variables: string[];
  taintPath: DataFlowPath[];
  remediation: string;
  code: string;
}

export enum SecurityIssueType {
  SQL_INJECTION = 'sql_injection',
  XSS = 'xss',
  COMMAND_INJECTION = 'command_injection',
  PATH_TRAVERSAL = 'path_traversal',
  INSECURE_DESERIALIZATION = 'insecure_deserialization',
  XXE = 'xxe',
  LDAP_INJECTION = 'ldap_injection',
  SSRF = 'ssrf',
  BUFFER_OVERFLOW = 'buffer_overflow',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  CRYPTOGRAPHY = 'cryptography',
  DESERIALIZATION = 'deserialization',
  LOGGING = 'logging',
  CONFIGURATION = 'configuration',
}

export enum SecuritySeverity {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

export interface DataFlowPath {
  from: string;
  to: string;
  variable: string;
  nodes: string[];
  isTainted: boolean;
}

@injectable()
export class IncrementalAnalyzer {
  private symbolTableBuilder: SymbolTableBuilder;
  private cfgBuilder: CFGBuilder;
  private dataFlowAnalyzer: DataFlowAnalyzer;
  private cache: Map<string, CacheEntry>;
  private dependencyGraph: Map<string, string[]>;

  constructor() {
    this.symbolTableBuilder = new SymbolTableBuilder();
    this.cfgBuilder = new CFGBuilder();
    this.dataFlowAnalyzer = new DataFlowAnalyzer();
    this.cache = new Map();
    this.dependencyGraph = new Map();
  }

  async analyzeChanges(changes: FileChange[]): Promise<DeltaResult> {
    const startTime = Date.now();
    const affectedScope = this.calculateAffectedScope(changes);

    // Clear cache for affected files
    this.clearCacheForFiles(affectedScope.files);

    // Incremental analysis
    const incrementalResult = await this.analyzeScope(affectedScope);

    // Merge with previous results
    const mergedResult = this.mergeWithPrevious(incrementalResult, changes);

    const endTime = Date.now();
    mergedResult.performanceImpact = {
      analysisTime: endTime - startTime,
      memoryUsage: this.estimateMemoryUsage(),
    };

    return mergedResult;
  }

  private calculateAffectedScope(changes: FileChange[]): AnalysisScope {
    const affectedFiles = new Set<string>();
    const affectedFunctions = new Set<string>();
    const affectedClasses = new Set<string>();
    const dependencies = new Map<string, string[]>();

    for (const change of changes) {
      affectedFiles.add(change.filePath);

      // Calculate direct dependencies
      const deps = this.getDirectDependencies(change.filePath);
      for (const dep of deps) {
        affectedFiles.add(dep);
        if (!dependencies.has(change.filePath)) {
          dependencies.set(change.filePath, []);
        }
        dependencies.get(change.filePath)!.push(dep);
      }

      // Calculate affected functions/classes
      const affected = this.calculateAffectedSymbols(change);
      affected.functions.forEach(func => affectedFunctions.add(func));
      affected.classes.forEach(cls => affectedClasses.add(cls));
    }

    return {
      files: Array.from(affectedFiles),
      affectedFunctions: Array.from(affectedFunctions),
      affectedClasses: Array.from(affectedClasses),
      dependencies,
    };
  }

  private getDirectDependencies(filePath: string): string[] {
    // This would use import/export analysis to find dependencies
    // For now, return empty array - implement based on actual project structure
    return [];
  }

  private calculateAffectedSymbols(change: FileChange): { functions: string[]; classes: string[] } {
    const functions: string[] = [];
    const classes: string[] = [];

    if (change.changeType === 'modified' && change.changeRange) {
      // Analyze the changed range to determine affected symbols
      const affected = this.analyzeChangeRange(change.filePath, change.changeRange);
      functions.push(...affected.functions);
      classes.push(...affected.classes);
    } else if (change.changeType === 'added') {
      // New file - all symbols are affected
      const allSymbols = this.extractAllSymbols(change.filePath, change.newContent || '');
      functions.push(...allSymbols.functions);
      classes.push(...allSymbols.classes);
    }

    return { functions, classes };
  }

  private analyzeChangeRange(
    filePath: string,
    range: { startLine: number; endLine: number }
  ): { functions: string[]; classes: string[] } {
    // Analyze which functions/classes overlap with the changed range
    const cached = this.cache.get(filePath);
    if (!cached) return { functions: [], classes: [] };

    const functions: string[] = [];
    const classes: string[] = [];

    for (const [funcName, funcRange] of cached.functionRanges) {
      if (this.rangesOverlap(funcRange, range)) {
        functions.push(funcName);
      }
    }

    for (const [className, classRange] of cached.classRanges) {
      if (this.rangesOverlap(classRange, range)) {
        classes.push(className);
      }
    }

    return { functions, classes };
  }

  private extractAllSymbols(
    filePath: string,
    content: string
  ): { functions: string[]; classes: string[] } {
    // Parse the file and extract all function/class names
    // This is a simplified implementation
    return { functions: [], classes: [] };
  }

  private rangesOverlap(
    range1: { startLine: number; endLine: number },
    range2: { startLine: number; endLine: number }
  ): boolean {
    return range1.startLine <= range2.endLine && range1.endLine >= range2.startLine;
  }

  private clearCacheForFiles(files: string[]): void {
    for (const file of files) {
      this.cache.delete(file);
    }
  }

  private async analyzeScope(scope: AnalysisScope): Promise<DeltaResult> {
    // Perform incremental analysis for the affected scope
    const affectedVariables: string[] = [];
    const affectedFunctions: string[] = [];
    const affectedClasses: string[] = [];
    const newSecurityIssues: SecurityIssue[] = [];
    const resolvedSecurityIssues: SecurityIssue[] = [];

    for (const filePath of scope.files) {
      // Analyze each file in the affected scope
      const result = await this.analyzeFile(filePath);
      affectedVariables.push(...result.variables);
      affectedFunctions.push(...result.functions);
      affectedClasses.push(...result.classes);
      newSecurityIssues.push(...result.securityIssues);
    }

    return {
      affectedVariables,
      affectedFunctions,
      affectedClasses,
      newSecurityIssues,
      resolvedSecurityIssues,
      performanceImpact: { analysisTime: 0, memoryUsage: 0 },
    };
  }

  private async analyzeFile(filePath: string): Promise<{
    variables: string[];
    functions: string[];
    classes: string[];
    securityIssues: SecurityIssue[];
  }> {
    // Analyze a single file
    // This is a simplified implementation
    return {
      variables: [],
      functions: [],
      classes: [],
      securityIssues: [],
    };
  }

  private mergeWithPrevious(result: DeltaResult, changes: FileChange[]): DeltaResult {
    // Merge the incremental result with previous analysis
    // This would handle issue resolution and new issue detection
    return result;
  }

  private estimateMemoryUsage(): number {
    // Estimate memory usage based on cache size
    return this.cache.size * 1024; // Simplified estimation
  }
}

interface CacheEntry {
  timestamp: number;
  symbolTable: SymbolTable;
  cfg: ControlFlowGraph;
  dataFlow: DataFlowGraph;
  functionRanges: Map<string, { startLine: number; endLine: number }>;
  classRanges: Map<string, { startLine: number; endLine: number }>;
  securityIssues: SecurityIssue[];
}
