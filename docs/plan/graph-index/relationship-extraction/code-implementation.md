
## 实现方案

### 阶段一：紧急修复（1-2天）

#### 1.1 修复查询结果匹配问题

**文件**: `src/service/graph/mapping/GraphDataMappingService.ts`

```typescript
// 新增语言特定的capture映射
const LANGUAGE_CAPTURE_MAPPINGS: Record<string, Record<string, string>> = {
  'javascript': {
    'call': 'definition.call',
    'function': 'definition.function',
    'class': 'definition.class',
    'interface': 'definition.interface',
    'import': 'definition.import',
    'export': 'definition.export'
  },
  'typescript': {
    'call': 'definition.call',
    'function': 'definition.function',
    'class': 'definition.class',
    'interface': 'definition.interface',
    'import': 'definition.import',
    'export': 'definition.export'
  },
  'python': {
    'call': 'definition.call',
    'function': 'definition.function',
    'class': 'definition.class',
    'import': 'definition.import_from',
    'export': 'definition.variable' // Python中导出通常是变量
  },
  'java': {
    'call': 'definition.method_call',
    'function': 'definition.method',
    'class': 'definition.class',
    'interface': 'definition.interface',
    'import': 'definition.import',
    'export': 'definition.type' // Java中导出通常是类型
  }
  // ... 其他语言
};

// 修复processCall方法
private processCall(match: QueryMatch, nodes: GraphNode[], edges: GraphEdge[], language: string): void {
  const captures = match.captures;
  const location = match.location;
  const captureMapping = LANGUAGE_CAPTURE_MAPPINGS[language] || LANGUAGE_CAPTURE_MAPPINGS['javascript'];

  // 获取调用信息
  const callCapture = captures[captureMapping['call']];
  if (!callCapture) {
    this.logger.warn(`Call capture not found for language ${language}`, { captures: Object.keys(captures) });
    return;
  }

  const callName = callCapture.text;
  const filePath = captures['file_path']?.text || 'unknown';

  // 查找调用者函数上下文
  const callerContext = this.findCallerFunctionContext(match.node, filePath);
  if (!callerContext) {
    this.logger.warn(`Unable to find caller context for call: ${callName}`);
    return;
  }

  // 创建调用关系
  const callEdge: GraphEdge = {
    id: uuidv4(),
    type: GraphRelationshipType.CALLS,
    sourceNodeId: callerContext.functionId, // 正确的调用者函数ID
    targetNodeId: this.generateFunctionNodeId(callName, filePath),
    properties: {
      callName,
      lineNumber: location.startLine,
      columnNumber: location.startColumn,
      filePath,
      callType: this.determineCallType(match.node)
    }
  };

  edges.push(callEdge);
}

// 新增：查找调用者函数上下文
private findCallerFunctionContext(callNode: Parser.SyntaxNode, filePath: string): {
  functionId: string;
  functionName: string;
} | null {
  let current = callNode.parent;
  
  while (current) {
    if (this.isFunctionNode(current)) {
      const functionName = this.extractFunctionName(current);
      return {
        functionId: this.generateFunctionNodeId(functionName, filePath),
        functionName
      };
    }
    current = current.parent;
  }
  
  return null;
}

// 新增：判断是否为函数节点
private isFunctionNode(node: Parser.SyntaxNode): boolean {
  const functionTypes = [
    'function_declaration',
    'function_expression',
    'arrow_function',
    'method_definition',
    'class_method',
    'function_definition' // Python
  ];
  return functionTypes.includes(node.type);
}
```

#### 1.2 实现语言特定的AST节点类型映射

**文件**: `src/service/graph/mapping/LanguageNodeTypes.ts`

```typescript
export interface LanguageNodeMapping {
  callExpression: string[];
  functionDeclaration: string[];
  classDeclaration: string[];
  interfaceDeclaration: string[];
  importDeclaration: string[];
  exportDeclaration: string[];
  memberExpression: string[];
  propertyIdentifier: string[];
}

export const LANGUAGE_NODE_MAPPINGS: Record<string, LanguageNodeMapping> = {
  'javascript': {
    callExpression: ['call_expression'],
    functionDeclaration: ['function_declaration', 'function_expression', 'arrow_function'],
    classDeclaration: ['class_declaration'],
    interfaceDeclaration: ['interface_declaration'],
    importDeclaration: ['import_statement'],
    exportDeclaration: ['export_statement'],
    memberExpression: ['member_expression'],
    propertyIdentifier: ['property_identifier']
  },
  'typescript': {
    callExpression: ['call_expression'],
    functionDeclaration: ['function_declaration', 'function_expression', 'arrow_function'],
    classDeclaration: ['class_declaration', 'abstract_class_declaration'],
    interfaceDeclaration: ['interface_declaration'],
    importDeclaration: ['import_statement'],
    exportDeclaration: ['export_statement'],
    memberExpression: ['member_expression'],
    propertyIdentifier: ['property_identifier']
  },
  'python': {
    callExpression: ['call'],
    functionDeclaration: ['function_definition'],
    classDeclaration: ['class_definition'],
    interfaceDeclaration: [], // Python没有接口
    importDeclaration: ['import_statement', 'import_from_statement'],
    exportDeclaration: [], // Python没有显式导出
    memberExpression: ['attribute'],
    propertyIdentifier: ['identifier']
  },
  'java': {
    callExpression: ['method_invocation'],
    functionDeclaration: ['method_declaration', 'constructor_declaration'],
    classDeclaration: ['class_declaration'],
    interfaceDeclaration: ['interface_declaration'],
    importDeclaration: ['import_declaration'],
    exportDeclaration: [], // Java没有显式导出
    memberExpression: ['field_access'],
    propertyIdentifier: ['identifier']
  },
  'go': {
    callExpression: ['call_expression'],
    functionDeclaration: ['function_declaration'],
    classDeclaration: [], // Go使用struct
    interfaceDeclaration: [], // Go使用interface
    importDeclaration: ['import_spec'],
    exportDeclaration: [], // Go通过大小写控制导出
    memberExpression: ['selector_expression'],
    propertyIdentifier: ['identifier']
  }
  // ... 其他语言
};
```

