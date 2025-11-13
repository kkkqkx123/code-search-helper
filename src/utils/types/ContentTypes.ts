/**
 * 代码内容分析相关的类型定义
 */

/**
 * 位置信息
 */
export interface LineLocation {
  startLine: number;
  endLine: number;
}

/**
 * 元数据信息
 */
export interface StructureMetadata {
  language: string;
  confidence: number;
  [key: string]: any;
}

/**
 * 顶级结构
 * 表示代码文件中的顶级结构，如函数、类、接口等
 */
export interface TopLevelStructure {
  type: string;
  name: string;
  content: string;
  location: LineLocation;
  node: any; // AST节点
  metadata: StructureMetadata;
}

/**
 * 嵌套结构
 * 表示嵌套在其他结构中的代码结构
 */
export interface NestedStructure {
  type: string;
  name: string;
  content: string;
  location: LineLocation;
  parentNode: any; // 父AST节点
  level: number; // 嵌套层级
  metadata: {
    nestingLevel: number;
    confidence: number;
    [key: string]: any;
  };
}

/**
 * 内部结构
 * 表示结构内部的元素，如变量、控制流等
 */
export interface InternalStructure {
  type: string;
  name: string;
  content: string;
  location: LineLocation;
  parentNode: any; // 父AST节点
  importance: 'low' | 'medium' | 'high';
  metadata: {
    confidence: number;
    [key: string]: any;
  };
}

/**
 * 嵌套关系
 * 表示代码结构之间的嵌套关系
 */
export interface NestingRelationship {
  parent: any; // 父节点
  child: any; // 子节点
  relationshipType: 'contains' | 'extends' | 'implements';
  strength: number; // 关系强度 (0-1)
}

/**
 * 代码引用
 * 表示代码元素之间的引用关系
 */
export interface CodeReference {
  fromNode: any; // 引用源节点
  toNode: any; // 引用目标节点
  referenceType: 'function_call' | 'variable_reference' | 'type_reference';
  line: number; // 引用所在行号
  confidence: number; // 引用置信度
}

/**
 * 代码依赖
 * 表示代码模块之间的依赖关系
 */
export interface CodeDependency {
  fromNode: any; // 依赖源节点
  dependencyType: 'import' | 'inheritance' | 'implementation';
  target: string; // 依赖目标
  line: number; // 依赖所在行号
  confidence: number; // 依赖置信度
}

/**
 * 代码复杂度指标
 */
export interface ComplexityMetrics {
  cyclomaticComplexity: number;
  cognitiveComplexity: number;
  nestingDepth: number;
  linesOfCode: number;
}

/**
 * 代码摘要信息
 */
export interface CodeSummary {
  functions: number;
  classes: number;
  imports: number;
  exports: number;
  linesOfCode: number;
  complexity: number;
}

/**
 * 语法验证结果
 */
export interface SyntaxValidationResult {
  isValid: boolean;
  errors: Array<{
    line: number;
    column: number;
    message: string;
  }>;
}

/**
 * 语言模式配置
 */
export interface LanguagePattern {
  type: string;
  regex: RegExp;
  confidence?: number;
}

/**
 * 分析选项
 */
export interface AnalysisOptions {
  extractRelationships?: boolean;
  includeComplexity?: boolean;
  validateSyntax?: boolean;
  maxDepth?: number;
  confidenceThreshold?: number;
}