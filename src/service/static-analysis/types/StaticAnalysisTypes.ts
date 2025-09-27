/**
 * Static Analysis Types
 * Unified type definitions for static analysis services
 */

export interface AnalysisRequest {
  projectPath: string;
  analysisType: 'basic' | 'security' | 'control-flow' | 'data-flow' | 'comprehensive';
  options?: AnalysisOptions;
}

export interface AnalysisOptions {
  severity?: ('ERROR' | 'WARNING' | 'INFO')[];
  rules?: string[];
  timeout?: number;
  maxTargetBytes?: number;
  includeControlFlow?: boolean;
  includeDataFlow?: boolean;
  includeCallGraph?: boolean;
}

export interface AnalysisResult {
  success?: boolean;
  message?: string;
  findings: EnhancedFinding[];
  metrics: any;
  recommendations: string[];
  enhancedData?: any;
  errors?: string[];
}

export interface AnalysisContext {
  projectPath: string;
  analysisType: string;
  options?: AnalysisOptions;
}

export interface EnhancedFinding extends SemgrepFinding {
  enhanced?: boolean;
  contextScore?: number;
  securityContext?: {
    cvssScore: number;
    remediationDifficulty: string;
    exploitability: string;
  };
  controlFlowContext?: {
    complexity: number;
    nestingDepth: number;
    cyclomaticComplexity: number;
  };
  dataFlowContext?: {
    taintSources: string[];
    taintSinks: string[];
    dataDependencies: any[];
  };
}

/**
 * Semgrep Scan Result Types
 */
export interface SemgrepScanResult {
  id: string;
  projectPath: string;
  scanTime: Date;
  duration: number;
  summary: ScanSummary;
  findings: SemgrepFinding[];
  errors: SemgrepError[];
  metadata: ScanMetadata;
}

export interface ScanSummary {
  totalFiles: number;
  totalFindings: number;
  errorCount: number;
  rulesRun: number;
  targetBytes: number;
  timing: ScanTiming;
}

export interface ScanTiming {
  totalTime: number;
  configTime: number;
  coreTime: number;
  parsingTime: number;
  matchingTime: number;
  ruleParseTime: number;
  fileParseTime: number;
}

export interface SemgrepFinding {
  id: string;
  ruleId: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  cwe?: string[];
  owasp?: string[];
  references?: string[];
  fix?: string;
  location: FindingLocation;
  extra?: Record<string, any>;
  codeContext: CodeMetadata;
}

export interface CodeMetadata {
  id: string;
  filePath: string;
  language: string;
  content: string;
 astPath: string;
  nodeType: string;
  parentType: string;
  children: any[];
  metadata: Record<string, any>;
  type: string;
  lineStart: number;
  lineEnd: number;
}

export interface FindingLocation {
  file: string;
  start: Position;
  end: Position;
  lines: string[];
}

export interface Position {
  line: number;
  col: number;
  offset: number;
}

export interface SemgrepError {
  type: string;
  message: string;
  level: string;
  details?: Record<string, any>;
  path?: string;
}

export interface ScanMetadata {
  semgrepVersion: string;
  configHash: string;
  projectHash: string;
  branch?: string;
  commit?: string;
  author?: string;
}

export interface SemgrepRule {
  id: string;
  message: string;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  languages: string[];
  patterns?: Pattern[];
  pattern?: string;
  patternEither?: Pattern[];
  patternInside?: string;
 patternNot?: string;
  metadata?: RuleMetadata;
  fix?: string;
  options?: Record<string, any>;
}

export interface Pattern {
  pattern?: string;
  patternEither?: Pattern[];
  patternInside?: string;
  patternNot?: string;
  patternNotInside?: string;
  metavariable?: string;
  regex?: string;
}

export interface RuleMetadata {
  category?: string;
  cwe?: string[];
  owasp?: string[];
  references?: string[];
  technology?: string[];
  likelihood?: string;
  impact?: string;
  confidence?: string;
  subcategory?: string;
  source?: string;
  composite?: boolean;
 patterns?: number;
  originalRule?: any;
  originalKey?: string;
  type?: string;
}

export interface SemgrepScanOptions {
  rules?: string[];
  config?: string;
  severity?: ('ERROR' | 'WARNING' | 'INFO')[];
  timeout?: number;
  maxTargetBytes?: number;
  maxMemory?: number;
  jobs?: number;
 exclude?: string[];
  include?: string[];
  baselineCommit?: string;
  dryRun?: boolean;
  quiet?: boolean;
  jsonOutput?: boolean;
  sarifOutput?: boolean;
}

export interface AnalysisTask {
  id: string;
  projectPath: string;
  type: 'semgrep';
  options?: SemgrepScanOptions;
  status: 'pending' | 'running' | 'completed' | 'failed';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  result?: SemgrepScanResult;
  error?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: string[];
  warnings?: string[];
}

// Additional utility types
export interface ErrorInfo {
  type: string;
  message: string;
  level: string;
 details?: Record<string, any>;
  path?: string;
}

export interface GraphNode {
  id: string;
  type: string;
  properties: Record<string, any>;
  relationships: string[];
}

export interface VectorDocument {
  id: string;
  vector: number[];
  metadata: Record<string, any>;
  score?: number;
}