#### 1.3 修复SemanticRelationshipExtractor

**文件**: `src/service/graph/mapping/SemanticRelationshipExtractor.ts`

```typescript
import { LANGUAGE_NODE_MAPPINGS } from './LanguageNodeTypes';

export class SemanticRelationshipExtractor {
  // 修复extractCalledFunctionsFromAST方法
  private async extractCalledFunctionsFromAST(
    functionInfo: FunctionInfo, 
    analysisResult: FileAnalysisResult, 
    fileContent: string
  ): Promise<string[]> {
    if (!analysisResult.ast) {
      return [];
    }

    const language = analysisResult.language.toLowerCase();
    const nodeMapping = LANGUAGE_NODE_MAPPINGS[language];
    
    if (!nodeMapping) {
      this.logger.warn(`No node mapping found for language: ${language}`);
      return [];
    }

    try {
      const calledFunctions: string[] = [];
      
      // 使用语言特定的节点类型
      for (const callType of nodeMapping.callExpression) {
        const callExpressions = this.treeSitterService.findNodeByType(analysisResult.ast, callType);
        
        for (const callExpr of callExpressions) {
          // 检查调用是否在当前函数内部
          if (this.isNodeInFunction(callExpr, functionInfo)) {
            const functionName = this.extractFunctionNameFromCall(callExpr, fileContent, language);
            if (functionName) {
              calledFunctions.push(functionName);
            }
          }
        }
      }

      return [...new Set(calledFunctions)]; // 去重
    } catch (error) {
      this.logger.warn('Failed to extract function calls from AST', { 
        error: (error as Error).message,
        language 
      });
      return [];
    }
  }

  // 新增：检查节点是否在指定函数内部
  private isNodeInFunction(node: Parser.SyntaxNode, functionInfo: FunctionInfo): boolean {
    const functionStartLine = functionInfo.startLine;
    const functionEndLine = functionInfo.endLine;
    
    const nodeLocation = this.treeSitterService.getNodeLocation(node);
    return nodeLocation.startLine >= functionStartLine && 
           nodeLocation.endLine <= functionEndLine;
  }

  // 新增：从调用表达式中提取函数名
  private extractFunctionNameFromCall(
    callExpr: Parser.SyntaxNode, 
    fileContent: string, 
    language: string
  ): string | null {
    const nodeMapping = LANGUAGE_NODE_MAPPINGS[language];
    
    if (!callExpr.children || callExpr.children.length === 0) {
      return null;
    }

    const funcNameNode = callExpr.children[0];
    
    // 处理简单标识符
    if (funcNameNode.type === 'identifier') {
      return this.treeSitterService.getNodeText(funcNameNode, fileContent);
    }
    
    // 处理成员表达式 (obj.method())
    if (nodeMapping.memberExpression.includes(funcNameNode.type)) {
      return this.extractMethodNameFromMemberExpression(funcNameNode, fileContent, language);
    }
    
    return null;
  }

  // 新增：从成员表达式中提取方法名
  private extractMethodNameFromMemberExpression(
    memberExpr: Parser.SyntaxNode, 
    fileContent: string, 
    language: string
  ): string | null {
    const nodeMapping = LANGUAGE_NODE_MAPPINGS[language];
    
    if (!memberExpr.children || memberExpr.children.length === 0) {
      return null;
    }

    // 获取最后一个子节点（通常是属性标识符）
    const lastChild = memberExpr.children[memberExpr.children.length - 1];
    
    if (nodeMapping.propertyIdentifier.includes(lastChild.type)) {
      return this.treeSitterService.getNodeText(lastChild, fileContent);
    }
    
    return null;
  }
}
```

### 阶段二：架构重构（3-5天）

#### 2.1 设计并实现符号解析器

**文件**: `src/service/graph/symbol/SymbolResolver.ts`

