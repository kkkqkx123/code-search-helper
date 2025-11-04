import { SymbolResolver, Symbol } from '../../symbol/SymbolResolver';
import Parser = require('tree-sitter');

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
  inheritanceType: 'extends' | 'implements' | 'mixin' | 'enum_member' | 'contains' | 'embedded_struct';
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
  dependencyType: 'import' | 'export' | 'type_dependency' | 'namespace' | 'include';
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
  referenceType: 'variable' | 'constant' | 'parameter' | 'field' | 'function' | 'method' | 'type' | 'class' | 'interface' | 'enum' | 'namespace';
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
  annotationType: 'decorator' | 'annotation' | 'attribute' | 'type_annotation';
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
    symbolResolver: SymbolResolver
  ): Promise<ReferenceRelationship[]>;
  
  extractCreationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
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