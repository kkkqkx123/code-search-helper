import {
  ILanguageRelationshipExtractor,
  CallRelationship,
  InheritanceRelationship,
  DependencyRelationship,
  ReferenceRelationship,
  CreationRelationship,
  AnnotationRelationship,
  DataFlowRelationship,
  ControlFlowRelationship,
  SemanticRelationship,
  LifecycleRelationship,
  ConcurrencyRelationship,
  SymbolResolver,
  TreeSitterService,
  LoggerService,
  TYPES
} from '../types';
import { inject, injectable } from 'inversify';
import { BaseCRelationshipExtractor } from './BaseCRelationshipExtractor';
import { CallExtractor } from './CallExtractor';
import { InheritanceExtractor } from './InheritanceExtractor';
import { DependencyExtractor } from './DependencyExtractor';
import { ReferenceExtractor } from './ReferenceExtractor';
import { CreationExtractor } from './CreationExtractor';
import { AnnotationExtractor } from './AnnotationExtractor';
import { DataFlowExtractor } from './DataFlowExtractor';
import { ControlFlowExtractor } from './ControlFlowExtractor';
import { SemanticExtractor } from './SemanticExtractor';
import { LifecycleExtractor } from './LifecycleExtractor';
import { ConcurrencyExtractor } from './ConcurrencyExtractor';
import Parser = require('tree-sitter');

/**
 * C语言关系提取器主类
 * 整合所有特定类型的提取器，提供统一的接口
 */
@injectable()
export class CRelationshipExtractor extends BaseCRelationshipExtractor implements ILanguageRelationshipExtractor {
  // 各种提取器实例
  private callExtractor: CallExtractor;
  private inheritanceExtractor: InheritanceExtractor;
  private dependencyExtractor: DependencyExtractor;
  private referenceExtractor: ReferenceExtractor;
  private creationExtractor: CreationExtractor;
  private annotationExtractor: AnnotationExtractor;
  private dataFlowExtractor: DataFlowExtractor;
  private controlFlowExtractor: ControlFlowExtractor;
  private semanticExtractor: SemanticExtractor;
  private lifecycleExtractor: LifecycleExtractor;
  private concurrencyExtractor: ConcurrencyExtractor;

  constructor(
    @inject(TYPES.TreeSitterService) treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) logger: LoggerService
  ) {
    super(treeSitterService, logger);
    // 初始化所有提取器 - 它们也需要依赖注入
    this.callExtractor = new CallExtractor(treeSitterService, logger);
    this.inheritanceExtractor = new InheritanceExtractor(treeSitterService, logger);
    this.dependencyExtractor = new DependencyExtractor(treeSitterService, logger);
    this.referenceExtractor = new ReferenceExtractor(treeSitterService, logger);
    this.creationExtractor = new CreationExtractor(treeSitterService, logger);
    this.annotationExtractor = new AnnotationExtractor(treeSitterService, logger);
    this.dataFlowExtractor = new DataFlowExtractor(treeSitterService, logger);
    this.controlFlowExtractor = new ControlFlowExtractor(treeSitterService, logger);
    this.semanticExtractor = new SemanticExtractor(treeSitterService, logger);
    this.lifecycleExtractor = new LifecycleExtractor(treeSitterService, logger);
    this.concurrencyExtractor = new ConcurrencyExtractor(treeSitterService, logger);
  }

  getSupportedLanguage(): string {
    return 'c';
  }

  getSupportedRelationshipTypes(): string[] {
    return [
      'call', 'inheritance', 'dependency',
      'reference', 'creation', 'annotation',
      'data_flow', 'control_flow', 'semantic', 
      'lifecycle', 'concurrency'
    ];
  }

  async extractCallRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<CallRelationship[]> {
    return this.callExtractor.extractCallRelationships(ast, filePath, symbolResolver);
  }

  async extractInheritanceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<InheritanceRelationship[]> {
    return this.inheritanceExtractor.extractInheritanceRelationships(ast, filePath, symbolResolver);
  }

  async extractDependencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DependencyRelationship[]> {
    return this.dependencyExtractor.extractDependencyRelationships(ast, filePath, symbolResolver);
  }

  async extractReferenceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ReferenceRelationship[]> {
    return this.referenceExtractor.extractReferenceRelationships(ast, filePath, symbolResolver);
  }

  async extractCreationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<CreationRelationship[]> {
    return this.creationExtractor.extractCreationRelationships(ast, filePath, symbolResolver);
  }

  async extractAnnotationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<AnnotationRelationship[]> {
    return this.annotationExtractor.extractAnnotationRelationships(ast, filePath, symbolResolver);
  }

  async extractDataFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DataFlowRelationship[]> {
    return this.dataFlowExtractor.extractDataFlowRelationships(ast, filePath, symbolResolver);
  }

  async extractControlFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ControlFlowRelationship[]> {
    return this.controlFlowExtractor.extractControlFlowRelationships(ast, filePath, symbolResolver);
  }

  async extractSemanticRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<SemanticRelationship[]> {
    return this.semanticExtractor.extractSemanticRelationships(ast, filePath, symbolResolver);
  }

  async extractLifecycleRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<LifecycleRelationship[]> {
    return this.lifecycleExtractor.extractLifecycleRelationships(ast, filePath, symbolResolver);
  }

  async extractConcurrencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ConcurrencyRelationship[]> {
    return this.concurrencyExtractor.extractConcurrencyRelationships(ast, filePath, symbolResolver);
  }
}