```typescript
import { Parser } from 'tree-sitter';
import { TreeSitterService } from '../../parser/core/parse/TreeSitterService';
import { LoggerService } from '../../../utils/LoggerService';

// 符号类型枚举
export enum SymbolType {
  FUNCTION = 'function',
  CLASS = 'class',
  INTERFACE = 'interface',
  VARIABLE = 'variable',
  PARAMETER = 'parameter',
  IMPORT = 'import'
}

// 符号定义
export interface Symbol {
  name: string;
  type: SymbolType;
  filePath: string;
  location: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  // 对于函数，记录参数
  parameters?: string[];
  // 对于类，记录方法和属性
  members?: Symbol[];
  // 对于导入，记录源路径
  sourcePath?: string;
}

// 作用域定义
export interface Scope {
  type: 'global' | 'module' | 'class' | 'function';
  name: string;
  symbols: Map<string, Symbol>;
  parent?: Scope;
  children: Scope[];
}

// 符号表
export interface SymbolTable {
  filePath: string;
  globalScope: Scope;
  imports: Map<string, string>; // 导入的符号映射到源文件
}

@injectable()
export class SymbolResolver {
  private symbolTables: Map<string, SymbolTable> = new Map();
  
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  // 为文件构建符号表
  async buildSymbolTable(filePath: string, ast: Parser.SyntaxNode, language: string): Promise<SymbolTable> {
    this.logger.info(`Building symbol table for ${filePath}`);
    
    const globalScope: Scope = {
      type: 'global',
      name: 'global',
      symbols: new Map(),
      children: []
    };
    
    const symbolTable: SymbolTable = {
      filePath,
      globalScope,
      imports: new Map()
    };
    
    // 根据语言特定的规则提取符号
    await this.extractSymbols(ast, globalScope, language, filePath);
    
    // 处理导入语句
    await this.processImports(ast, symbolTable, language);
    
    this.symbolTables.set(filePath, symbolTable);
    return symbolTable;
  }

  // 解析标识符
  resolveSymbol(identifier: string, filePath: string, currentNode: Parser.SyntaxNode): Symbol | null {
    const symbolTable = this.symbolTables.get(filePath);
    if (!symbolTable) {
      return null;
    }
    
    // 首先在当前作用域查找
    const currentScope = this.findCurrentScope(currentNode, symbolTable.globalScope);
    if (currentScope) {
      const symbol = currentScope.symbols.get(identifier);
      if (symbol) {
        return symbol;
      }
    }
    
    // 在全局作用域查找
    const globalSymbol = symbolTable.globalScope.symbols.get(identifier);
    if (globalSymbol) {
      return globalSymbol;
    }
    
    // 在导入的符号中查找
    const importPath = symbolTable.imports.get(identifier);
    if (importPath) {
      return this.resolveImportedSymbol(identifier, importPath);
    }
    
    return null;
  }

  // 获取文件的符号表
  getSymbolTable(filePath: string): SymbolTable | null {
    return this.symbolTables.get(filePath) || null;
  }

  // 私有方法：提取符号
  private async extractSymbols(
    node: Parser.SyntaxNode,
    scope: Scope,
    language: string,
    filePath: string
  ): Promise<void> {
    // 根据语言特定的节点类型提取符号
    const languageExtractor = this.getLanguageExtractor(language);
    if (languageExtractor) {
      await languageExtractor.extractSymbols(node, scope, filePath);
    }
    
    // 递归处理子节点
    for (const child of node.children) {
      await this.extractSymbols(child, scope, language, filePath);
    }
  }

  // 私有方法：处理导入
  private async processImports(
    ast: Parser.SyntaxNode,
    symbolTable: SymbolTable,
    language: string
  ): Promise<void> {
    const languageExtractor = this.getLanguageExtractor(language);
    if (languageExtractor) {
      await languageExtractor.processImports(ast, symbolTable);
    }
  }

  // 私有方法：查找当前作用域
  private findCurrentScope(node: Parser.SyntaxNode, globalScope: Scope): Scope | null {
    // 实现查找节点所在作用域的逻辑
    return null;
  }

  // 私有方法：解析导入的符号
  private resolveImportedSymbol(identifier: string, importPath: string): Symbol | null {
    const importedTable = this.symbolTables.get(importPath);
    if (importedTable) {
      return importedTable.globalScope.symbols.get(identifier) || null;
    }
    return null;
  }

  // 私有方法：获取语言特定的提取器
  private getLanguageExtractor(language: string): LanguageSymbolExtractor | null {
    switch (language.toLowerCase()) {
      case 'javascript':
      case 'typescript':
        return new JavaScriptSymbolExtractor(this.treeSitterService);
      case 'python':
        return new PythonSymbolExtractor(this.treeSitterService);
      case 'java':
        return new JavaSymbolExtractor(this.treeSitterService);
      default:
        return null;
    }
  }
}

// 语言特定的符号提取器接口
interface LanguageSymbolExtractor {
  extractSymbols(node: Parser.SyntaxNode, scope: Scope, filePath: string): Promise<void>;
  processImports(ast: Parser.SyntaxNode, symbolTable: SymbolTable): Promise<void>;
}

// JavaScript/TypeScript符号提取器
class JavaScriptSymbolExtractor implements LanguageSymbolExtractor {
  constructor(private treeSitterService: TreeSitterService) {}
  
  async extractSymbols(node: Parser.SyntaxNode, scope: Scope, filePath: string): Promise<void> {
    // 实现JavaScript/TypeScript特定的符号提取逻辑
  }
  
  async processImports(ast: Parser.SyntaxNode, symbolTable: SymbolTable): Promise<void> {
    // 实现JavaScript/TypeScript特定的导入处理逻辑
  }
}

// Python符号提取器
class PythonSymbolExtractor implements LanguageSymbolExtractor {
  constructor(private treeSitterService: TreeSitterService) {}
  
  async extractSymbols(node: Parser.SyntaxNode, scope: Scope, filePath: string): Promise<void> {
    // 实现Python特定的符号提取逻辑
  }
  
  async processImports(ast: Parser.SyntaxNode, symbolTable: SymbolTable): Promise<void> {
    // 实现Python特定的导入处理逻辑
  }
}

// Java符号提取器
class JavaSymbolExtractor implements LanguageSymbolExtractor {
  constructor(private treeSitterService: TreeSitterService) {}
  
  async extractSymbols(node: Parser.SyntaxNode, scope: Scope, filePath: string): Promise<void> {
    // 实现Java特定的符号提取逻辑
  }
  
  async processImports(ast: Parser.SyntaxNode, symbolTable: SymbolTable): Promise<void> {
    // 实现Java特定的导入处理逻辑
  }
}
```

#### 2.2 创建统一的关系提取接口

**文件**: `src/service/graph/mapping/interfaces/IRelationshipExtractor.ts`

