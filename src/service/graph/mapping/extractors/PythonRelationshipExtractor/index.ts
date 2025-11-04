import {
  SymbolResolver,
  Symbol,
  SymbolType,
  TreeSitterService,
  LoggerService,
  inject,
  injectable,
  TYPES,
  Parser,
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
  ConcurrencyRelationship
} from '../types';
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

@injectable()
export class PythonRelationshipExtractor implements ILanguageRelationshipExtractor {
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
    @inject(TYPES.TreeSitterService) protected treeSitterService: TreeSitterService,
    @inject(TYPES.LoggerService) protected logger: LoggerService,
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
    return 'python';
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
    return this.callExtractor.extract(ast, filePath, symbolResolver);
  }

  async extractInheritanceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<InheritanceRelationship[]> {
    return this.inheritanceExtractor.extract(ast, filePath, symbolResolver);
  }

  async extractDependencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DependencyRelationship[]> {
    return this.dependencyExtractor.extract(ast, filePath, symbolResolver);
  }

  async extractReferenceRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ReferenceRelationship[]> {
    return this.referenceExtractor.extract(ast, filePath, symbolResolver);
  }

  async extractCreationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<CreationRelationship[]> {
    return this.creationExtractor.extract(ast, filePath, symbolResolver);
  }

  async extractAnnotationRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<AnnotationRelationship[]> {
    return this.annotationExtractor.extract(ast, filePath, symbolResolver);
  }

  async extractDataFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<DataFlowRelationship[]> {
    return this.dataFlowExtractor.extract(ast, filePath, symbolResolver);
  }

  async extractControlFlowRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ControlFlowRelationship[]> {
    return this.controlFlowExtractor.extract(ast, filePath, symbolResolver);
  }

  async extractSemanticRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<SemanticRelationship[]> {
    return this.semanticExtractor.extract(ast, filePath, symbolResolver);
  }

  async extractLifecycleRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<LifecycleRelationship[]> {
    return this.lifecycleExtractor.extract(ast, filePath, symbolResolver);
  }

  async extractConcurrencyRelationships(
    ast: Parser.SyntaxNode,
    filePath: string,
    symbolResolver: SymbolResolver
  ): Promise<ConcurrencyRelationship[]> {
    return this.concurrencyExtractor.extract(ast, filePath, symbolResolver);
  }
}