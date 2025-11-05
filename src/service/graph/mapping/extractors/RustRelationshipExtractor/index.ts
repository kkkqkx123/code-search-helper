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
  TYPES,
  inject,
  injectable,
  Parser
} from '../types';
import { BaseRustRelationshipExtractor } from './BaseRustRelationshipExtractor';
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

/**
 * Rust语言关系提取器主类
 * 整合所有特定类型的提取器，提供统一的接口
 */
@injectable()
export class RustRelationshipExtractor extends BaseRustRelationshipExtractor implements ILanguageRelationshipExtractor {
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
    @inject(TYPES.LoggerService) logger: LoggerService,
    @inject(TYPES.CallExtractor) callExtractor: CallExtractor,
    @inject(TYPES.InheritanceExtractor) inheritanceExtractor: InheritanceExtractor,
    @inject(TYPES.DependencyExtractor) dependencyExtractor: DependencyExtractor,
    @inject(TYPES.ReferenceExtractor) referenceExtractor: ReferenceExtractor,
    @inject(TYPES.CreationExtractor) creationExtractor: CreationExtractor,
    @inject(TYPES.AnnotationExtractor) annotationExtractor: AnnotationExtractor,
    @inject(TYPES.DataFlowExtractor) dataFlowExtractor: DataFlowExtractor,
    @inject(TYPES.ControlFlowExtractor) controlFlowExtractor: ControlFlowExtractor,
    @inject(TYPES.SemanticExtractor) semanticExtractor: SemanticExtractor,
    @inject(TYPES.LifecycleExtractor) lifecycleExtractor: LifecycleExtractor,
    @inject(TYPES.ConcurrencyExtractor) concurrencyExtractor: ConcurrencyExtractor
  ) {
    super(treeSitterService, logger);
    this.callExtractor = callExtractor;
    this.inheritanceExtractor = inheritanceExtractor;
    this.dependencyExtractor = dependencyExtractor;
    this.referenceExtractor = referenceExtractor;
    this.creationExtractor = creationExtractor;
    this.annotationExtractor = annotationExtractor;
    this.dataFlowExtractor = dataFlowExtractor;
    this.controlFlowExtractor = controlFlowExtractor;
    this.semanticExtractor = semanticExtractor;
    this.lifecycleExtractor = lifecycleExtractor;
    this.concurrencyExtractor = concurrencyExtractor;
  }

  getSupportedLanguage(): string {
    return 'rust';
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
    filePath: string
  ): Promise<DataFlowRelationship[]> {
    return this.dataFlowExtractor.extractDataFlowRelationships(ast, filePath);
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