```typescript
import { SymbolResolver, Symbol } from '../../symbol/SymbolResolver';

// 扩展的调用关系
export interface CallRelationship {
  callerId: string;
  calleeId: string;
  callName: string;
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
  callType: 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator';
  // 新增：调用上下文信息
  callContext?: {
    isChained: boolean; // 是否为链式调用的一部分
    chainDepth?: number; // 链式调用的深度
    isAsync: boolean; // 是否为异步调用
  };
  // 新增：解析后的符号信息
  resolvedSymbol?: Symbol;
}

// 扩展的继承关系
export interface InheritanceRelationship {
  parentId: string;
  childId: string;
  inheritanceType: 'extends' | 'implements' | 'mixin';
  location: {
    filePath: string;
    lineNumber: number;
  };
  // 新增：解析后的符号信息
  resolvedParentSymbol?: Symbol;
  resolvedChildSymbol?: Symbol;
}

// 扩展的依赖关系
export interface DependencyRelationship {
  sourceId: string;
  targetId: string;
  dependencyType: 'import' | 'export' | 'type_dependency' | 'namespace';
  target: string;
  location: {
    filePath: string;
    lineNumber: number;
  };
  // 新增：导入的具体符号
  importedSymbols?: string[];
  // 新增：解析后的符号信息
  resolvedTargetSymbol?: Symbol;
}

// 新增：引用关系
export interface ReferenceRelationship {
  sourceId: string;
  targetId: string;
  referenceType: 'variable' | 'constant' | 'parameter' | 'field';
  referenceName: string;
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
  // 新增：解析后的符号信息
  resolvedSymbol?: Symbol;
}

// 新增：创建关系
export interface CreationRelationship {
  sourceId: string;
  targetId: string;
  creationType: 'instantiation' | 'factory' | 'dependency_injection';
  targetName: string;
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
  // 新增：解析后的符号信息
  resolvedTargetSymbol?: Symbol;
}

// 新增：注解/装饰关系
export interface AnnotationRelationship {
  sourceId: string;
  targetId: string;
  annotationType: 'decorator' | 'annotation' | 'attribute';
  annotationName: string;
  location: {
    filePath: string;
    lineNumber: number;
    columnNumber: number;
  };
  // 新增：注解参数
  parameters?: Record<string, any>;
  // 新增：解析后的符号信息
  resolvedAnnotationSymbol?: Symbol;
}

// 扩展的关系提取结果
export interface RelationshipExtractionResult {
  callRelationships: CallRelationship[];
  inheritanceRelationships: InheritanceRelationship[];
  dependencyRelationships: DependencyRelationship[];
  // 新增的关系类型
  referenceRelationships: ReferenceRelationship[];
  creationRelationships: CreationRelationship[];
  annotationRelationships: AnnotationRelationship[];
}

// 扩展的关系提取器接口
export interface ILanguageRelationshipExtractor {
  extractCallRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    fileContent: string,
    symbolResolver: SymbolResolver
  ): Promise<CallRelationship[]>;
  
  extractInheritanceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<InheritanceRelationship[]>;
  
  extractDependencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DependencyRelationship[]>;
  
  // 新增的关系提取方法
  extractReferenceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    fileContent: string,
    symbolResolver: SymbolResolver
  ): Promise<ReferenceRelationship[]>;
  
  extractCreationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    fileContent: string,
    symbolResolver: SymbolResolver
  ): Promise<CreationRelationship[]>;
  
  extractAnnotationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<AnnotationRelationship[]>;
  
  getSupportedLanguage(): string;
  
  // 新增：支持的关系类型
  getSupportedRelationshipTypes(): string[];
}
```

#### 2.3 实现JavaScript/TypeScript关系提取器

**文件**: `src/service/graph/mapping/extractors/JavaScriptRelationshipExtractor.ts`

```typescript
import {
  ILanguageRelationshipExtractor,
  CallRelationship,
  InheritanceRelationship,
  DependencyRelationship,
  ReferenceRelationship,
  CreationRelationship,
  AnnotationRelationship
} from '../interfaces/IRelationshipExtractor';
import { SymbolResolver, Symbol } from '../../symbol/SymbolResolver';
import { TreeSitterService } from '../../parser/core/parse/TreeSitterService';
import { LoggerService } from '../../../utils/LoggerService';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../../types';

@injectable()
export class JavaScriptRelationshipExtractor implements ILanguageRelationshipExtractor {
  constructor(
    @inject(TYPES.TreeSitterService) private treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) private logger: LoggerService
  ) {}

  getSupportedLanguage(): string {
    return 'javascript';
  }

  getSupportedRelationshipTypes(): string[] {
    return [
      'call', 'inheritance', 'dependency',
      'reference', 'creation', 'annotation'
    ];
  }

  async extractCallRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    fileContent: string,
    symbolResolver: SymbolResolver
  ): Promise<CallRelationship[]> {
    const relationships: CallRelationship[] = [];
    
    // 查找所有调用表达式
    const callExpressions = this.treeSitterService.findNodeByType(ast, 'call_expression');
    
    for (const callExpr of callExpressions) {
      // 使用符号解析器查找调用者函数
      const callerSymbol = this.findCallerSymbol(callExpr, symbolResolver, filePath);
      const calleeName = this.extractCalleeName(callExpr, fileContent);
      
      if (callerSymbol && calleeName) {
        // 使用符号解析器解析被调用函数
        const resolvedSymbol = symbolResolver.resolveSymbol(calleeName, filePath, callExpr);
        
        // 分析调用上下文
        const callContext = this.analyzeCallContext(callExpr, fileContent);
        
        relationships.push({
          callerId: this.generateSymbolId(callerSymbol),
          calleeId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(calleeName, 'function', filePath),
          callName: calleeName,
          location: {
            filePath,
            lineNumber: callExpr.startPosition.row + 1,
            columnNumber: callExpr.startPosition.column + 1
          },
          callType: this.determineCallType(callExpr, resolvedSymbol),
          callContext,
          resolvedSymbol: resolvedSymbol || undefined
        });
      }
    }
    
    return relationships;
  }

  async extractInheritanceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<InheritanceRelationship[]> {
    const relationships: InheritanceRelationship[] = [];
    
    // 查找类声明
    const classDeclarations = this.treeSitterService.findNodeByType(ast, 'class_declaration');
    
    for (const classDecl of classDeclarations) {
      const className = this.extractClassName(classDecl);
      const heritageClauses = this.findHeritageClauses(classDecl);
      
      if (className && heritageClauses) {
        for (const heritageClause of heritageClauses) {
          const parentClassName = this.extractParentClassName(heritageClause);
          const inheritanceType = this.getInheritanceType(heritageClause);
          
          if (parentClassName) {
            // 使用符号解析器解析父类符号
            const resolvedParentSymbol = symbolResolver.resolveSymbol(parentClassName, filePath, heritageClause);
            const childSymbol = symbolResolver.resolveSymbol(className, filePath, classDecl);
            
            relationships.push({
              parentId: resolvedParentSymbol ? this.generateSymbolId(resolvedParentSymbol) : this.generateNodeId(parentClassName, 'class', filePath),
              childId: childSymbol ? this.generateSymbolId(childSymbol) : this.generateNodeId(className, 'class', filePath),
              inheritanceType,
              location: {
                filePath,
                lineNumber: classDecl.startPosition.row + 1
              },
              resolvedParentSymbol: resolvedParentSymbol || undefined,
              resolvedChildSymbol: childSymbol || undefined
            });
          }
        }
      }
    }
    
    return relationships;
  }

  async extractDependencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DependencyRelationship[]> {
    const relationships: DependencyRelationship[] = [];
    
    // 查找导入语句
    const importStatements = this.treeSitterService.findNodeByType(ast, 'import_statement');
    
    for (const importStmt of importStatements) {
      const importInfo = this.extractImportInfo(importStmt);
      
      if (importInfo) {
        // 使用符号解析器解析导入的模块
        const resolvedTargetSymbol = symbolResolver.resolveSymbol(importInfo.source, filePath, importStmt);
        
        relationships.push({
          sourceId: this.generateNodeId(filePath, 'file', filePath),
          targetId: resolvedTargetSymbol ? this.generateSymbolId(resolvedTargetSymbol) : this.generateNodeId(importInfo.source, 'module', importInfo.source),
          dependencyType: 'import',
          target: importInfo.source,
          importedSymbols: importInfo.importedSymbols,
          location: {
            filePath,
            lineNumber: importStmt.startPosition.row + 1
          },
          resolvedTargetSymbol: resolvedTargetSymbol || undefined
        });
      }
    }
    
    return relationships;
  }

  async extractReferenceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    fileContent: string,
    symbolResolver: SymbolResolver
  ): Promise<ReferenceRelationship[]> {
    const relationships: ReferenceRelationship[] = [];
    
    // 查找所有标识符引用
    const identifiers = this.treeSitterService.findNodeByType(ast, 'identifier');
    
    for (const identifier of identifiers) {
      const identifierName = this.treeSitterService.getNodeText(identifier, fileContent);
      
      // 使用符号解析器解析引用的符号
      const resolvedSymbol = symbolResolver.resolveSymbol(identifierName, filePath, identifier);
      
      if (resolvedSymbol) {
        // 确定引用类型
        const referenceType = this.determineReferenceType(identifier, resolvedSymbol);
        
        relationships.push({
          sourceId: this.generateNodeId(identifierName, 'reference', filePath),
          targetId: this.generateSymbolId(resolvedSymbol),
          referenceType,
          referenceName: identifierName,
          location: {
            filePath,
            lineNumber: identifier.startPosition.row + 1,
            columnNumber: identifier.startPosition.column + 1
          },
          resolvedSymbol
        });
      }
    }
    
    return relationships;
  }

  async extractCreationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    fileContent: string,
    symbolResolver: SymbolResolver
  ): Promise<CreationRelationship[]> {
    const relationships: CreationRelationship[] = [];
    
    // 查找new表达式
    const newExpressions = this.treeSitterService.findNodeByType(ast, 'new_expression');
    
    for (const newExpr of newExpressions) {
      const className = this.extractClassNameFromNewExpression(newExpr, fileContent);
      
      if (className) {
        // 使用符号解析器解析类符号
        const resolvedSymbol = symbolResolver.resolveSymbol(className, filePath, newExpr);
        
        relationships.push({
          sourceId: this.generateNodeId(`creation_${newExpr.startPosition.row}`, 'creation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(className, 'class', filePath),
          creationType: 'instantiation',
          targetName: className,
          location: {
            filePath,
            lineNumber: newExpr.startPosition.row + 1,
            columnNumber: newExpr.startPosition.column + 1
          },
          resolvedTargetSymbol: resolvedSymbol || undefined
        });
      }
    }
    
    return relationships;
  }

  async extractAnnotationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<AnnotationRelationship[]> {
    const relationships: AnnotationRelationship[] = [];
    
    // 查找装饰器
    const decorators = this.treeSitterService.findNodeByType(ast, 'decorator');
    
    for (const decorator of decorators) {
      const annotationName = this.extractAnnotationName(decorator);
      const parameters = this.extractAnnotationParameters(decorator);
      
      if (annotationName) {
        // 使用符号解析器解析注解符号
        const resolvedSymbol = symbolResolver.resolveSymbol(annotationName, filePath, decorator);
        
        relationships.push({
          sourceId: this.generateNodeId(`annotation_${decorator.startPosition.row}`, 'annotation', filePath),
          targetId: resolvedSymbol ? this.generateSymbolId(resolvedSymbol) : this.generateNodeId(annotationName, 'decorator', filePath),
          annotationType: 'decorator',
          annotationName,
          parameters,
          location: {
            filePath,
            lineNumber: decorator.startPosition.row + 1,
            columnNumber: decorator.startPosition.column + 1
          },
          resolvedAnnotationSymbol: resolvedSymbol || undefined
        });
      }
    }
    
    return relationships;
  }

  // 辅助方法实现...
  private findCallerSymbol(callExpr: Parser.SyntaxNode, symbolResolver: SymbolResolver, filePath: string): Symbol | null {
    // 实现查找调用者符号的逻辑
    return null;
  }

  private extractCalleeName(callExpr: Parser.SyntaxNode, fileContent: string): string | null {
    // 实现提取被调用函数名逻辑
    return null;
  }

  private analyzeCallContext(callExpr: Parser.SyntaxNode, fileContent: string): {
    isChained: boolean;
    chainDepth?: number;
    isAsync: boolean;
  } {
    // 实现分析调用上下文的逻辑
    return {
      isChained: false,
      isAsync: false
    };
  }

  private determineCallType(callExpr: Parser.SyntaxNode, resolvedSymbol: Symbol | null): 'function' | 'method' | 'constructor' | 'static' | 'callback' | 'decorator' {
    // 实现确定调用类型逻辑
    return 'function';
  }

  private extractClassName(classDecl: Parser.SyntaxNode): string | null {
    // 实现提取类名逻辑
    return null;
  }

  private findHeritageClauses(classDecl: Parser.SyntaxNode): Parser.SyntaxNode[] {
    // 实现查找继承子句逻辑
    return [];
  }

  private extractParentClassName(heritageClause: Parser.SyntaxNode): string | null {
    // 实现提取父类名逻辑
    return null;
  }

  private getInheritanceType(heritageClause: Parser.SyntaxNode): 'extends' | 'implements' | 'mixin' {
    // 实现确定继承类型逻辑
    return 'extends';
  }

  private extractImportInfo(importStmt: Parser.SyntaxNode): {
    source: string;
    importedSymbols: string[];
  } | null {
    // 实现提取导入信息逻辑
    return null;
  }

  private determineReferenceType(identifier: Parser.SyntaxNode, resolvedSymbol: Symbol): 'variable' | 'constant' | 'parameter' | 'field' {
    // 实现确定引用类型逻辑
    return 'variable';
  }

  private extractClassNameFromNewExpression(newExpr: Parser.SyntaxNode, fileContent: string): string | null {
    // 实现从new表达式中提取类名逻辑
    return null;
  }

  private extractAnnotationName(decorator: Parser.SyntaxNode): string | null {
    // 实现提取注解名逻辑
    return null;
  }

  private extractAnnotationParameters(decorator: Parser.SyntaxNode): Record<string, any> {
    // 实现提取注解参数逻辑
    return {};
  }

  private generateSymbolId(symbol: Symbol): string {
    return `${symbol.type}_${Buffer.from(`${symbol.filePath}_${symbol.name}`).toString('hex')}`;
  }

  private generateNodeId(name: string, type: string, filePath: string): string {
    return `${type}_${Buffer.from(`${filePath}_${name}`).toString('hex')}`;
  }
}
```

#### 2.4 创建关系提取器工厂

**文件**: `src/service/graph/mapping/RelationshipExtractorFactory.ts`

```typescript
import { ILanguageRelationshipExtractor } from './interfaces/IRelationshipExtractor';
import { JavaScriptRelationshipExtractor } from './extractors/JavaScriptRelationshipExtractor';
import { TypeScriptRelationshipExtractor } from './extractors/TypeScriptRelationshipExtractor';
import { PythonRelationshipExtractor } from './extractors/PythonRelationshipExtractor';
import { JavaRelationshipExtractor } from './extractors/JavaRelationshipExtractor';
import { SymbolResolver } from '../symbol/SymbolResolver';
import { injectable, inject } from 'inversify';
import { TYPES } from '../../../types';
import { LoggerService } from '../../../utils/LoggerService';
import { Container } from 'inversify';

@injectable()
export class RelationshipExtractorFactory {
  private extractors: Map<string, ILanguageRelationshipExtractor> = new Map();

  constructor(
    @inject(TYPES.LoggerService) private logger: LoggerService,
    @inject(TYPES.TreeSitterService) private treeSitterService: any,
    @inject(TYPES.Container) private container: Container
  ) {
    this.initializeExtractors();
  }

  private initializeExtractors(): void {
    // 注册语言特定的关系提取器
    // 使用依赖注入容器来创建提取器实例，确保所有依赖都正确注入
    this.extractors.set('javascript', this.container.get<JavaScriptRelationshipExtractor>(TYPES.JavaScriptRelationshipExtractor));
    this.extractors.set('typescript', this.container.get<TypeScriptRelationshipExtractor>(TYPES.TypeScriptRelationshipExtractor));
    this.extractors.set('python', this.container.get<PythonRelationshipExtractor>(TYPES.PythonRelationshipExtractor));
    this.extractors.set('java', this.container.get<JavaRelationshipExtractor>(TYPES.JavaRelationshipExtractor));
    
    this.logger.info(`Initialized ${this.extractors.size} language relationship extractors`);
  }

  getExtractor(language: string): ILanguageRelationshipExtractor | null {
    const normalizedLanguage = language.toLowerCase();
    return this.extractors.get(normalizedLanguage) || null;
  }

  getSupportedLanguages(): string[] {
    return Array.from(this.extractors.keys());
  }

  registerExtractor(language: string, extractor: ILanguageRelationshipExtractor): void {
    this.extractors.set(language.toLowerCase(), extractor);
    this.logger.info(`Registered relationship extractor for language: ${language}`);
  }

  // 新增：获取支持的关系类型
  getSupportedRelationshipTypes(language: string): string[] {
    const extractor = this.getExtractor(language);
    return extractor ? extractor.getSupportedRelationshipTypes() : [];
  }
}
```

### 阶段三：集成和优化（2-3天）

#### 3.1 重构GraphDataMappingService

**文件**: `src/service/graph/mapping/GraphDataMappingService.ts`

```typescript
import { RelationshipExtractorFactory } from './RelationshipExtractorFactory';
import { ILanguageRelationshipExtractor, RelationshipExtractionResult } from './interfaces/IRelationshipExtractor';
import { SymbolResolver } from '../symbol/SymbolResolver';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../../types';

@injectable()
export class GraphDataMappingService implements IGraphDataMappingService {
  private symbolResolver: SymbolResolver;
  
  constructor(
    // ... 现有依赖
    @inject(TYPES.RelationshipExtractorFactory) private relationshipExtractorFactory: RelationshipExtractorFactory,
    @inject(TYPES.SymbolResolver) symbolResolver: SymbolResolver
  ) {
    this.symbolResolver = symbolResolver;
    // ... 现有构造函数代码
  }

  // 新增：使用关系提取器的方法
  async extractRelationshipsUsingExtractors(
    ast: Parser.SyntaxNode,
    filePath: string,
    fileContent: string,
    language: string
  ): Promise<RelationshipExtractionResult> {
    const extractor = this.relationshipExtractorFactory.getExtractor(language);
    
    if (!extractor) {
      this.logger.warn(`No relationship extractor found for language: ${language}`);
      return {
        callRelationships: [],
        inheritanceRelationships: [],
        dependencyRelationships: [],
        referenceRelationships: [],
        creationRelationships: [],
        annotationRelationships: []
      };
    }

    try {
      // 首先为文件构建符号表
      await this.symbolResolver.buildSymbolTable(filePath, ast, language);
      
      // 使用符号解析器和关系提取器提取所有类型的关系
      const [
        callRelationships,
        inheritanceRelationships,
        dependencyRelationships,
        referenceRelationships,
        creationRelationships,
        annotationRelationships
      ] = await Promise.all([
        extractor.extractCallRelationships(ast, filePath, fileContent, this.symbolResolver),
        extractor.extractInheritanceRelationships(ast, filePath, this.symbolResolver),
        extractor.extractDependencyRelationships(ast, filePath, this.symbolResolver),
        extractor.extractReferenceRelationships(ast, filePath, fileContent, this.symbolResolver),
        extractor.extractCreationRelationships(ast, filePath, fileContent, this.symbolResolver),
        extractor.extractAnnotationRelationships(ast, filePath, this.symbolResolver)
      ]);

      return {
        callRelationships,
        inheritanceRelationships,
        dependencyRelationships,
        referenceRelationships,
        creationRelationships,
        annotationRelationships
      };
    } catch (error) {
      this.logger.error(`Failed to extract relationships using extractor for ${language}`, { error });
      return {
        callRelationships: [],
        inheritanceRelationships: [],
        dependencyRelationships: [],
        referenceRelationships: [],
        creationRelationships: [],
        annotationRelationships: []
      };
    }
  }

  // 修改现有的mapQueryResultsToGraph方法
  async mapQueryResultsToGraph(queryResults: Map<string, QueryResult>): Promise<GraphMappingResult> {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // 现有的节点处理逻辑保持不变
    this.processNodes(queryResults, nodes);

    // 使用新的关系提取器处理关系
    await this.processRelationships(queryResults, edges);

    return { nodes, edges };
  }

  // 新增：处理关系的方法
  private async processRelationships(queryResults: Map<string, QueryResult>, edges: GraphEdge[]): Promise<void> {
    // 遍历所有查询结果，为每个文件提取关系
    for (const [filePath, queryResult] of queryResults) {
      if (queryResult.ast && queryResult.language && queryResult.content) {
        const relationships = await this.extractRelationshipsUsingExtractors(
          queryResult.ast,
          filePath,
          queryResult.content,
          queryResult.language
        );
        
        // 将提取的关系转换为图边
        this.convertRelationshipsToEdges(relationships, edges);
      }
    }
  }

  // 新增：将关系转换为图边
  private convertRelationshipsToEdges(relationships: RelationshipExtractionResult, edges: GraphEdge[]): void {
    // 转换调用关系
    for (const callRel of relationships.callRelationships) {
      edges.push({
        id: uuidv4(),
        type: GraphRelationshipType.CALLS,
        sourceNodeId: callRel.callerId,
        targetNodeId: callRel.calleeId,
        properties: {
          callName: callRel.callName,
          callType: callRel.callType,
          callContext: callRel.callContext,
          resolvedSymbol: callRel.resolvedSymbol,
          location: callRel.location
        }
      });
    }

    // 转换继承关系
    for (const inheritRel of relationships.inheritanceRelationships) {
      edges.push({
        id: uuidv4(),
        type: GraphRelationshipType.INHERITS,
        sourceNodeId: inheritRel.childId,
        targetNodeId: inheritRel.parentId,
        properties: {
          inheritanceType: inheritRel.inheritanceType,
          resolvedParentSymbol: inheritRel.resolvedParentSymbol,
          resolvedChildSymbol: inheritRel.resolvedChildSymbol,
          location: inheritRel.location
        }
      });
    }

    // 转换依赖关系
    for (const depRel of relationships.dependencyRelationships) {
      edges.push({
        id: uuidv4(),
        type: GraphRelationshipType.DEPENDS_ON,
        sourceNodeId: depRel.sourceId,
        targetNodeId: depRel.targetId,
        properties: {
          dependencyType: depRel.dependencyType,
          target: depRel.target,
          importedSymbols: depRel.importedSymbols,
          resolvedTargetSymbol: depRel.resolvedTargetSymbol,
          location: depRel.location
        }
      });
    }

    // 转换引用关系
    for (const refRel of relationships.referenceRelationships) {
      edges.push({
        id: uuidv4(),
        type: GraphRelationshipType.REFERENCES,
        sourceNodeId: refRel.sourceId,
        targetNodeId: refRel.targetId,
        properties: {
          referenceType: refRel.referenceType,
          referenceName: refRel.referenceName,
          resolvedSymbol: refRel.resolvedSymbol,
          location: refRel.location
        }
      });
    }

    // 转换创建关系
    for (const createRel of relationships.creationRelationships) {
      edges.push({
        id: uuidv4(),
        type: GraphRelationshipType.CREATES,
        sourceNodeId: createRel.sourceId,
        targetNodeId: createRel.targetId,
        properties: {
          creationType: createRel.creationType,
          targetName: createRel.targetName,
          resolvedTargetSymbol: createRel.resolvedTargetSymbol,
          location: createRel.location
        }
      });
    }

    // 转换注解关系
    for (const annotRel of relationships.annotationRelationships) {
      edges.push({
        id: uuidv4(),
        type: GraphRelationshipType.ANNOTATED_BY,
        sourceNodeId: annotRel.sourceId,
        targetNodeId: annotRel.targetId,
        properties: {
          annotationType: annotRel.annotationType,
          annotationName: annotRel.annotationName,
          parameters: annotRel.parameters,
          resolvedAnnotationSymbol: annotRel.resolvedAnnotationSymbol,
          location: annotRel.location
        }
      });
    }
  }
}
```

#### 3.2 添加依赖注入配置

**文件**: `src/types.ts`

```typescript
// 在TYPES常量中添加
export const TYPES = {
  // ... 现有类型定义
  
  // 符号解析器相关
  SymbolResolver: Symbol.for('SymbolResolver'),
  LanguageSymbolExtractor: Symbol.for('LanguageSymbolExtractor'),
  JavaScriptSymbolExtractor: Symbol.for('JavaScriptSymbolExtractor'),
  TypeScriptSymbolExtractor: Symbol.for('TypeScriptSymbolExtractor'),
  PythonSymbolExtractor: Symbol.for('PythonSymbolExtractor'),
  JavaSymbolExtractor: Symbol.for('JavaSymbolExtractor'),
  
  // 关系提取器相关
  RelationshipExtractorFactory: Symbol.for('RelationshipExtractorFactory'),
  ILanguageRelationshipExtractor: Symbol.for('ILanguageRelationshipExtractor'),
  JavaScriptRelationshipExtractor: Symbol.for('JavaScriptRelationshipExtractor'),
  TypeScriptRelationshipExtractor: Symbol.for('TypeScriptRelationshipExtractor'),
  PythonRelationshipExtractor: Symbol.for('PythonRelationshipExtractor'),
  JavaRelationshipExtractor: Symbol.for('JavaRelationshipExtractor'),
  
  // 新增的关系类型
  ReferenceRelationship: Symbol.for('ReferenceRelationship'),
  CreationRelationship: Symbol.for('CreationRelationship'),
  AnnotationRelationship: Symbol.for('AnnotationRelationship'),
};
```

#### 3.3 注册服务

**文件**: `src/core/registrars/GraphServiceRegistrar.ts`

```typescript
import { RelationshipExtractorFactory } from '../../service/graph/mapping/RelationshipExtractorFactory';
import { JavaScriptRelationshipExtractor } from '../../service/graph/mapping/extractors/JavaScriptRelationshipExtractor';
import { SymbolResolver } from '../../service/graph/symbol/SymbolResolver';
import { JavaScriptSymbolExtractor } from '../../service/graph/symbol/extractors/JavaScriptSymbolExtractor';
// ... 其他导入

export class GraphServiceRegistrar {
  static register(container: Container): void {
    // ... 现有注册代码

    // 注册符号解析器
    container.bind<SymbolResolver>(TYPES.SymbolResolver)
      .to(SymbolResolver)
      .inSingletonScope();

    // 注册语言特定的符号提取器
    container.bind<JavaScriptSymbolExtractor>(TYPES.JavaScriptSymbolExtractor)
      .to(JavaScriptSymbolExtractor)
      .inSingletonScope();
    
    // 注册其他语言的符号提取器
    // container.bind<TypeScriptSymbolExtractor>(TYPES.TypeScriptSymbolExtractor)
    //   .to(TypeScriptSymbolExtractor)
    //   .inSingletonScope();
    // container.bind<PythonSymbolExtractor>(TYPES.PythonSymbolExtractor)
    //   .to(PythonSymbolExtractor)
    //   .inSingletonScope();
    // container.bind<JavaSymbolExtractor>(TYPES.JavaSymbolExtractor)
    //   .to(JavaSymbolExtractor)
    //   .inSingletonScope();

    // 注册关系提取器
    container.bind<RelationshipExtractorFactory>(TYPES.RelationshipExtractorFactory)
      .to(RelationshipExtractorFactory)
      .inSingletonScope();

    container.bind<JavaScriptRelationshipExtractor>(TYPES.JavaScriptRelationshipExtractor)
      .to(JavaScriptRelationshipExtractor)
      .inSingletonScope();

    // 注册其他语言的关系提取器
    // container.bind<TypeScriptRelationshipExtractor>(TYPES.TypeScriptRelationshipExtractor)
    //   .to(TypeScriptRelationshipExtractor)
    //   .inSingletonScope();
    // container.bind<PythonRelationshipExtractor>(TYPES.PythonRelationshipExtractor)
    //   .to(PythonRelationshipExtractor)
    //   .inSingletonScope();
    // container.bind<JavaRelationshipExtractor>(TYPES.JavaRelationshipExtractor)
    //   .to(JavaRelationshipExtractor)
    //   .inSingletonScope();
  }
}
```
